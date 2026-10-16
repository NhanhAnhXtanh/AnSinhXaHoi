package com.dth.frw.module.asxh.inputreport.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * {@code PUT /api/input_report_sheets/{id}} — lưu số liệu của biểu.
 *
 * @param dataJson workbook (JSON) frontend gửi lên; máy chủ lưu nguyên, không đọc nội dung
 * @param version  số hiệu bản lưu đang cầm (từ lần đọc / lưu trước); bỏ trống thì không kiểm
 *                 ghi đè
 */
public record SheetDataRequest(
        @NotNull(message = "Thiếu số liệu của biểu")
        String dataJson,
        Long version) {
}
