package com.dth.frw.module.asxh.ledger.api.dto;

import com.dth.frw.module.asxh.script.ScriptRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Nạp số liệu BHXH đã chuẩn hoá vào một biểu của phiếu (UC-49). Mỗi dòng cùng hợp đồng 7 cột như
 * hook {@code getInputData}.
 */
public record LedgerImportRequest(
        @NotNull(message = "Thiếu biểu cần nạp") Long templateId,
        @NotNull(message = "Thiếu danh sách dòng") @Size(max = 5000, message = "Tối đa 5000 dòng mỗi lần nạp")
        List<@Valid Row> rows) {

    public record Row(
            String organizationCode,
            String organizationName,
            String indicatorCode,
            String indicatorName,
            BigDecimal quantity,
            BigDecimal amount,
            String note,
            Integer orderNo) {

        public ScriptRow toScriptRow() {
            return new ScriptRow(organizationCode, organizationName, indicatorCode, indicatorName,
                    quantity, amount, note, orderNo);
        }
    }
}
