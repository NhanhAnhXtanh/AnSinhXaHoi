package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.TemplateSet;
import java.time.Instant;

/**
 * Bộ mẫu trên dây.
 *
 * <p>{@code templateCount} là số biểu trong bộ; {@code inUse} = có ít nhất một
 * biểu đã ban hành — thay cho nhãn "Đang sử dụng / Nháp" của bản cũ.
 */
public record TemplateSetResponse(
        Long id,
        String name,
        String description,
        long templateCount,
        boolean inUse,
        Instant createdAt,
        Instant updatedAt) {

    public static TemplateSetResponse from(TemplateSet set, long templateCount, boolean inUse) {
        return new TemplateSetResponse(
                set.getId(),
                set.getName(),
                set.getDescription(),
                templateCount,
                inUse,
                set.getCreatedAt(),
                set.getUpdatedAt());
    }
}
