package com.dth.frw.module.asxh.template.api.dto;

/**
 * Một kịch bản Designer gửi lên khi lưu — port {@code TemplateScriptService.ScriptPayload} của bản
 * Jmix. {@code id} {@code null} = kịch bản mới. {@code displayOrder} bị bỏ qua khi lưu cả danh
 * sách: thứ tự chạy là thứ tự trong danh sách gửi lên (như bản Jmix).
 */
public record TemplateScriptPayload(
        Long id,
        String sheetCode,
        String name,
        String description,
        String code,
        String declaredHooks,
        Integer displayOrder,
        Boolean enabled) {
}
