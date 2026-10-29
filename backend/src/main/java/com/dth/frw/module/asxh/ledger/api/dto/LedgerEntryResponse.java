package com.dth.frw.module.asxh.ledger.api.dto;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Wire shape của một dòng số liệu đã lưu. Đối tượng lồng khai tại đây (không dùng DTO slice khác).
 * Phải dựng TRONG giao dịch: các quan hệ của {@link LedgerEntry} đều LAZY.
 */
public record LedgerEntryResponse(
        Long id,
        Long reportId,
        Long sheetId,
        Long periodId,
        TemplateSummary template,
        Long templateVersionId,
        UnitSummary unit,
        UnitSummary submitterUnit,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        String note,
        Integer orderNo,
        LedgerSource source,
        Instant createdAt,
        Instant updatedAt) {

    public record TemplateSummary(Long id, String shortName, String name) {
        static TemplateSummary from(Template template) {
            return new TemplateSummary(template.getId(), template.getShortName(), template.getName());
        }
    }

    public record UnitSummary(Long id, String budgetCode, String name) {
        static UnitSummary from(ReportUnit unit) {
            return new UnitSummary(unit.getId(), unit.getBudgetCode(), unit.getName());
        }
    }

    public static LedgerEntryResponse from(LedgerEntry entry) {
        return new LedgerEntryResponse(
                entry.getId(),
                entry.getReport().getId(),
                entry.getSheet().getId(),
                entry.getPeriod().getId(),
                TemplateSummary.from(entry.getTemplate()),
                entry.getTemplateVersionId(),
                UnitSummary.from(entry.getUnit()),
                UnitSummary.from(entry.getSubmitterUnit()),
                entry.getIndicatorCode(),
                entry.getIndicatorName(),
                entry.getQuantity(),
                entry.getAmount(),
                entry.getNote(),
                entry.getOrderNo(),
                entry.getSource(),
                entry.getCreatedAt(),
                entry.getUpdatedAt());
    }
}
