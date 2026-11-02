package com.dth.frw.module.asxh.inputreport.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code PUT /api/input_report_sheets/{id}} — lưu số liệu của biểu.
 *
 * @param dataJson workbook (JSON) frontend gửi lên; máy chủ chỉ kiểm đọc được (đúng dạng workbook)
 *                 rồi lưu nguyên, không đọc số liệu trong ô
 * @param version  số hiệu bản lưu đang cầm (từ lần đọc / lưu trước); bỏ trống thì không kiểm
 *                 ghi đè
 */
public record SheetDataRequest(
        @NotNull(message = "Thiếu số liệu của biểu")
        // Lớp chặn thứ hai sau WorkbookBodySizeFilter (thân không khai Content-Length) — trần 20MB.
        @Size(max = 20_971_520, message = "Bảng tính quá lớn (tối đa 20MB). Hãy xoá bớt dòng, cột hoặc vùng trống thừa rồi lưu lại.")
        String dataJson,
        Long version) {
}
