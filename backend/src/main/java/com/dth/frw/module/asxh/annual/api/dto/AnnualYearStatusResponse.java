package com.dth.frw.module.asxh.annual.api.dto;

import java.util.List;

/**
 * Tình trạng nộp báo cáo năm của một năm — cho nút "một nút đổi vai" ở Tổng hợp → Theo năm
 * (Nộp báo cáo năm → Xem phiếu → Gửi lại) và hộp nộp (UC-59 bước 2).
 *
 * @param blocker   lý do chưa nộp được ({@code null} = nộp được nếu có quyền)
 * @param warnings  kỳ chưa lưu số liệu / thiếu biểu — chỉ cảnh báo
 * @param canSubmit nộp được ngay: không có lý do chặn VÀ người đang đăng nhập có quyền nộp
 * @param latest    phiếu năm mới nhất ({@code null} = năm chưa nộp lần nào)
 */
public record AnnualYearStatusResponse(
        int year,
        int ledgerVersion,
        int savedPeriods,
        int totalPeriods,
        String lockReason,
        String blocker,
        List<String> warnings,
        List<String> unfinishedSheets,
        int sheetCount,
        boolean canSubmit,
        AnnualReportResponse latest) {
}
