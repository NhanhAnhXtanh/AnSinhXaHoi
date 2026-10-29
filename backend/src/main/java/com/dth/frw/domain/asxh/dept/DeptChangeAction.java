package com.dth.frw.domain.asxh.dept;

/**
 * Loại mốc trong lịch sử số liệu Sở ({@link DeptChange}). Các mốc của báo cáo năm (nộp, UBND
 * duyệt, trả lại, mở lại) do agent BÁO CÁO NĂM ghi — đã để sẵn hằng để lịch sử năm đọc chung một
 * bảng.
 */
public enum DeptChangeAction {

    /** Lưu số liệu tổng hợp của kỳ lần đầu (chốt đợt / "Lưu số liệu", UC-54). */
    PERIOD_SAVED,

    /** Sở sửa số một biểu rồi hoàn tất / lưu (UC-55). */
    SHEET_SAVED,

    /** Khôi phục số liệu một phiên bản cũ thành phiên bản mới. */
    RESTORED,

    /** Nộp báo cáo năm lên UBND (agent BÁO CÁO NĂM). */
    YEAR_SUBMITTED,

    /** UBND duyệt báo cáo năm (agent BÁO CÁO NĂM). */
    YEAR_APPROVED,

    /** UBND trả lại báo cáo năm (agent BÁO CÁO NĂM). */
    YEAR_RETURNED,

    /** UBND mở lại báo cáo năm đã duyệt (agent BÁO CÁO NĂM). */
    YEAR_REOPENED
}
