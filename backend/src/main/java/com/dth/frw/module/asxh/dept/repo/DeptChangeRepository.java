package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptChange;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeptChangeRepository extends JpaRepository<DeptChange, Long> {

    @Query("select c from DeptChange c where c.reportId = :reportId order by c.occurredAt desc, c.id desc")
    List<DeptChange> findByReport(@Param("reportId") Long reportId);

    @Query("select c from DeptChange c where c.reportYear = :year order by c.occurredAt desc, c.id desc")
    List<DeptChange> findByYear(@Param("year") int year);

    /** Mốc gần nhất của từng kỳ: [reportId, max(occurredAt)]. */
    @Query("select c.reportId, max(c.occurredAt) from DeptChange c where c.reportId in :reportIds group by c.reportId")
    List<Object[]> lastChanges(@Param("reportIds") Collection<Long> reportIds);
}
