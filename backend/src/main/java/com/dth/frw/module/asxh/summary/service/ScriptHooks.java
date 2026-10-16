package com.dth.frw.module.asxh.summary.service;

import java.util.regex.Pattern;

/**
 * Nhận diện hook khai trong script phiên bản mẫu bằng mã nguồn (bỏ chú thích) — port
 * {@code TemplateScriptService.hasSummaryHook}. Dùng để quyết định biểu nào Sở sửa số được
 * (UC-55 2a: chỉ biểu có {@code getSummaryData}).
 */
public final class ScriptHooks {

    private static final Pattern BLOCK_COMMENT = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);
    private static final Pattern LINE_COMMENT = Pattern.compile("//[^\\n]*");
    private static final Pattern SUMMARY_HOOK = Pattern.compile("\\bgetSummaryData\\s*[(:]");

    private ScriptHooks() {
    }

    /** Script có khai hàm {@code getSummaryData} (dạng {@code getSummaryData(ctx) {…}} hoặc {@code getSummaryData: …}). */
    public static boolean hasSummaryHook(String scriptText) {
        if (scriptText == null || scriptText.isBlank()) {
            return false;
        }
        String code = LINE_COMMENT.matcher(BLOCK_COMMENT.matcher(scriptText).replaceAll(" ")).replaceAll(" ");
        return SUMMARY_HOOK.matcher(code).find();
    }
}
