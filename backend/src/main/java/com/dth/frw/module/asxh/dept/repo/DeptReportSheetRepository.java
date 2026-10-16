package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptReportSheet;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeptReportSheetRepository extends JpaRepository<DeptReportSheet, Long> {

    @Query("select s from DeptReportSheet s where s.report.id = :reportId order by s.displayOrder, s.id")
    List<DeptReportSheet> findByReport(@Param("reportId") Long reportId);

    @Query("select s from DeptReportSheet s where s.report.id in :reportIds order by s.report.id, s.displayOrder")
    List<DeptReportSheet> findByReports(@Param("reportIds") Collection<Long> reportIds);

    @Query("select s from DeptReportSheet s where s.report.id = :reportId and s.template.id = :templateId")
    Optional<DeptReportSheet> findOne(@Param("reportId") Long reportId, @Param("templateId") Long templateId);
}
