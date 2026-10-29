package com.dth.frw.module.asxh.annual.repo;

import com.dth.frw.domain.asxh.annual.AnnualReportAttachment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** File phiếu nộp. Mọi đọc đều theo phiếu — chặn lộ file của phiếu khác qua id đoán mò. */
public interface AnnualReportAttachmentRepository extends JpaRepository<AnnualReportAttachment, Long> {

    @Query("select a from AnnualReportAttachment a where a.report.id = :reportId order by a.createdAt asc, a.id asc")
    List<AnnualReportAttachment> findByReport(@Param("reportId") Long reportId);

    @Query("select a from AnnualReportAttachment a where a.id = :id and a.report.id = :reportId")
    Optional<AnnualReportAttachment> findInReport(@Param("reportId") Long reportId, @Param("id") Long id);

    /** Số file của nhiều phiếu một lượt: {@code [reportId, count]}. */
    @Query("select a.report.id, count(a) from AnnualReportAttachment a where a.report.id in :reportIds "
            + "group by a.report.id")
    List<Object[]> countByReports(@Param("reportIds") Collection<Long> reportIds);
}
