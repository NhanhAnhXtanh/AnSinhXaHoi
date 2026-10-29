package com.dth.frw.module.asxh.inputreport.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/input_reports/{id}/return} — lý do bắt buộc, đơn vị thấy ở lưới và khi nhập. */
public record ReturnReportRequest(
        @NotBlank(message = "Vui lòng nhập lý do trả lại phiếu")
        @Size(max = 1000, message = "Lý do trả lại tối đa 1000 ký tự")
        String reason) {
}
