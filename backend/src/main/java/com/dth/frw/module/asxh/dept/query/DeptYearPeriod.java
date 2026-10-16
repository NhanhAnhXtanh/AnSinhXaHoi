package com.dth.frw.module.asxh.dept.query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Một kỳ có biểu thiết lập trong năm, kèm tình trạng số liệu Sở — cho dải "các kỳ" của màn năm và
 * cảnh báo lúc nộp báo cáo năm (port {@code DeptYearSourceService.YearPeriod}).
 *
 * @param periodStatus   trạng thái kỳ (tên hằng {@code PeriodStatus}, chữ hoa)
 * @param deptReportId   số liệu Sở của kỳ; {@code null} = kỳ chưa lưu số liệu
 * @param savedSheets    tên ngắn các biểu đã có trong số liệu Sở ("1a", "1b")
 * @param unsavedSheets  tên ngắn các biểu đã thiết lập nhưng chưa có trong số liệu Sở
 * @param openSheets     tên ngắn các biểu Sở sửa được (có {@code getSummaryData}) mà CHƯA "Kiểm tra &amp;
 *                       hoàn tất" — còn thì chưa nộp báo cáo năm được
 * @param pendingSheets  tên ngắn các biểu đang có bảng sửa dở chưa vào số liệu
 * @param ledgerVersion  phiên bản năm gần nhất làm đổi số của kỳ; {@code null} = chưa lưu
 * @param lastChangedAt  lần lưu gần nhất
 */
public record DeptYearPeriod(
        Long periodId,
        String periodName,
        String periodKind,
        LocalDate fromDate,
        LocalDate toDate,
        String periodStatus,
        Long deptReportId,
        List<String> savedSheets,
        List<String> unsavedSheets,
        List<String> openSheets,
        List<String> pendingSheets,
        Integer ledgerVersion,
        Instant lastChangedAt) {
}
