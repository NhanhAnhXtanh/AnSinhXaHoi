package com.dth.frw.module.asxh.dept.query;

import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import java.time.Instant;

/**
 * Một mốc trong lịch sử số liệu Sở (UC-56): lưu kỳ / Sở sửa biểu / khôi phục; mốc của báo cáo năm
 * (nộp, UBND duyệt, trả lại, mở lại) nếu agent BÁO CÁO NĂM ghi qua {@code DeptYearLockService}.
 *
 * @param scope      "Quý I/2026" (tên kỳ) hoặc "Báo cáo năm 2026"
 * @param reportId   số liệu Sở của kỳ ({@code null} với mốc báo cáo năm)
 * @param annualRef  id phiếu năm của slice báo cáo năm ({@code null} với mốc kỳ)
 * @param sheetLabel tên ngắn biểu ("1a"); rỗng = cả kỳ / cả phiếu
 * @param versionNo  phiên bản năm sinh ra ({@code null} = mốc không đổi số)
 * @param rowCount   số dòng đổi
 */
public record DeptHistoryEntry(
        Instant occurredAt,
        DeptChangeAction action,
        String actionLabel,
        String scope,
        Long periodId,
        Long reportId,
        Long annualRef,
        Long templateId,
        String sheetLabel,
        Integer versionNo,
        Integer rowCount,
        String actor,
        String note) {
}
