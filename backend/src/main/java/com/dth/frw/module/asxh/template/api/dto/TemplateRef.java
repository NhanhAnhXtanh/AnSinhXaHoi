package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.NotNull;

/** Đối tượng {@code template} trên thân request của phiên bản; chỉ đọc {@code id}. */
public record TemplateRef(@NotNull(message = "Hãy chọn biểu") Long id) {
}
