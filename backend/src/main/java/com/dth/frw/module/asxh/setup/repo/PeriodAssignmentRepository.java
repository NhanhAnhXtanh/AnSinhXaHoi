package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.shared.data.SecuredRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * A {@link SecuredRepository}. Các truy vấn khai thêm phục vụ luật nghiệp vụ của ma trận và
 * phải thấy mọi thiết lập của kỳ, không phụ thuộc người gọi: kiểm trùng kỳ mà không thấy dòng
 * đang kiểm thì không còn là kiểm trùng.
 */
public interface PeriodAssignmentRepository extends SecuredRepository<PeriodAssignment, Long> {

    @Query("select a from PeriodAssignment a where a.period.id = :periodId order by a.id")
    List<PeriodAssignment> findByPeriodId(@Param("periodId") Long periodId);

    @Query("select count(a) from PeriodAssignment a where a.period.id = :periodId")
    long countByPeriodId(@Param("periodId") Long periodId);

    /**
     * Thiết lập của các đơn vị cho trước ở kỳ KHÁC có thời gian giao với
     * {@code [fromDate, toDate]} — luật chống chồng kỳ theo đơn vị (BR-22.2).
     */
    @Query("select a from PeriodAssignment a where a.unit.id in :unitIds and a.period.id <> :periodId "
            + "and a.period.fromDate <= :toDate and a.period.toDate >= :fromDate")
    List<PeriodAssignment> findOverlapping(@Param("unitIds") Collection<Long> unitIds,
                                           @Param("periodId") Long periodId,
                                           @Param("fromDate") LocalDate fromDate,
                                           @Param("toDate") LocalDate toDate);
}
