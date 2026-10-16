package com.dth.frw.module.asxh.template.service;

import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetPatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRequest;
import com.dth.frw.module.asxh.template.repo.TemplateRepository;
import com.dth.frw.module.asxh.template.repo.TemplateSetRepository;
import com.dth.frw.module.asxh.template.repo.TemplateSetSpecifications;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.web.ListParams;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bộ mẫu (UC-09). Port từ {@code TemplateSetView} + {@code QtReportTemplateEntityListener}.
 */
@Service
@Transactional(readOnly = true)
public class TemplateSetService {

    private static final Set<String> SORTABLE = Set.of("id", "name", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));

    /** Số biểu và cờ "đang sử dụng" của một bộ mẫu. */
    public record SetStats(long templateCount, boolean inUse) {
        static final SetStats EMPTY = new SetStats(0, false);
    }

    private final TemplateSetRepository repository;

    // Cùng slice nên đọc thẳng repository của biểu — chỉ để đếm khi xoá.
    private final TemplateRepository templateRepository;

    public TemplateSetService(TemplateSetRepository repository, TemplateRepository templateRepository) {
        this.repository = repository;
        this.templateRepository = templateRepository;
    }

    public Page<TemplateSet> list(ListParams params) {
        return repository.findAll(TemplateSetSpecifications.from(params), params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public TemplateSet get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new TemplateNotFoundException("bộ mẫu", id));
    }

    public List<TemplateSet> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /** Số biểu + "đang sử dụng" cho các bộ mẫu đang hiện, gói trong hai truy vấn. */
    public Map<Long, SetStats> stats(Collection<Long> setIds) {
        Map<Long, SetStats> result = new HashMap<>();
        if (setIds.isEmpty()) {
            return result;
        }
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : repository.countTemplatesBySet(setIds)) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        Set<Long> inUse = new HashSet<>(repository.setIdsWithVersionStatus(setIds, TemplateStatus.PUBLISHED));
        for (Long id : setIds) {
            result.put(id, new SetStats(counts.getOrDefault(id, 0L), inUse.contains(id)));
        }
        return result;
    }

    public SetStats stats(Long setId) {
        return stats(List.of(setId)).getOrDefault(setId, SetStats.EMPTY);
    }

    @Transactional
    public TemplateSet create(TemplateSetRequest request) {
        String name = request.name().trim();
        requireNameAvailable(name, null);
        return repository.save(new TemplateSet(name, trimToNull(request.description())));
    }

    @Transactional
    public TemplateSet update(Long id, TemplateSetPatchRequest request) {
        TemplateSet set = get(id);
        // Kiểm tra trước khi ghi vào entity — xem DepartmentService.update.
        String name = request.name() != null ? request.name().trim() : null;
        if (name != null) {
            requireNameAvailable(name, set.getId());
        }
        if (name != null) {
            set.setName(name);
        }
        if (request.description() != null) {
            set.setDescription(trimToNull(request.description()));
        }
        return repository.save(set);
    }

    @Transactional
    public TemplateSet delete(Long id) {
        TemplateSet set = get(id);
        long templates = templateRepository.countByTemplateSetId(id);
        if (templates > 0) {
            throw new ConflictException(
                    "Không xoá được bộ mẫu này: đang có %d biểu. Hãy xoá từng biểu trước (biểu đã ban hành không xoá được)."
                            .formatted(templates));
        }
        repository.delete(set);
        return set;
    }

    private void requireNameAvailable(String name, Long selfId) {
        repository.findFirstByNameIgnoreCase(name).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Tên bộ mẫu đã tồn tại.");
            }
        });
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
