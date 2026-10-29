package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /template_sets}. Không có ô mã, không có ô Trạng thái (BR-09.3). */
public record TemplateSetRequest(
        @NotBlank(message = "Hãy nhập tên bộ mẫu")
        @Size(max = 255, message = "Tên bộ mẫu tối đa 255 ký tự")
        String name,

        @Size(max = 1000, message = "Mô tả tối đa 1000 ký tự")
        String description) {
}
