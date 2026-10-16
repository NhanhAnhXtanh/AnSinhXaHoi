package com.dth.frw.module.asxh.template.service;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionPatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionRequest;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRepository;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRow;
import com.dth.frw.module.asxh.template.repo.TemplateVersionSpecifications;
import com.dth.frw.module.asxh.template.repo.TemplateVersionSummaryQuery;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Phiên bản mẫu: sửa nội dung, ban hành, khoá / mở khoá, thu hồi, xoá, tạo
 * phiên bản kế tiếp, và chọn phiên bản áp dụng theo ngày.
 *
 * <p>Port từ {@code TemplateWorkbookService} (publish, lockVersion,
 * unlockVersion, cloneVersion, deleteVersion, revokeVersion,
 * requireSuccessorApplyDate), {@code QtTemplateVersionEntityListener}
 * (requireLivePreviousVersion, bất biến sau ban hành) và
 * {@code TemplateVersionResolver} (resolveForSeries, earliestPublishedForSeries)
 * của bản Jmix. Câu báo giữ nguyên ý bản cũ.
 *
 * <p>Mọi thao tác đổi trạng thái khoá dòng biểu cha trước khi kiểm tra
 * ({@link TemplateService#lock}), nên hai người thao tác cùng một biểu cùng lúc
 * không cùng lọt qua các luật "bản mới nhất", "không rẽ nhánh".
 *
 * <p>TODO: chưa port — chạy script phía máy chủ (validate / getInputData /
 * getSummaryData bằng GraalJS), tự đăng ký chỉ tiêu khi lưu script (UC-05),
 * chuẩn hoá workbook cắt dòng trống thừa (BR-11.3; sheet "Evaluation Version"
 * thì đã cắt khi lưu), ngoại lệ
 * thay riêng script getSummaryData sau ban hành (UC-12 4b, chờ BA). Đếm phiếu
 * trong hộp cảnh báo thu hồi cũng chưa có — cần slice phiếu nhập cung cấp.
 */
@Service
@Transactional(readOnly = true)
public class TemplateVersionService {

    private static final Set<String> SORTABLE =
            Set.of("id", "versionNo", "status", "effectiveFrom", "effectiveTo", "publishedAt", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("versionNo"), Sort.Order.desc("id"));

    /**
     * Tên sheet mà bản dùng thử SpreadJS tự chèn khi chưa có giấy phép. Frontend
     * đã cắt khi lưu; máy chủ cắt thêm lần nữa cho chắc (UC-11 4b).
     */
    static final String EVALUATION_SHEET = "Evaluation Version";

    private final TemplateVersionRepository repository;
    private final TemplateVersionSummaryQuery summaryQuery;
    private final TemplateService templateService;
    private final ObjectMapper mapper;

    public TemplateVersionService(TemplateVersionRepository repository,
                                  TemplateVersionSummaryQuery summaryQuery,
                                  TemplateService templateService,
                                  ObjectMapper mapper) {
        this.repository = repository;
        this.summaryQuery = summaryQuery;
        this.templateService = templateService;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------ đọc

    public Page<TemplateVersion> list(ListParams params) {
        return repository.findAll(TemplateVersionSpecifications.from(params), params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public TemplateVersion get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new TemplateNotFoundException("phiên bản mẫu", id));
    }

    public List<TemplateVersion> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /**
     * Danh sách cho {@code GET /template_versions}: cùng bộ lọc, sắp xếp, phân
     * trang như {@link #list}, nhưng không đọc cột workbook / script.
     */
    public Page<TemplateVersionRow> listSummaries(ListParams params) {
        return summaryQuery.page(TemplateVersionSpecifications.from(params), params.pageable(SORTABLE, DEFAULT_SORT));
    }

    /** {@code getMany} dạng gọn — không đọc workbook / script. */
    public List<TemplateVersionRow> getManySummaries(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Specification<TemplateVersion> byIds = (root, query, cb) -> root.get("id").in(ids);
        return summaryQuery.all(byIds, DEFAULT_SORT);
    }

    // ------------------------------------------------- chọn phiên bản (UC-19)

    /**
     * Bản đã ban hành của biểu có ngày áp dụng ≤ {@code date}, mới nhất. Khoá,
     * thu hồi, nháp không bao giờ được chọn (BR-19.2).
     */
    public Optional<TemplateVersion> resolve(Long templateId, LocalDate date) {
        return repository.findFirstByTemplateIdAndStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDescIdDesc(
                templateId, TemplateStatus.PUBLISHED, date);
    }

    /**
     * Bí danh của {@link #resolve} cho slice thiết lập kỳ (mở đợt ghim phiên bản
     * áp dụng ở ngày mở đợt, UC-24 / UC-26) — không mượn bản sớm nhất.
     */
    public Optional<TemplateVersion> findEffective(Long templateId, LocalDate date) {
        return resolve(templateId, date);
    }

    /**
     * Như {@link #resolve}, nhưng ngày mốc trước mọi bản thì mượn bản đã ban
     * hành sớm nhất (UC-19 luồng 1a — kỳ quá khứ trước ngày hiệu lực của mẫu).
     */
    public Optional<TemplateVersion> resolveOrEarliest(Long templateId, LocalDate date) {
        Optional<TemplateVersion> found = resolve(templateId, date);
        if (found.isPresent()) {
            return found;
        }
        return repository.findFirstByTemplateIdAndStatusAndEffectiveFromNotNullOrderByEffectiveFromAscIdAsc(
                templateId, TemplateStatus.PUBLISHED);
    }

    /**
     * Phiên bản phải dùng cho biểu ở ngày mốc — để slice thiết lập kỳ / phiếu
     * ghim vào tờ biểu khi mở đợt. Biểu chưa từng ban hành thì báo lỗi (UC-19 1b).
     */
    public TemplateVersion requireApplicable(Long templateId, LocalDate date) {
        return resolveOrEarliest(templateId, date).orElseThrow(() -> {
            Template template = templateService.get(templateId);
            return new ConflictException(
                    "Biểu %s chưa có phiên bản đã ban hành.".formatted(template.getShortName()));
        });
    }

    // ------------------------------------------------------------ ghi nội dung

    /**
     * Tạo lại phiên bản đầu cho biểu đang không còn phiên bản nào (sau khi đã xoá
     * hết). Biểu còn phiên bản thì phải tạo phiên bản kế tiếp để chuỗi không rẽ nhánh.
     */
    @Transactional
    public TemplateVersion create(TemplateVersionRequest request) {
        Template template = templateService.lock(request.template().id());
        if (repository.countByTemplateId(template.getId()) > 0) {
            throw new ConflictException(
                    "Biểu này đã có phiên bản — hãy dùng \"Tạo phiên bản kế tiếp\" để có phiên bản mới.");
        }
        TemplateVersion version = new TemplateVersion(template, repository.maxVersionNo(template.getId()) + 1, null);
        version.setEffectiveFrom(request.effectiveFrom() != null
                ? request.effectiveFrom()
                : TemplateDates.firstDayOfNextMonth());
        if (request.workbookJson() != null) {
            version.setWorkbookJson(requireWorkbook(request.workbookJson()));
        }
        if (request.scriptText() != null) {
            version.setScriptText(request.scriptText());
        }
        return repository.save(version);
    }

    /**
     * Lưu từ Designer (workbook + script cùng lúc, UC-11 / UC-12) hoặc đổi ngày
     * áp dụng. Chỉ bản Nháp / Đang thử nghiệm (BR-11.2, BR-12.4, BR-13.2).
     */
    @Transactional
    public TemplateVersion update(Long id, TemplateVersionPatchRequest request) {
        TemplateVersion version = lockedVersion(id);
        if (!version.getStatus().editable()) {
            throw new ConflictException(
                    "Phiên bản này đã ban hành, đã khoá hoặc đã thu hồi nên không sửa được — "
                            + "hãy tạo phiên bản kế tiếp để thay đổi.");
        }
        // Kiểm tra hết rồi mới ghi.
        String workbook = request.workbookJson() != null ? requireWorkbook(request.workbookJson()) : null;
        if (request.effectiveFrom() != null) {
            requireAfterPrevious(version, request.effectiveFrom());
        }

        if (request.effectiveFrom() != null) {
            version.setEffectiveFrom(request.effectiveFrom());
        }
        if (workbook != null) {
            version.setWorkbookJson(workbook);
        }
        if (request.scriptText() != null) {
            version.setScriptText(request.scriptText());
        }
        return repository.save(version);
    }

    // --------------------------------------------------------------- thao tác

    /**
     * UC-13: ban hành. {@code effectiveFrom} (nếu có) được lưu cùng giao dịch với
     * đổi trạng thái — ngày sai thì cả hai cùng không lưu.
     */
    @Transactional
    public TemplateVersion publish(Long id, LocalDate effectiveFrom) {
        TemplateVersion version = lockedVersion(id);
        if (!version.getStatus().editable()) {
            throw new ConflictException("Chỉ ban hành được phiên bản đang nháp.");
        }
        LocalDate date = effectiveFrom != null ? effectiveFrom : version.getEffectiveFrom();
        if (date == null) {
            throw new ConflictException("Hãy chọn ngày áp dụng trước khi ban hành.");
        }
        TemplateVersion previous = version.getPreviousVersion();
        if (previous != null && previous.getStatus() == TemplateStatus.REVOKED) {
            throw new ConflictException(
                    "Không thể ban hành: bản nguồn của bản này không còn hiệu lực (đã thu hồi). "
                            + "Hãy xoá bản nháp này và tạo bản mới từ bản đang áp dụng.");
        }
        requireAfterPrevious(version, date);
        List<TemplateVersion> chain = repository.findByTemplateIdOrderByVersionNoAsc(version.getTemplate().getId());
        for (TemplateVersion other : chain) {
            boolean selectable = other.getStatus() == TemplateStatus.PUBLISHED
                    || other.getStatus() == TemplateStatus.LOCKED;
            if (!other.getId().equals(version.getId()) && selectable && date.equals(other.getEffectiveFrom())) {
                throw new ConflictException(
                        "Phiên bản %d của biểu đã áp dụng từ ngày %s — hãy chọn ngày khác."
                                .formatted(other.getVersionNo(), TemplateDates.format(date)));
            }
        }
        // UC-13 3d: phiên bản phải có đúng một trang bảng tính (BR-11.1).
        int sheets = sheetCount(version.getWorkbookJson());
        if (sheets == 0) {
            throw new ConflictException(
                    "Biểu chưa được thiết kế — hãy mở thiết kế, dựng bảng và lưu trước khi ban hành.");
        }
        if (sheets > 1) {
            throw new ConflictException(
                    "Mỗi phiên bản chỉ được có một trang bảng tính (hiện có %d trang) — hãy xoá bớt trang thừa trong thiết kế rồi lưu lại."
                            .formatted(sheets));
        }

        version.setEffectiveFrom(date);
        version.setStatus(TemplateStatus.PUBLISHED);
        version.setPublishedAt(Instant.now());
        version.setPublishedBy(currentUsername());
        repository.save(version);
        refreshEffectiveTo(version.getTemplate().getId());
        return version;
    }

    /**
     * Đưa bản nháp sang "Đang thử nghiệm" — nhãn cho người thiết kế biết bản này
     * đang được chạy thử, chưa ban hành. Nội dung vẫn sửa được, vẫn ban hành /
     * thu hồi như nháp (xem {@link TemplateStatus#TESTING}); phép chọn phiên bản
     * theo ngày vẫn bỏ qua. Bản Jmix không có thao tác nào tạo trạng thái này —
     * thêm ở bản mới theo yêu cầu màn Thiết kế mẫu, chờ BA xác nhận.
     */
    @Transactional
    public TemplateVersion startTesting(Long id) {
        TemplateVersion version = lockedVersion(id);
        if (version.getStatus() == TemplateStatus.TESTING) {
            return version;
        }
        if (version.getStatus() != TemplateStatus.DRAFT) {
            throw new ConflictException("Chỉ chuyển sang thử nghiệm được phiên bản đang nháp.");
        }
        version.setStatus(TemplateStatus.TESTING);
        return repository.save(version);
    }

    /** Ngược lại {@link #startTesting}: bản đang thử nghiệm trở về nháp. */
    @Transactional
    public TemplateVersion stopTesting(Long id) {
        TemplateVersion version = lockedVersion(id);
        if (version.getStatus() == TemplateStatus.DRAFT) {
            return version;
        }
        if (version.getStatus() != TemplateStatus.TESTING) {
            throw new ConflictException("Chỉ trả về nháp được phiên bản đang thử nghiệm.");
        }
        version.setStatus(TemplateStatus.DRAFT);
        return repository.save(version);
    }

    /**
     * UC-15: khoá. Chỉ bản đã ban hành MỚI NHẤT của biểu (khoá lần lượt từ trên
     * xuống) — khoá một bản cũ khi bản mới hơn còn dùng không đổi được gì cho các
     * đợt mới, chỉ gây khó hiểu. Phiếu đã ghim bản này vẫn nhập/duyệt bình thường.
     */
    @Transactional
    public TemplateVersion lock(Long id) {
        TemplateVersion version = lockedVersion(id);
        if (version.getStatus() == TemplateStatus.LOCKED) {
            return version;
        }
        if (version.getStatus() != TemplateStatus.PUBLISHED) {
            throw new ConflictException("Chỉ khoá được phiên bản đã ban hành.");
        }
        if (version.getEffectiveFrom() != null) {
            boolean newerPublished = repository.findByTemplateIdOrderByVersionNoAsc(version.getTemplate().getId())
                    .stream()
                    .anyMatch(other -> !other.getId().equals(version.getId())
                            && other.getStatus() == TemplateStatus.PUBLISHED
                            && other.getEffectiveFrom() != null
                            && other.getEffectiveFrom().isAfter(version.getEffectiveFrom()));
            if (newerPublished) {
                throw new ConflictException(
                        "Chỉ khoá được phiên bản đã ban hành mới nhất của biểu — hãy khoá lần lượt từ bản mới nhất xuống.");
            }
        }
        version.setStatus(TemplateStatus.LOCKED);
        repository.save(version);
        refreshEffectiveTo(version.getTemplate().getId());
        return version;
    }

    /** UC-15: mở khoá — trở lại Đã ban hành, giữ nguyên ngày áp dụng, người và ngày ban hành cũ. */
    @Transactional
    public TemplateVersion unlock(Long id) {
        TemplateVersion version = lockedVersion(id);
        if (version.getStatus() == TemplateStatus.PUBLISHED) {
            return version;
        }
        if (version.getStatus() != TemplateStatus.LOCKED) {
            throw new ConflictException("Chỉ mở khoá được phiên bản đang khoá.");
        }
        version.setStatus(TemplateStatus.PUBLISHED);
        repository.save(version);
        refreshEffectiveTo(version.getTemplate().getId());
        return version;
    }

    /**
     * UC-17: thu hồi bản ban hành nhầm — vĩnh viễn. Hệ thống tự lùi về bản đã ban
     * hành liền trước (vì phép chọn theo ngày chỉ xét bản đã ban hành).
     */
    @Transactional
    public TemplateVersion revoke(Long id) {
        TemplateVersion version = lockedVersion(id);
        Long templateId = version.getTemplate().getId();
        TemplateStatus status = version.getStatus();
        if (status == TemplateStatus.LOCKED) {
            throw new ConflictException("Phiên bản đang khoá — hãy mở khoá trước khi thu hồi.");
        }
        if (status != TemplateStatus.PUBLISHED && status != TemplateStatus.TESTING) {
            throw new ConflictException(
                    "Chỉ thu hồi được bản đã ban hành hoặc đang thử nghiệm; bản nháp thì xoá trực tiếp.");
        }
        List<TemplateVersion> chain = repository.findByTemplateIdOrderByVersionNoAsc(templateId);

        // Chuỗi không còn bản nháp/thử nghiệm KHÁC — kiểm tra trước "đỉnh chuỗi":
        // bản nháp thường chính là bản kế tiếp, và "xoá nháp trước" là chỉ dẫn làm được.
        boolean otherDraft = chain.stream()
                .anyMatch(other -> !other.getId().equals(version.getId()) && other.getStatus().editable());
        if (otherDraft) {
            throw new ConflictException(
                    "Biểu này đang có bản nháp/thử nghiệm khác — xoá hoặc xử lý bản đó trước khi thu hồi.");
        }
        if (repository.countByPreviousVersionIdAndStatusNot(version.getId(), TemplateStatus.REVOKED) > 0) {
            throw new ConflictException(
                    "Chỉ thu hồi được bản mới nhất của chuỗi — hãy thu hồi lần lượt từ bản mới nhất xuống.");
        }
        if (status == TemplateStatus.PUBLISHED) {
            boolean otherPublished = chain.stream()
                    .anyMatch(other -> !other.getId().equals(version.getId())
                            && other.getStatus() == TemplateStatus.PUBLISHED);
            if (!otherPublished) {
                throw new ConflictException(
                        "Không thể thu hồi bản đang áp dụng cuối cùng của biểu — nếu bản này sai, "
                                + "hãy tạo phiên bản kế tiếp để thay thế.");
            }
        }
        version.setStatus(TemplateStatus.REVOKED);
        version.setRevokedAt(Instant.now());
        version.setRevokedBy(currentUsername());
        repository.save(version);
        refreshEffectiveTo(templateId);
        return version;
    }

    /**
     * UC-14: tạo phiên bản kế tiếp từ đỉnh chuỗi — nhân bản workbook và script,
     * ngày áp dụng để trống, trạng thái Nháp. Không rẽ nhánh (BR-14.1).
     */
    @Transactional
    public TemplateVersion nextVersion(Long templateId) {
        Template template = templateService.lock(templateId);
        List<TemplateVersion> chain = repository.findByTemplateIdOrderByVersionNoAsc(templateId);
        if (chain.isEmpty()) {
            throw new ConflictException("Biểu này chưa có phiên bản nào — hãy tạo phiên bản đầu tiên.");
        }
        Optional<TemplateVersion> draft = chain.stream().filter(v -> v.getStatus().editable()).findFirst();
        if (draft.isPresent()) {
            throw new ConflictException(
                    "Biểu này đang có phiên bản nháp (phiên bản %d) — hãy mở phiên bản đó thay vì tạo thêm."
                            .formatted(draft.get().getVersionNo()));
        }
        TemplateVersion source = chain.stream()
                .filter(v -> v.getStatus() != TemplateStatus.REVOKED)
                .max(Comparator.comparingInt(TemplateVersion::getVersionNo))
                .orElseThrow(() -> new ConflictException(
                        "Biểu này không còn phiên bản nào đang dùng được để làm bản nguồn."));
        if (source.getStatus() == TemplateStatus.LOCKED) {
            throw new ConflictException(
                    "Phiên bản mới nhất của biểu đang khoá — hãy mở khoá trước khi tạo phiên bản kế tiếp.");
        }
        if (source.getStatus() != TemplateStatus.PUBLISHED) {
            throw new ConflictException("Chỉ tạo được phiên bản kế tiếp từ phiên bản đã ban hành.");
        }
        if (repository.countByPreviousVersionIdAndStatusNot(source.getId(), TemplateStatus.REVOKED) > 0) {
            throw new ConflictException("Phiên bản này đã có bản kế tiếp — không thể tạo thêm "
                    + "(tránh rẽ nhánh). Hãy tạo phiên bản kế tiếp từ bản mới nhất của chuỗi.");
        }

        int nextNo = chain.stream().mapToInt(TemplateVersion::getVersionNo).max().orElse(0) + 1;
        TemplateVersion copy = new TemplateVersion(template, nextNo, source);
        copy.setWorkbookJson(source.getWorkbookJson());
        // Mang theo script — không phải dán lại thủ công. Không đăng ký lại chỉ
        // tiêu (BR-14.3).
        copy.setScriptText(source.getScriptText());
        copy.setEffectiveFrom(null);
        return repository.save(copy);
    }

    /**
     * UC-16: xoá. Ở mọi trạng thái, miễn là bản mới nhất của chuỗi (không có bản
     * kế tiếp nào, kể cả đã thu hồi) và chưa nơi nào dùng. "Chưa nơi nào dùng" do
     * khoá ngoại RESTRICT của các bảng phiếu / thiết lập trả lời — slice này
     * không đọc bảng của slice khác.
     */
    @Transactional
    public TemplateVersion delete(Long id) {
        TemplateVersion version = lockedVersion(id);
        Long templateId = version.getTemplate().getId();
        if (repository.existsByPreviousVersionId(version.getId())) {
            throw new ConflictException(
                    "Không xoá được phiên bản này: đã có phiên bản mới hơn. Hãy xoá lần lượt từ phiên bản mới nhất xuống.");
        }
        try {
            repository.delete(version);
            repository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(
                    "Không xoá được phiên bản này: phiên bản đã được dùng để lập phiếu hoặc tổng hợp. "
                            + "Bạn chỉ có thể khoá lại để không dùng nữa.");
        }
        refreshEffectiveTo(templateId);
        return version;
    }

    // ------------------------------------------------------------------ phụ

    /**
     * Tính lại {@code effectiveTo} cho cả chuỗi: mỗi bản đã ban hành hết hiệu lực
     * một ngày trước bản đã ban hành kế sau; bản cuối và mọi bản không ở trạng
     * thái Đã ban hành để trống (BR-13.1 — không có ngày hết hạn do người nhập).
     */
    private void refreshEffectiveTo(Long templateId) {
        List<TemplateVersion> published = new ArrayList<>();
        for (TemplateVersion version : repository.findByTemplateIdOrderByVersionNoAsc(templateId)) {
            if (version.getStatus() == TemplateStatus.PUBLISHED && version.getEffectiveFrom() != null) {
                published.add(version);
            } else {
                version.setEffectiveTo(null);
            }
        }
        published.sort(Comparator.comparing(TemplateVersion::getEffectiveFrom).thenComparing(TemplateVersion::getId));
        for (int i = 0; i < published.size(); i++) {
            LocalDate end = i + 1 < published.size()
                    ? published.get(i + 1).getEffectiveFrom().minusDays(1)
                    : null;
            published.get(i).setEffectiveTo(end);
        }
    }

    /**
     * Khoá dòng biểu cha <em>trước</em> khi nạp phiên bản, để trạng thái đọc được
     * là trạng thái sau khi người thao tác trước đã ghi xong — nạp phiên bản trước
     * rồi mới khoá thì bản trong bộ nhớ có thể đã cũ.
     */
    private TemplateVersion lockedVersion(Long id) {
        Long templateId = repository.findTemplateIdById(id)
                .orElseThrow(() -> new TemplateNotFoundException("phiên bản mẫu", id));
        templateService.lock(templateId);
        return get(id);
    }

    /** BR-13.3: chỉ bản kế tiếp mới phải bắt đầu sau bản nguồn; bản đầu chuỗi tự do. */
    private void requireAfterPrevious(TemplateVersion version, LocalDate date) {
        TemplateVersion previous = version.getPreviousVersion();
        if (previous == null || previous.getEffectiveFrom() == null) {
            return;
        }
        if (!date.isAfter(previous.getEffectiveFrom())) {
            throw new ConflictException("Ngày áp dụng phải từ %s trở đi."
                    .formatted(TemplateDates.format(previous.getEffectiveFrom().plusDays(1))));
        }
    }

    /**
     * UC-11 4a: workbook phải là một đối tượng JSON có ít nhất một trang bảng
     * tính. Trang chữ mờ "Evaluation Version" của bản dùng thử SpreadJS bị cắt
     * trước khi lưu (UC-11 4b) — để lọt vào thì mọi phiếu lập từ mẫu đều mang nó.
     */
    String requireWorkbook(String json) {
        JsonNode node;
        try {
            node = mapper.readTree(json);
        } catch (JacksonException e) {
            node = null;
        }
        if (node == null || !node.isObject()) {
            throw new ConflictException("Bảng tính gửi lên không hợp lệ — hãy mở lại thiết kế và lưu lại.");
        }
        JsonNode sheets = node.path("sheets");
        if (sheets.isObject() && sheets.has(EVALUATION_SHEET)) {
            ((ObjectNode) sheets).remove(EVALUATION_SHEET);
            ((ObjectNode) node).put("sheetCount", sheets.size());
            json = mapper.writeValueAsString(node);
        }
        if (!sheets.isObject() || sheets.size() == 0) {
            throw new ConflictException("Bảng tính chưa có trang nào — hãy dựng bảng trong thiết kế rồi lưu lại.");
        }
        return json;
    }

    /** Số trang bảng tính trong workbook đã lưu; JSON hỏng hoặc chưa thiết kế ({@code "{}"}) → 0. */
    int sheetCount(String json) {
        if (json == null || json.isBlank()) {
            return 0;
        }
        try {
            JsonNode sheets = mapper.readTree(json).path("sheets");
            if (!sheets.isObject()) {
                return 0;
            }
            return sheets.has(EVALUATION_SHEET) ? sheets.size() - 1 : sheets.size();
        } catch (JacksonException e) {
            return 0;
        }
    }

    private static String currentUsername() {
        return CurrentUser.username().orElse(null);
    }
}
