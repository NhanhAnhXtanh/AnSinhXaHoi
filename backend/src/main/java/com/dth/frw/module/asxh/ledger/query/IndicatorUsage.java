package com.dth.frw.module.asxh.ledger.query;

/**
 * Một mã chỉ tiêu đã xuất hiện trong số liệu còn hiệu lực của một biểu — nguồn của danh mục chỉ tiêu
 * mà màn "Bản chất chỉ tiêu" liệt kê (bản React chưa có bảng danh mục chỉ tiêu riêng như
 * {@code QT_CRITERION} của bản Jmix; mã chỉ tiêu do script {@code getInputData} của mẫu sinh ra).
 *
 * @param indicatorCode     mã chỉ tiêu
 * @param indicatorName     tên chỉ tiêu (một tên đại diện nếu các phiếu ghi tên khác nhau)
 * @param templateShortName tên ngắn biểu ("1a")
 * @param templateSortOrder thứ tự biểu trong bộ mẫu — để xếp danh mục theo biểu
 * @param orderNo           thứ tự dòng nhỏ nhất của chỉ tiêu trong biểu
 * @param entryCount        số dòng số liệu mang mã này
 */
public record IndicatorUsage(
        String indicatorCode,
        String indicatorName,
        String templateShortName,
        int templateSortOrder,
        Integer orderNo,
        Long entryCount) {
}
