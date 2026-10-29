package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Đối tượng {@code set} trên thân request của biểu — form chọn bộ mẫu ghi vào
 * {@code set.id}; chỉ đọc {@code id}, mọi trường khác bị bỏ qua.
 */
public record TemplateSetRef(@NotNull(message = "Hãy chọn bộ mẫu") Long id) {
}
