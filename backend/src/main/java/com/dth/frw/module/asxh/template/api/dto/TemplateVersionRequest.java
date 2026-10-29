package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * {@code POST /template_versions} — chỉ dùng để tạo lại phiên bản đầu cho một
 * biểu đang không còn phiên bản nào. Biểu đã có phiên bản thì phải đi đường
 * "phiên bản kế tiếp" ({@code POST /templates/{id}/next_version}) để chuỗi không
 * rẽ nhánh.
 */
public record TemplateVersionRequest(
        @NotNull(message = "Hãy chọn biểu")
        @Valid
        TemplateRef template,

        LocalDate effectiveFrom,

        @Size(max = 20_971_520, message = "Bảng tính quá lớn (tối đa 20MB)")
        String workbookJson,

        @Size(max = 2_000_000, message = "Script quá dài")
        String scriptText) {
}
