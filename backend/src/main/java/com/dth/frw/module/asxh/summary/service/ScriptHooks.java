package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;

/**
 * Nhận diện hook {@code getSummaryData} trong một đoạn mã script (bỏ chú thích) — port
 * {@code TemplateScriptService.hasSummaryHook}. Kịch bản lưu theo bản ghi thì dùng thẳng
 * {@link TemplateScriptService#hasSummaryHook} / {@link TemplateScriptService#isSummaryScript};
 * lớp này giữ cho chuỗi script ở dạng cũ (một đoạn mã hoặc mảng JSON nhiều bản ghi).
 */
public final class ScriptHooks {

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
            if (TemplateScriptService.isSummaryScript(record.code())) {
                return true;
            }
        }
        return false;
    }
}
