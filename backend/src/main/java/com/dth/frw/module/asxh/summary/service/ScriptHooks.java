package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.module.asxh.script.ServerScriptRunner;
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
        // Dạng mảng JSON nhiều bản ghi: xét mã từng bản ghi (bỏ chú thích trên chuỗi JSON thô
        // sẽ cắt mất phần sau "//" của cả dòng).
        for (ServerScriptRunner.ScriptRecord record : ServerScriptRunner.parseScriptText(scriptText)) {
            String code = LINE_COMMENT.matcher(BLOCK_COMMENT.matcher(record.code()).replaceAll(" ")).replaceAll(" ");
            if (SUMMARY_HOOK.matcher(code).find()) {
                return true;
            }
        }
        return false;
    }
}
