package com.dth.frw.domain.asxh.dept;

/**
 * Trạng thái khoá số liệu Sở của một năm (UC-60) — lưu ở {@link DeptLedgerYear#getLockState()}.
 *
 * <p>Giống phiếu của đơn vị: nộp lên là hết sửa, bị trả lại mới sửa tiếp. Agent BÁO CÁO NĂM đặt
 * trạng thái qua {@code DeptYearLockService} khi nộp / UBND duyệt / trả lại / mở lại; phần số liệu
 * Sở theo kỳ chỉ ĐỌC trạng thái này để chặn sửa.
 */
public enum DeptYearLockState {

    /** Chưa nộp, hoặc đã bị trả lại / mở lại — Sở sửa được số liệu các kỳ. */
    OPEN,

    /** Báo cáo năm đã nộp, đang chờ UBND — khoá sửa. */
    SUBMITTED,

    /** UBND đã duyệt báo cáo năm — khoá sửa. */
    APPROVED
}
