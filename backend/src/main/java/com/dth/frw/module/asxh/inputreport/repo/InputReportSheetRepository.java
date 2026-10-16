package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InputReportSheetRepository extends SecuredRepository<InputReportSheet, Long> {

    /** Tờ biểu của một phiếu theo thứ tự tên ngắn của biểu (1a, 1b…). */
    @Query("select s from InputReportSheet s where s.report.id = :reportId "
            + "order by s.template.shortName asc, s.id asc")
    List<InputReportSheet> findByReportId(@Param("reportId") Long reportId);

    /**
     * Tiến độ "đã xong n/m biểu" của nhiều phiếu trong một câu: mỗi dòng
     * {@code [reportId, tổng số biểu, số biểu đã xong]}.
     */
    @Query("select s.report.id, count(s), "
            + "sum(case when s.completion = com.dth.frw.domain.asxh.report.SheetCompletion.COMPLETED "
            + "or s.completion = com.dth.frw.domain.asxh.report.SheetCompletion.NO_DATA then 1 else 0 end) "
            + "from InputReportSheet s where s.report.id in :reportIds group by s.report.id")
    List<Object[]> countProgress(@Param("reportIds") Collection<Long> reportIds);

    /**
     * Các cặp (đơn vị, biểu) đã phát trong kỳ, mỗi dòng {@code [unitId, templateId]} — mỗi
     * cặp chỉ được phát một lần trong kỳ (BR-24.2, BR-26.3). Phiếu đã huỷ không tính.
     */
    @Query("select distinct s.report.unit.id, s.template.id from InputReportSheet s "
            + "where s.report.period.id = :periodId and s.report.status not in :excluded")
    List<Object[]> findIssuedPairs(@Param("periodId") Long periodId,
                                   @Param("excluded") Collection<ReportStatus> excluded);

    /** Thu hồi kỳ, bước 2: xoá mọi tờ biểu của các phiếu thuộc kỳ. */
    @Modifying(flushAutomatically = true)
    @Query("delete from InputReportSheet s where s.report.id in "
            + "(select r.id from InputReport r where r.period.id = :periodId)")
    int deleteForPeriod(@Param("periodId") Long periodId);
}
