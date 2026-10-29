package com.dth.frw.module.asxh.annual.repo;

import com.dth.frw.domain.asxh.annual.AnnualReportSheet;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnualReportSheetRepository extends JpaRepository<AnnualReportSheet, Long> {

    /** Biểu của một phiếu năm theo thứ tự hiển thị — kèm phiên bản mẫu (LAZY) trong cùng câu. */
    @Query("select s from AnnualReportSheet s join fetch s.templateVersion where s.report.id = :reportId "
            + "order by s.displayOrder asc, s.id asc")
    List<AnnualReportSheet> findByReport(@Param("reportId") Long reportId);

    @Query("select s from AnnualReportSheet s join fetch s.templateVersion "
            + "where s.report.id = :reportId and s.template.id = :templateId")
    Optional<AnnualReportSheet> findByReportAndTemplate(@Param("reportId") Long reportId,
                                                        @Param("templateId") Long templateId);

    /** Số biểu của nhiều phiếu một lượt: {@code [reportId, count]}. */
    @Query("select s.report.id, count(s) from AnnualReportSheet s where s.report.id in :reportIds "
            + "group by s.report.id")
    List<Object[]> countByReports(@Param("reportIds") Collection<Long> reportIds);
}
