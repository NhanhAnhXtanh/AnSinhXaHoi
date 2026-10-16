package com.dth.frw.module.asxh.summary.repo;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.summary.query.UnitNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Repository;

/**
 * Truy vấn CHỈ ĐỌC mà phần tổng hợp cần trên bảng của các slice khác (kỳ, đơn vị, thiết lập, phiếu,
 * mẫu biểu) — viết bằng {@link EntityManager} và phép chiếu như {@code HomeDashboardQueries}, để
 * không phải mở rộng repository của slice khác và không nạp thực thể nặng (workbook).
 *
 * <p>Số liệu đã duyệt KHÔNG đọc ở đây mà qua {@code EffectiveLedgerQuery} của slice số liệu.
 *
 * <p>Mọi quan hệ tuỳ chọn dùng {@code left join} tường minh — {@code u.parent.id} trong JPQL là
 * phép nối TRONG ngầm và làm rơi đơn vị gốc.
 */
@Repository
public class SummaryQueries {

    /** Phiếu không còn là bản hiện hành của đơn vị — không tính "được giao / đã nộp". */
    private static final Set<ReportStatus> NOT_CURRENT = Set.of(ReportStatus.SUPERSEDED, ReportStatus.CANCELLED);

    private final EntityManager entityManager;

    public SummaryQueries(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    // ------------------------------------------------------------------ đơn vị

    /** Mọi đơn vị (kể cả đã ngừng — số liệu lịch sử vẫn thuộc kỳ cũ), xếp theo mã. */
    public List<UnitNode> units() {
        List<Object[]> rows = entityManager.createQuery(
                        "select u.id, u.budgetCode, u.name, p.id, u.unitType, u.block "
                                + "from ReportUnit u left join u.parent p order by u.budgetCode", Object[].class)
                .getResultList();
        List<UnitNode> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            result.add(new UnitNode((Long) row[0], (String) row[1], (String) row[2], (Long) row[3],
                    (ReportUnitType) row[4], (ReportBlock) row[5]));
        }
        return result;
    }

    // ------------------------------------------------------------------ kỳ

    /** Kỳ của năm (theo lịch), cũ trước. */
    public List<ReportPeriod> periodsOfYear(int year) {
        return entityManager.createQuery(
                        "select p from ReportPeriod p join fetch p.calendar c where c.year = :year "
                                + "order by p.fromDate asc, p.toDate desc, p.id asc", ReportPeriod.class)
                .setParameter("year", year)
                .getResultList();
    }

    /** Năm có lịch báo cáo, mới trước. */
    public List<Integer> calendarYears() {
        return entityManager.createQuery(
                        "select c.year from ReportCalendar c order by c.year desc", Integer.class)
                .getResultList();
    }

    /**
     * Mọi kỳ (mọi loại) nằm GỌN trong {@code [from, to]}, bỏ kỳ đã huỷ — port
     * {@code PeriodResolutionService.resolvePeriodIdsInRange}. Khoảng rỗng = danh sách rỗng, không lỗi.
     */
    public List<Long> periodIdsInRange(LocalDate from, LocalDate to) {
        return entityManager.createQuery(
                        "select p.id from ReportPeriod p where p.fromDate >= :from and p.toDate <= :to "
                                + "and p.status <> :cancelled order by p.fromDate, p.id", Long.class)
                .setParameter("from", from)
                .setParameter("to", to)
                .setParameter("cancelled", PeriodStatus.CANCELLED)
                .getResultList();
    }

    /** Ngày đầu của từng kỳ — thứ tự cho phép "lấy kỳ mới nhất". */
    public Map<Long, LocalDate> periodStarts(Collection<Long> periodIds) {
        Map<Long, LocalDate> result = new HashMap<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        for (Object[] row : entityManager.createQuery(
                        "select p.id, p.fromDate from ReportPeriod p where p.id in :ids", Object[].class)
                .setParameter("ids", periodIds)
                .getResultList()) {
            result.put((Long) row[0], (LocalDate) row[1]);
        }
        return result;
    }

    // ------------------------------------------------------------------ thiết lập + phiếu

    /** Biểu đã thiết lập cho kỳ, theo thứ tự tab của bộ mẫu. */
    public List<Template> assignedTemplates(Long periodId) {
        List<Template> templates = new ArrayList<>(entityManager.createQuery(
                        "select distinct t from PeriodAssignment a join a.template t where a.period.id = :periodId",
                        Template.class)
                .setParameter("periodId", periodId)
                .getResultList());
        templates.sort(Comparator.comparingInt(Template::getSortOrder).thenComparing(Template::getId));
        return templates;
    }

    /** Số đơn vị được thiết lập (giao biểu) của từng kỳ. */
    public Map<Long, Long> assignedUnitCounts(Collection<Long> periodIds) {
        Map<Long, Long> result = new HashMap<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        for (Object[] row : entityManager.createQuery(
                        "select a.period.id, count(distinct a.unit.id) from PeriodAssignment a "
                                + "where a.period.id in :ids group by a.period.id", Object[].class)
                .setParameter("ids", periodIds)
                .getResultList()) {
            result.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return result;
    }

    /** Một phiếu hiện hành (không phải bản cũ / đã huỷ) dạng phẳng. */
    public record ReportRow(Long reportId, Long periodId, Long unitId, String unitName, ReportStatus status,
                            int revisionNo, Instant approvedAt) {

        /** Phiếu còn hiệu lực số liệu: đã duyệt, hoặc khoá sau khi duyệt (BR-50.1). */
        public boolean effective() {
            return status == ReportStatus.APPROVED || (status == ReportStatus.LOCKED && approvedAt != null);
        }
    }

    /** Phiếu hiện hành của các kỳ. */
    public List<ReportRow> currentReports(Collection<Long> periodIds) {
        List<ReportRow> result = new ArrayList<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        for (Object[] row : entityManager.createQuery(
                        "select r.id, r.period.id, u.id, u.name, r.status, r.revisionNo, r.approvedAt "
                                + "from InputReport r join r.unit u "
                                + "where r.period.id in :ids and r.status not in :excluded "
                                + "order by u.name, r.id", Object[].class)
                .setParameter("ids", periodIds)
                .setParameter("excluded", NOT_CURRENT)
                .getResultList()) {
            result.add(new ReportRow((Long) row[0], (Long) row[1], (Long) row[2], (String) row[3],
                    (ReportStatus) row[4], ((Number) row[5]).intValue(), (Instant) row[6]));
        }
        return result;
    }

    /**
     * Đơn vị ĐƯỢC GIAO biểu trong tập kỳ (kể cả chưa nộp) — đọc từ tờ biểu của phiếu hiện hành
     * (port {@code SummaryReportService.assignedOrganizations}).
     *
     * @param templateCode mã nội bộ biểu; rỗng = không lọc
     * @param shortName    tên ngắn biểu ("1a"); rỗng = không lọc. Bỏ trống cả hai = mọi đơn vị có phiếu
     */
    public List<UnitNode> assignedUnits(Collection<Long> periodIds, String templateCode, String shortName) {
        List<UnitNode> result = new ArrayList<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        boolean byCode = templateCode != null && !templateCode.isBlank();
        boolean byShort = shortName != null && !shortName.isBlank();
        TypedQuery<Object[]> query = entityManager.createQuery(
                "select distinct u.id, u.budgetCode, u.name, p.id, u.unitType, u.block "
                        + "from InputReportSheet s join s.report r join r.unit u left join u.parent p "
                        + "join s.template t "
                        + "where r.period.id in :ids and r.status not in :excluded"
                        + (byCode ? " and t.code = :code" : "")
                        + (byShort ? " and lower(t.shortName) = :shortName" : ""),
                Object[].class)
                .setParameter("ids", periodIds)
                .setParameter("excluded", NOT_CURRENT);
        if (byCode) {
            query.setParameter("code", templateCode.trim());
        }
        if (byShort) {
            query.setParameter("shortName", shortName.trim().toLowerCase(Locale.ROOT));
        }
        for (Object[] row : query.getResultList()) {
            result.add(new UnitNode((Long) row[0], (String) row[1], (String) row[2], (Long) row[3],
                    (ReportUnitType) row[4], (ReportBlock) row[5]));
        }
        result.sort(Comparator.comparing(UnitNode::budgetCode));
        return result;
    }

    // ------------------------------------------------------------------ mẫu biểu

    public Optional<Template> templateByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        return entityManager.createQuery("select t from Template t where t.code = :code", Template.class)
                .setParameter("code", code.trim())
                .getResultStream()
                .findFirst();
    }

    /** Biểu một loại có ít nhất một bản đã ban hành (biểu tổng hợp năm: {@link TemplateKind#TONG_HOP}). */
    public List<Template> publishedTemplatesOfKind(TemplateKind kind) {
        List<Template> templates = new ArrayList<>(entityManager.createQuery(
                        "select distinct t from TemplateVersion v join v.template t "
                                + "where t.kind = :kind and v.status = :published", Template.class)
                .setParameter("kind", kind)
                .setParameter("published", TemplateStatus.PUBLISHED)
                .getResultList());
        templates.sort(Comparator.comparingInt(Template::getSortOrder).thenComparing(Template::getId));
        return templates;
    }

    /** Lần duyệt gần nhất trong từng kỳ. */
    public Map<Long, Instant> lastApprovals(Collection<Long> periodIds) {
        Map<Long, Instant> result = new LinkedHashMap<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        for (Object[] row : entityManager.createQuery(
                        "select r.period.id, max(r.approvedAt) from InputReport r "
                                + "where r.period.id in :ids and r.approvedAt is not null group by r.period.id",
                        Object[].class)
                .setParameter("ids", periodIds)
                .getResultList()) {
            result.put((Long) row[0], (Instant) row[1]);
        }
        return result;
    }
}
