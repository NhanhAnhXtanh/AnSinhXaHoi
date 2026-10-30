package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.module.asxh.ledger.security.LedgerPermissions;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.Item;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.LedgerRef;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.LedgerWrite;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.AuditRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.TemplateRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.UnitRow;
import com.dth.frw.module.asxh.unit.security.ReportUnitAccountScope;
import com.dth.frw.shared.security.CurrentUser;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chi tiết một đợt mở (UC-30): các dòng đơn vị × biểu mà đợt đã phát, kèm phiếu hiện tại, tình
 * trạng biểu, lần lưu cuối và lần ghi số liệu gần nhất.
 *
 * <p>Đọc cả kỳ của đợt trong một số câu cố định (đợt, phiếu, tờ biểu, đơn vị, mẫu, phiên bản,
 * nhật ký ghi) rồi gán biểu về đợt trong bộ nhớ ({@link PublicationItemAssembler}) — không truy
 * vấn theo từng dòng.
 */
@Service
@Transactional(readOnly = true)
public class PublicationItemService {

    private static final Collator VIETNAMESE = Collator.getInstance(Locale.forLanguageTag("vi"));

    private final PublicationService publications;
    private final PublicationItemQueries queries;
    // null chỉ ở test dựng tay — khi đó không lọc theo đơn vị.
    private final ReportUnitAccountScope accountScope;

    public PublicationItemService(PublicationService publications,
                                  PublicationItemQueries queries,
                                  ReportUnitAccountScope accountScope) {
        this.publications = publications;
        this.queries = queries;
        this.accountScope = accountScope;
    }

    /**
     * Dòng chi tiết của đợt. Lần ghi số liệu chỉ trả cho người có quyền đọc số liệu đã lưu.
     *
     * @throws com.dth.frw.shared.exception.ResourceNotFoundException đợt không có / ngoài phạm vi
     */
    public PublicationItemsResponse items(Long publicationId) {
        return items(publicationId, CurrentUser.has(LedgerPermissions.LEDGER_ENTRIES_READ));
    }

    PublicationItemsResponse items(Long publicationId, boolean includeLedger) {
        Publication publication = publications.get(publicationId);
        Long periodId = publication.getPeriod().getId();

        List<PublicationItemQueries.PublicationRow> periodPublications = queries.publications(periodId);
        List<PublicationItemAssembler.Assigned> assigned = PublicationItemAssembler.assign(
                publicationId, periodPublications, queries.reports(periodId), queries.sheets(periodId));

        // Tài khoản cấp đơn vị (nếu được cấp quyền xem đợt) chỉ thấy dòng của đơn vị mình (UC-72).
        ReportUnitAccountScope.Restriction scope = accountScope == null ? null : accountScope.current();
        if (scope != null && !scope.unrestricted()) {
            assigned = assigned.stream().filter(a -> scope.allows(a.first().unitId())).toList();
        }

        Set<Long> unitIds = new LinkedHashSet<>();
        Set<Long> templateIds = new LinkedHashSet<>();
        Set<Long> versionIds = new LinkedHashSet<>();
        for (PublicationItemAssembler.Assigned a : assigned) {
            unitIds.add(a.first().unitId());
            templateIds.add(a.templateId());
            if (a.current().templateVersionId() != null) {
                versionIds.add(a.current().templateVersionId());
            }
        }
        Map<Long, UnitRow> units = new HashMap<>();
        for (UnitRow unit : queries.units(unitIds)) {
            units.put(unit.id(), unit);
        }
        Map<Long, TemplateRow> templates = new HashMap<>();
        for (TemplateRow template : queries.templates(templateIds)) {
            templates.put(template.id(), template);
        }
        Map<Long, Integer> versionNo = new HashMap<>();
        for (Object[] row : queries.versionNumbers(versionIds)) {
            versionNo.put((Long) row[0], ((Number) row[1]).intValue());
        }
        Map<Long, Integer> publicationNo = new HashMap<>();
        for (PublicationItemQueries.PublicationRow row : periodPublications) {
            publicationNo.put(row.id(), row.publicationNo());
        }
        List<AuditRow> audits = includeLedger && !assigned.isEmpty() ? queries.audits(periodId) : List.of();

        List<Item> items = new ArrayList<>(assigned.size());
        for (PublicationItemAssembler.Assigned a : assigned) {
            UnitRow unit = units.get(a.first().unitId());
            TemplateRow template = templates.get(a.templateId());
            Long versionId = a.current().templateVersionId();
            LedgerRef ledger = null;
            if (includeLedger) {
                PublicationItemAssembler.LedgerSummary summary = PublicationItemAssembler.ledger(a, audits);
                ledger = new LedgerRef(write(summary.lastSuccess()), write(summary.lastFailure()));
            }
            items.add(new Item(
                    new PublicationItemsResponse.UnitRef(a.first().unitId(),
                            unit == null ? null : unit.name(), unit == null ? null : unit.block()),
                    new PublicationItemsResponse.TemplateRef(a.templateId(),
                            template == null ? null : template.shortName(), template == null ? null : template.name()),
                    new PublicationItemsResponse.VersionRef(versionId, versionNo.get(versionId)),
                    a.delivery(),
                    publicationNo.getOrDefault(a.first().publicationId(), 0),
                    a.original().createdAt(),
                    a.derived(),
                    new PublicationItemsResponse.ReportRef(a.latest().id(), a.first().id(), a.latest().revisionNo(),
                            a.latest().status(), a.latest().approvedAt()),
                    new PublicationItemsResponse.SheetRef(a.current().id(), a.current().completion(),
                            a.current().dataUpdatedAt(), a.current().dataUpdatedBy(), a.current().completedAt(),
                            a.current().completedBy()),
                    ledger));
        }

        Map<Long, Integer> sortOrder = new HashMap<>();
        templates.values().forEach(t -> sortOrder.put(t.id(), t.sortOrder()));
        items.sort(Comparator
                .comparing((Item i) -> i.unit().name() == null ? "" : i.unit().name(), VIETNAMESE)
                .thenComparing(i -> i.unit().id())
                .thenComparing(i -> sortOrder.getOrDefault(i.template().id(), Integer.MAX_VALUE))
                .thenComparing(i -> i.template().shortName() == null ? "" : i.template().shortName())
                .thenComparing(i -> i.template().id()));
        return new PublicationItemsResponse(publicationId, items);
    }

    private static LedgerWrite write(AuditRow audit) {
        if (audit == null) {
            return null;
        }
        return new LedgerWrite(audit.operatedAt(), audit.operatedBy(), audit.linesAdded(), audit.linesUpdated(),
                audit.linesRemoved(), audit.failReason());
    }
}
