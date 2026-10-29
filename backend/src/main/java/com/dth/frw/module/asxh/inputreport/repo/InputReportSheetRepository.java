package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.shared.data.SecuredRepository;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InputReportSheetRepository extends SecuredRepository<InputReportSheet, Long> {

    /**
     * Khoá ghi dòng PHIẾU chứa tờ biểu này tới hết giao dịch — cùng khoá với nộp / duyệt
     * ({@code InputReportRepository.findForUpdate}). Lưu / đánh dấu biểu giữ khoá này rồi mới đọc
     * trạng thái phiếu, nên không chen được vào giữa lúc phiếu đang được nộp: lượt đến sau thấy
     * phiếu đã nộp và bị từ chối. Không qua phạm vi dòng — người gọi kiểm phạm vi ngay sau đó.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InputReport r where r.id = "
            + "(select s.report.id from InputReportSheet s where s.id = :sheetId)")
    Optional<InputReport> lockReportOfSheet(@Param("sheetId") Long sheetId);

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

    /**
     * Các bộ mẫu có biểu trong phiếu của năm, mỗi dòng {@code [setId, tên bộ]} — ô "Bộ biểu mẫu"
     * của hai màn danh sách (cán bộ đơn vị không có quyền đọc danh mục bộ mẫu).
     */
    @Query("select distinct ts.id, ts.name from InputReportSheet s join s.template t join t.templateSet ts "
            + "where s.report.period.calendar.year = :year order by ts.name asc")
    List<Object[]> findTemplateSetsOfYear(@Param("year") Integer year);

    /** Như {@link #findTemplateSetsOfYear} nhưng chỉ bộ mẫu có biểu trong phiếu của một đơn vị. */
    @Query("select distinct ts.id, ts.name from InputReportSheet s join s.template t join t.templateSet ts "
            + "where s.report.period.calendar.year = :year and s.report.unit.id = :unitId order by ts.name asc")
    List<Object[]> findTemplateSetsOfYearForUnit(@Param("year") Integer year, @Param("unitId") Long unitId);

    /** Thu hồi kỳ, bước 2: xoá mọi tờ biểu của các phiếu thuộc kỳ. */
    @Modifying(flushAutomatically = true)
    @Query("delete from InputReportSheet s where s.report.id in "
            + "(select r.id from InputReport r where r.period.id = :periodId)")
    int deleteForPeriod(@Param("periodId") Long periodId);
}
