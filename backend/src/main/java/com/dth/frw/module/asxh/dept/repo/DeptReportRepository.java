package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptReport;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeptReportRepository extends JpaRepository<DeptReport, Long> {

    Optional<DeptReport> findByPeriodId(Long periodId);

    List<DeptReport> findByPeriodIdIn(Collection<Long> periodIds);

    @Query("select d from DeptReport d join fetch d.period p where d.reportYear = :year order by p.fromDate, p.id")
    List<DeptReport> findByYear(@Param("year") int year);

    /** Khoá dòng đến hết giao dịch — mọi thao tác ghi số liệu của kỳ xếp hàng. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DeptReport d where d.id = :id")
    Optional<DeptReport> lockById(@Param("id") Long id);

    /** Kỳ KHÁC đã có số liệu Sở mà giao thời gian với {@code [from, to]} (chồng nhau là cộng trùng năm). */
    @Query("select d from DeptReport d join fetch d.period p "
            + "where p.id <> :periodId and p.fromDate <= :to and p.toDate >= :from")
    List<DeptReport> findOverlapping(@Param("periodId") Long periodId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);
}
