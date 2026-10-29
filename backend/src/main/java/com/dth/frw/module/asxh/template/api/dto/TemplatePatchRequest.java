package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.TemplateKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /templates/{id}} — trường {@code null} nghĩa là giữ nguyên.
 *
 * <p>Đổi {@code kind} chỉ được khi biểu chưa có phiên bản nào rời trạng thái
 * nháp (BR-10.2: loại biểu chốt từ bản đầu chuỗi). Chuyển sang bộ mẫu khác thì
 * kiểm tra lại tên ngắn trong bộ đích.
 */
public record TemplatePatchRequest(
        @Valid
        TemplateSetRef set,

        @Size(min = 1, max = 32, message = "Tên ngắn từ 1 đến 32 ký tự")
        String shortName,

        @Size(min = 1, max = 500, message = "Tên biểu từ 1 đến 500 ký tự")
        String name,

        TemplateKind kind,

        @Min(value = 0, message = "Thứ tự không được âm")
        Integer sortOrder) {
}
