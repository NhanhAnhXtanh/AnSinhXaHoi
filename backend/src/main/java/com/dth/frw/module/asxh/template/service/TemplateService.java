package com.dth.frw.module.asxh.template.service;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.api.dto.TemplatePatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateResponse.VersionSummary;
import com.dth.frw.module.asxh.template.repo.TemplateRepository;
import com.dth.frw.module.asxh.template.repo.TemplateSpecifications;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRepository;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Biểu trong bộ mẫu (UC-10). Port từ {@code TemplateSeriesCreationService} và
 * phần "series" của {@code TemplateWorkbookService} bản Jmix.
 *
 * <p>Không phụ thuộc {@link TemplateVersionService} (chiều ngược lại thì có) để
 * Spring không gặp vòng phụ thuộc; việc tạo phiên bản đầu khi tạo biểu đi thẳng
 * qua repository phiên bản cùng slice.
 */
@Service
@Transactional(readOnly = true)
public class TemplateService {

    private static final Set<String> SORTABLE =
            Set.of("id", "code", "shortName", "name", "kind", "sortOrder", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("shortName"), Sort.Order.asc("id"));

    /** Số phiên bản, bản đang áp dụng hôm nay và bản mới nhất của một biểu. */
    public record TemplateStats(long versionCount, VersionSummary currentVersion, VersionSummary latestVersion) {
        static final TemplateStats EMPTY = new TemplateStats(0, null, null);
    }

    private final TemplateRepository repository;
    private final TemplateVersionRepository versionRepository;
    private final TemplateSetService setService;
    private final ApplicationEventPublisher events;

    public TemplateService(TemplateRepository repository,
                           TemplateVersionRepository versionRepository,
                           TemplateSetService setService,
                           ApplicationEventPublisher events) {
        this.repository = repository;
        this.versionRepository = versionRepository;
        this.setService = setService;
        this.events = events;
    }

    public Page<Template> list(ListParams params) {
        return repository.findAll(TemplateSpecifications.from(params), params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Template get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new TemplateNotFoundException("biểu", id));
    }

    public List<Template> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /**
     * Biểu có bản đã ban hành áp dụng tới ngày {@code date} — cột biểu của ma
     * trận thiết lập kỳ (UC-22 dùng hôm nay). {@code kind} {@code null} = mọi loại.
     */
    public List<Template> applicableOn(LocalDate date, TemplateKind kind) {
        Specification<Template> spec = TemplateSpecifications.applicableOn(date);
        if (kind != null) {
            Specification<Template> byKind = (root, query, cb) -> cb.equal(root.get("kind"), kind);
            spec = spec.and(byKind);
        }
        return repository.findAll(spec, DEFAULT_SORT);
    }

    /**
     * Khoá dòng biểu đến hết giao dịch — mọi thao tác đổi trạng thái trong chuỗi
     * phiên bản gọi trước khi kiểm tra.
     */
    @Transactional
    public Template lock(Long id) {
        return repository.lockById(id)
                .orElseThrow(() -> new TemplateNotFoundException("biểu", id));
    }

    /**
     * Khoá cả biểu để chữa lỗi: từ lúc này không phiên bản nào của biểu được chọn cho đợt báo cáo
     * mới (mở đợt, sao chép thiết lập), không ban hành / thu hồi được. Vẫn xem, vẫn tạo và sửa bản
     * nháp. Phiếu đã lập theo biểu vẫn nhập / duyệt bình thường. Khoá lại biểu đang khoá là no-op.
     */
    @Transactional
    public Template lockForm(Long id) {
        Template template = lock(id);
        if (!template.isLocked()) {
            template.lockForm(CurrentUser.username().orElse(null), Instant.now());
            repository.saveAndFlush(template);
            events.publishEvent(new TemplateFormLockChanged(template.getId(), true));
        }
        return template;
    }

    /** Mở khoá cả biểu — các phiên bản đã ban hành lại được chọn như trước; bản nháp ban hành được. */
    @Transactional
    public Template unlockForm(Long id) {
        Template template = lock(id);
        if (template.isLocked()) {
            template.unlockForm();
            repository.saveAndFlush(template);
            events.publishEvent(new TemplateFormLockChanged(template.getId(), false));
        }
        return template;
    }

    /** Thống kê phiên bản cho các biểu đang hiện, một truy vấn, không kéo workbook. */
    public Map<Long, TemplateStats> stats(Collection<Long> templateIds) {
        Map<Long, TemplateStats> result = new HashMap<>();
        if (templateIds.isEmpty()) {
            return result;
        }
        Map<Long, List<VersionSummary>> byTemplate = new HashMap<>();
        for (Object[] row : versionRepository.summariesByTemplateIds(templateIds)) {
            Long templateId = (Long) row[0];
            VersionSummary summary = new VersionSummary(
                    (Long) row[1], ((Number) row[2]).intValue(), (TemplateStatus) row[3], (LocalDate) row[4]);
            byTemplate.computeIfAbsent(templateId, key -> new ArrayList<>()).add(summary);
        }
        LocalDate today = TemplateDates.today();
        for (Long id : templateIds) {
            List<VersionSummary> versions = byTemplate.getOrDefault(id, List.of());
            VersionSummary latest = versions.stream()
                    .max(Comparator.comparingInt(VersionSummary::versionNo))
                    .orElse(null);
            // Cùng quy tắc với TemplateVersionService.resolve (UC-19): bản đã ban
            // hành có ngày áp dụng <= hôm nay, mới nhất; hoà ngày thì id lớn hơn.
            VersionSummary current = versions.stream()
                    .filter(v -> v.status() == TemplateStatus.PUBLISHED)
                    .filter(v -> v.effectiveFrom() != null && !v.effectiveFrom().isAfter(today))
                    .max(Comparator.comparing(VersionSummary::effectiveFrom)
                            .thenComparing(VersionSummary::id))
                    .orElse(null);
            result.put(id, new TemplateStats(versions.size(), current, latest));
        }
        return result;
    }

    public TemplateStats stats(Long templateId) {
        return stats(List.of(templateId)).getOrDefault(templateId, TemplateStats.EMPTY);
    }

    /**
     * UC-10: tạo biểu + phiên bản đầu (Nháp) trong một giao dịch. Mã nội bộ
     * BM-xxxxxx lấy từ sequence {@code asxh_template_code_seq}.
     */
    @Transactional
    public Template create(TemplateRequest request) {
        TemplateSet set = setService.get(request.set().id());
        String shortName = request.shortName().trim();
        requireShortNameAvailable(set, shortName, null);

        int sortOrder = request.sortOrder() != null
                ? request.sortOrder()
                : repository.maxSortOrder(set.getId()) + 1;
        String code = "BM-%06d".formatted(repository.nextCodeNumber());

        Template template = repository.save(new Template(
                set,
                code,
                shortName,
                request.name().trim(),
                request.kind() == null ? TemplateKind.CHI_TIET : request.kind(),
                sortOrder));

        TemplateVersion first = new TemplateVersion(template, 1, null);
        first.setEffectiveFrom(request.effectiveFrom() != null
                ? request.effectiveFrom()
                : TemplateDates.firstDayOfNextMonth());
        versionRepository.save(first);
        return template;
    }

    @Transactional
    public Template update(Long id, TemplatePatchRequest request) {
        Template template = lock(id);

        // Đích đến tính trước, kiểm tra xong mới ghi vào entity (xem
        // DepartmentService.update: ghi trước rồi truy vấn thì auto-flush đẩy
        // bản cập nhật lên trước phép kiểm tra).
        TemplateSet targetSet = request.set() != null && request.set().id() != null
                ? setService.get(request.set().id())
                : template.getTemplateSet();
        String targetShortName = request.shortName() != null ? request.shortName().trim() : template.getShortName();
        boolean moved = !targetSet.getId().equals(template.getTemplateSet().getId());
        if (request.shortName() != null || moved) {
            requireShortNameAvailable(targetSet, targetShortName, template.getId());
        }
        if (request.kind() != null && request.kind() != template.getKind()) {
            boolean hasPublished = versionRepository.findByTemplateIdOrderByVersionNoAsc(id).stream()
                    .anyMatch(v -> !v.getStatus().editable());
            if (hasPublished) {
                throw new ConflictException(
                        "Không đổi được loại biểu: biểu đã có phiên bản ban hành. Loại biểu chốt từ phiên bản đầu.");
            }
        }

        template.setTemplateSet(targetSet);
        template.setShortName(targetShortName);
        if (request.name() != null) {
            template.setName(request.name().trim());
        }
        if (request.kind() != null) {
            template.setKind(request.kind());
        }
        if (request.sortOrder() != null) {
            template.setSortOrder(request.sortOrder());
        }
        return repository.save(template);
    }

    /**
     * Xoá biểu. Chỉ khi biểu chưa từng có phiên bản rời trạng thái nháp — khi đó
     * các bản nháp bị xoá cùng. Biểu đã ban hành (kể cả đã thu hồi) thì không xoá,
     * chỉ khoá biểu lại.
     */
    @Transactional
    public Template delete(Long id) {
        Template template = lock(id);
        List<TemplateVersion> versions = versionRepository.findByTemplateIdOrderByVersionNoAsc(id);
        if (versions.stream().anyMatch(v -> !v.getStatus().editable())) {
            throw new ConflictException(
                    "Không xoá được biểu này: biểu đã có phiên bản ban hành (kể cả đã thu hồi). "
                            + "Bạn chỉ có thể khoá biểu lại để không dùng nữa.");
        }
        try {
            // Từ bản mới nhất xuống, để khoá ngoại bản nguồn (previous_version_id) không chặn.
            for (int i = versions.size() - 1; i >= 0; i--) {
                versionRepository.delete(versions.get(i));
                versionRepository.flush();
            }
            repository.delete(template);
            repository.flush();
        } catch (DataIntegrityViolationException e) {
            // Khoá ngoại RESTRICT từ bảng của phân hệ khác (thiết lập kỳ, phiếu nhập)
            // — để cơ sở dữ liệu trả lời thay vì đọc bảng của slice khác.
            throw new ConflictException(
                    "Không xoá được biểu này: biểu đã được dùng trong thiết lập kỳ báo cáo hoặc phiếu nhập.");
        }
        return template;
    }

    private void requireShortNameAvailable(TemplateSet set, String shortName, Long selfId) {
        repository.findFirstByTemplateSetIdAndShortNameIgnoreCase(set.getId(), shortName)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(selfId)) {
                        throw new ConflictException(
                                "Bộ mẫu \"%s\" đã có biểu %s.".formatted(set.getName(), shortName));
                    }
                });
    }
}
