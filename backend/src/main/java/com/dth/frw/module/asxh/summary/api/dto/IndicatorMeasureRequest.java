package com.dth.frw.module.asxh.summary.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PUT /api/indicator_measures} — khai cùng một bản chất cho một hoặc nhiều chỉ tiêu.
 *
 * @param indicatorCodes mã chỉ tiêu (lấy từ danh mục)
 * @param measureKind    tên hằng bản chất; {@code null} / rỗng = bỏ khai, chỉ tiêu tính theo mặc định
 * @param note           ghi chú; {@code null} = giữ ghi chú cũ, chuỗi rỗng = xoá ghi chú
 */
public record IndicatorMeasureRequest(
        @NotEmpty(message = "Hãy chọn ít nhất một chỉ tiêu.")
        @Size(max = 1000, message = "Mỗi lần chỉ khai được tối đa 1000 chỉ tiêu.")
        List<String> indicatorCodes,
        String measureKind,
        @Size(max = 1000, message = "Ghi chú dài quá 1000 ký tự.") String note) {
}
