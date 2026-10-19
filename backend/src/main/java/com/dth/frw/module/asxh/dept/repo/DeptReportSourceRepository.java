package com.dth.frw.module.asxh.dept.repo;

import com.dth.frw.domain.asxh.dept.DeptReportSource;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeptReportSourceRepository extends JpaRepository<DeptReportSource, Long> {

    @Query("select s.inputReportId from DeptReportSource s where s.report.id = :reportId")
    List<Long> inputReportIds(@Param("reportId") Long reportId);

    /** Tập phiếu đơn vị đã đóng băng lúc lưu số liệu kỳ. */
    @Query("select s from DeptReportSource s where s.report.id = :reportId")
    List<DeptReportSource> findByReport(@Param("reportId") Long reportId);
}
