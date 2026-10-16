package com.dth.frw.module.asxh.home.repo;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.ReportStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Fetch;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

/**
 * Truy vấn chỉ đọc của trang chủ.
 *
 * <p>Không dùng {@code InputReportRepository} của slice phiếu nhập: trang chủ cần nạp cả năm
 * kèm đơn vị, kỳ, đợt trong MỘT câu (fetch join) và đọc tờ biểu dạng cột rời, hai đường mà
 * repository đó không có. Viết bằng {@link EntityManager} thay vì một Spring Data repository
 * thứ hai để không vướng việc Spring Data tự đổi câu {@code select p} thành phép chiếu DTO khi
 * kiểu trả về khác thực thể gốc.
 *
 * <p>Phạm vi dữ liệu: phiếu luôn được lọc qua {@code Specification} phạm vi đọc do service
 * truyền vào (từ {@code RowLevelSecurity.scope}) — thứ tự như các slice khác: phạm vi trước, điều
 * kiện màn sau. Kỳ không thuộc quyền quản lý theo dòng nên không lọc. Tờ biểu đọc theo năm rồi
 * service bỏ những tờ của phiếu ngoài phạm vi.
 */
@Repository
public class HomeDashboardQueries {

    private final EntityManager entityManager;

    public HomeDashboardQueries(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Năm có kỳ báo cáo nào không (UC-75 1a). */
    public boolean hasPeriods(int year) {
        Long count = entityManager.createQuery(
                        "select count(p) from ReportPeriod p where p.calendar.year = :year", Long.class)
                .setParameter("year", year)
                .getSingleResult();
        return count != null && count > 0;
    }

    /** Kỳ của năm ở các trạng thái cho trước, cũ trước. */
    public List<ReportPeriod> periodsByStatus(int year, Collection<PeriodStatus> statuses) {
        if (statuses.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery(
                        "select p from ReportPeriod p join fetch p.calendar c "
                                + "where c.year = :year and p.status in :statuses "
                                + "order by p.fromDate asc, p.id asc", ReportPeriod.class)
                .setParameter("year", year)
                .setParameter("statuses", statuses)
                .getResultList();
    }

    /**
     * Phiếu của năm ở các trạng thái cho trước, trong phạm vi {@code scope}; đơn vị, kỳ (kèm lịch)
     * và đợt nạp cùng câu.
     */
    public List<InputReport> reportsOfYear(int year, Collection<ReportStatus> statuses,
                                           Specification<InputReport> scope) {
        if (statuses.isEmpty()) {
            return List.of();
        }
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<InputReport> query = cb.createQuery(InputReport.class);
        Root<InputReport> root = query.from(InputReport.class);
        root.fetch("unit");
        Fetch<InputReport, ReportPeriod> period = root.fetch("period");
        period.fetch("calendar");
        root.fetch("publication");

        List<Predicate> predicates = new ArrayList<>();
        if (scope != null) {
            Predicate scoped = scope.toPredicate(root, query, cb);
            if (scoped != null) {
                predicates.add(scoped);
            }
        }
        predicates.add(cb.equal(root.get("period").get("calendar").get("year"), year));
        predicates.add(root.get("status").in(statuses));
        query.select(root).where(predicates.toArray(Predicate[]::new));

        return entityManager.createQuery(query).getResultList();
    }

    /**
     * Tờ biểu của các phiếu thuộc năm ở các trạng thái cho trước, dạng cột rời — mỗi dòng
     * {@code [reportId, shortName, name, sortOrder, completion]}. Không lọc phạm vi: service giữ
     * lại đúng những tờ của phiếu đã qua phạm vi ở {@link #reportsOfYear}.
     */
    public List<Object[]> sheetRowsOfYear(int year, Collection<ReportStatus> statuses) {
        if (statuses.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery(
                        "select r.id, t.shortName, t.name, t.sortOrder, s.completion "
                                + "from InputReportSheet s join s.report r join s.template t "
                                + "join r.period p join p.calendar c "
                                + "where c.year = :year and r.status in :statuses", Object[].class)
                .setParameter("year", year)
                .setParameter("statuses", statuses)
                .getResultList();
    }
}
