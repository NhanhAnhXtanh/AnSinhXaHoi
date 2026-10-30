package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.TemplateScript;
import java.time.Instant;

/** Một kịch bản trên dây — port {@code scriptDto} của bản Jmix, thêm người / lúc sửa. */
public record TemplateScriptResponse(
        Long id,
        Long templateVersionId,
        String sheetCode,
        String name,
        String description,
        String code,
        String declaredHooks,
        int displayOrder,
        boolean enabled,
        String scriptHash,
        Instant createdAt,
        String createdBy,
        Instant updatedAt,
        String updatedBy) {

    public static TemplateScriptResponse from(TemplateScript script) {
        return new TemplateScriptResponse(
                script.getId(),
                script.getTemplateVersion().getId(),
                script.getSheetCode(),
                script.getName(),
                script.getDescription(),
                script.getCode(),
                script.getDeclaredHooks(),
                script.getDisplayOrder(),
                script.isEnabled(),
                script.getScriptHash(),
                script.getCreatedAt(),
                script.getCreatedBy(),
                script.getUpdatedAt(),
                script.getUpdatedBy());
    }
}
