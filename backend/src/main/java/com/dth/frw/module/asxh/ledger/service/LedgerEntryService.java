package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerEntryResponse;
import com.dth.frw.module.asxh.ledger.repo.LedgerEntryRepository;
import com.dth.frw.module.asxh.ledger.repo.LedgerEntrySpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đọc số liệu đã lưu cho REST {@code /api/ledger_entries} — xem số liệu của MỘT phiếu (mọi dòng
 * đã ghi, không lọc hiệu lực). Tổng hợp không dùng lớp này mà dùng {@code EffectiveLedgerQuery}.
 *
 * <p>Ánh xạ sang DTO ngay trong giao dịch vì mọi quan hệ của dòng đều LAZY
 * ({@code open-in-view=false}).
 */
@Service
@Transactional(readOnly = true)
public class LedgerEntryService {

    private static final Set<String> SORTABLE = Set.of("id", "indicatorCode", "orderNo", "createdAt");

    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.asc("template.sortOrder"), Sort.Order.asc("template.id"),
            Sort.Order.asc("orderNo"), Sort.Order.asc("indicatorCode"), Sort.Order.asc("id"));

    private final LedgerEntryRepository repository;
    private final RowLevelSecurity rowLevel;

    public LedgerEntryService(LedgerEntryRepository repository, RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.rowLevel = rowLevel;
    }

    public Page<LedgerEntryResponse> list(ListParams params) {
        return repository.findAll(
                        rowLevel.scope(LedgerEntry.class, Action.READ).and(LedgerEntrySpecifications.from(params)),
                        params.pageable(SORTABLE, DEFAULT_SORT))
                .map(LedgerEntryResponse::from);
    }

    public LedgerEntryResponse get(Long id) {
        return repository.findOne(rowLevel.byId(LedgerEntry.class, Action.READ, id))
                .map(LedgerEntryResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("LedgerEntry", id));
    }

    public List<LedgerEntryResponse> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(LedgerEntry.class, Action.READ, ids)).stream()
                .map(LedgerEntryResponse::from)
                .toList();
    }
}
