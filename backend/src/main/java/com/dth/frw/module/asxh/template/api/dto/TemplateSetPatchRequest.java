package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.Size;

/** {@code PATCH /template_sets/{id}} — trường {@code null} nghĩa là giữ nguyên. */
public record TemplateSetPatchRequest(
        @Size(min = 1, max = 255, message = "Tên bộ mẫu từ 1 đến 255 ký tự")
        String name,

        @Size(max = 1000, message = "Mô tả tối đa 1000 ký tự")
        String description) {
}
