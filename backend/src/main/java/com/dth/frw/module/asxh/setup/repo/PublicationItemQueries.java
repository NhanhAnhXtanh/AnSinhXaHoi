package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.stereotype.Repository;

/**
 * Truy vấn CHỈ ĐỌC cho chi tiết đợt (UC-30) trên bảng của các slice khác (phiếu, tờ biểu, đơn vị,
 * mẫu, nhật ký ghi số liệu) — viết bằng {@link EntityManager} và phép chiếu như
 * {@code SummaryQueries}, để không mở rộng repository của slice khác và không nạp thực thể nặng
 * (workbook của phiên bản mẫu, số liệu của tờ biểu).
 *
 * <p>Mỗi phương thức là MỘT câu SQL cho cả kỳ hoặc cả lô id — chi tiết đợt không truy vấn theo
 * từng dòng.
 */
@Repository
public class PublicationItemQueries {

    public record PublicationRow(Long id, int publicationNo, PublicationKind kind, PublicationStatus status,
                                 Instant createdAt) {
    }

    public record ReportRow(Long id, Long unitId, Long publicationId, int revisionNo, Long previousRevisionId,
                            ReportStatus status, Instant approvedAt, Instant createdAt) {
    }

    public record SheetRow(Long id, Long reportId, Long templateId, Long templateVersionId,
                           SheetCompletion completion, Instant dataUpdatedAt, String dataUpdatedBy,
                           Instant completedAt, String completedBy, Instant createdAt) {
    }

    public record UnitRow(Long id, String name, ReportBlock block) {
    }

    public record TemplateRow(Long id, String shortName, String name, int sortOrder) {
    }

    public record AuditRow(Long reportId, Long templateId, LedgerWriteAudit.Result result, int linesAdded,
                           int linesUpdated, int linesRemoved, String failReason, Instant operatedAt,
                           String operatedBy) {
    }

    private final EntityManager entityManager;

    public PublicationItemQueries(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Mọi đợt của kỳ, kể cả đợt đã thu hồi. */
    public List<PublicationRow> publications(Long periodId) {
        List<Object[]> rows = entityManager.createQuery(
                        "select p.id, p.publicationNo, p.kind, p.status, p.createdAt from Publication p "
                                + "where p.period.id = :periodId", Object[].class)
                .setParameter("periodId", periodId)
                .getResultList();
        List<PublicationRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new PublicationRow((Long) row[0], ((Number) row[1]).intValue(), (PublicationKind) row[2],
                    (PublicationStatus) row[3], (Instant) row[4]));
        }
        return result;
    }

    /** Mọi phiếu (mọi phiên bản) của kỳ. */
    public List<ReportRow> reports(Long periodId) {
        List<Object[]> rows = entityManager.createQuery(
                        "select r.id, r.unit.id, r.publication.id, r.revisionNo, r.previousRevisionId, r.status, "
                                + "r.approvedAt, r.createdAt from InputReport r where r.period.id = :periodId",
                        Object[].class)
                .setParameter("periodId", periodId)
                .getResultList();
        List<ReportRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new ReportRow((Long) row[0], (Long) row[1], (Long) row[2], ((Number) row[3]).intValue(),
                    (Long) row[4], (ReportStatus) row[5], (Instant) row[6], (Instant) row[7]));
        }
        return result;
    }

    /** Mọi tờ biểu của các phiếu thuộc kỳ — không đọc cột số liệu. */
    public List<SheetRow> sheets(Long periodId) {
        List<Object[]> rows = entityManager.createQuery(
                        "select s.id, r.id, s.template.id, s.templateVersionId, s.completion, s.dataUpdatedAt, "
                                + "s.dataUpdatedBy, s.completedAt, s.completedBy, s.createdAt "
                                + "from InputReportSheet s join s.report r where r.period.id = :periodId",
                        Object[].class)
                .setParameter("periodId", periodId)
                .getResultList();
        List<SheetRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new SheetRow((Long) row[0], (Long) row[1], (Long) row[2], (Long) row[3],
                    (SheetCompletion) row[4], (Instant) row[5], (String) row[6], (Instant) row[7],
                    (String) row[8], (Instant) row[9]));
        }
        return result;
    }

    public List<UnitRow> units(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Object[]> rows = entityManager.createQuery(
                        "select u.id, u.name, u.block from ReportUnit u where u.id in :ids", Object[].class)
                .setParameter("ids", ids)
                .getResultList();
        List<UnitRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new UnitRow((Long) row[0], (String) row[1], (ReportBlock) row[2]));
        }
        return result;
    }

    public List<TemplateRow> templates(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Object[]> rows = entityManager.createQuery(
                        "select t.id, t.shortName, t.name, t.sortOrder from Template t where t.id in :ids",
                        Object[].class)
                .setParameter("ids", ids)
                .getResultList();
        List<TemplateRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new TemplateRow((Long) row[0], (String) row[1], (String) row[2],
                    ((Number) row[3]).intValue()));
        }
        return result;
    }

    /** Số thứ tự phiên bản mẫu theo id — không nạp workbook. */
    public List<Object[]> versionNumbers(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery(
                        "select v.id, v.versionNo from TemplateVersion v where v.id in :ids", Object[].class)
                .setParameter("ids", ids)
                .getResultList();
    }

    /**
     * Nhật ký ghi số liệu của mọi phiếu thuộc kỳ, cũ trước. Nhật ký không có khoá ngoại tới phiếu,
     * nên lọc theo id phiếu còn trong kỳ.
     */
    public List<AuditRow> audits(Long periodId) {
        List<Object[]> rows = entityManager.createQuery(
                        "select a.reportId, a.templateId, a.result, a.linesAdded, a.linesUpdated, a.linesRemoved, "
                                + "a.failReason, a.operatedAt, a.operatedBy from LedgerWriteAudit a "
                                + "where a.reportId in (select r.id from InputReport r where r.period.id = :periodId) "
                                + "order by a.operatedAt asc, a.id asc", Object[].class)
                .setParameter("periodId", periodId)
                .getResultList();
        List<AuditRow> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new AuditRow((Long) row[0], (Long) row[1], (LedgerWriteAudit.Result) row[2],
                    ((Number) row[3]).intValue(), ((Number) row[4]).intValue(), ((Number) row[5]).intValue(),
                    (String) row[6], (Instant) row[7], (String) row[8]));
        }
        return result;
    }
}
