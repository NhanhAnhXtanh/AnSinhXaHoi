package com.dth.frw.domain.asxh.dept;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Nhật ký từng ô số liệu Sở thay đổi (port {@code QtDeptLedgerAudit}): trước / sau, lý do, người,
 * lúc. Chỉ ghi thêm. Gắn với mốc lịch sử qua {@code changeId}.
 */
@Entity
@Table(
        name = "asxh_dept_ledger_audits",
        indexes = @Index(name = "ix_asxh_dept_ledger_audits_report", columnList = "report_id, template_id"))
public class DeptLedgerAudit {

    public enum Action {
        ADDED,
        UPDATED,
        REMOVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false, updatable = false)
    private Long reportId;

    @Column(name = "template_id", nullable = false, updatable = false)
    private Long templateId;

    @Column(name = "unit_key", nullable = false, length = 100, updatable = false)
    private String unitKey;

    @Column(name = "indicator_code", nullable = false, length = 100, updatable = false)
    private String indicatorCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private DeptLedgerSlot slot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16, updatable = false)
    private Action action;

    @Column(name = "quantity_before", columnDefinition = "numeric", updatable = false)
    private BigDecimal quantityBefore;

    @Column(name = "quantity_after", columnDefinition = "numeric", updatable = false)
    private BigDecimal quantityAfter;

    @Column(name = "amount_before", columnDefinition = "numeric", updatable = false)
    private BigDecimal amountBefore;

    @Column(name = "amount_after", columnDefinition = "numeric", updatable = false)
    private BigDecimal amountAfter;

    @Column(name = "allocated_before", columnDefinition = "numeric", updatable = false)
    private BigDecimal allocatedBefore;

    @Column(name = "allocated_after", columnDefinition = "numeric", updatable = false)
    private BigDecimal allocatedAfter;

    @Column(columnDefinition = "text", updatable = false)
    private String reason;

    @Column(name = "operated_by", nullable = false, length = 255, updatable = false)
    private String operatedBy;

    @Column(name = "operated_at", nullable = false, updatable = false)
    private Instant operatedAt;

    @Column(name = "change_id", updatable = false)
    private Long changeId;

    protected DeptLedgerAudit() {
        // for JPA
    }

    public DeptLedgerAudit(Long reportId, Long templateId, String unitKey, String indicatorCode,
                           DeptLedgerSlot slot, Action action,
                           BigDecimal quantityBefore, BigDecimal quantityAfter,
                           BigDecimal amountBefore, BigDecimal amountAfter,
                           BigDecimal allocatedBefore, BigDecimal allocatedAfter,
                           String reason, String operatedBy, Instant operatedAt, Long changeId) {
        this.reportId = reportId;
        this.templateId = templateId;
        this.unitKey = unitKey;
        this.indicatorCode = indicatorCode;
        this.slot = slot;
        this.action = action;
        this.quantityBefore = quantityBefore;
        this.quantityAfter = quantityAfter;
        this.amountBefore = amountBefore;
        this.amountAfter = amountAfter;
        this.allocatedBefore = allocatedBefore;
        this.allocatedAfter = allocatedAfter;
        this.reason = reason;
        this.operatedBy = operatedBy;
        this.operatedAt = operatedAt;
        this.changeId = changeId;
    }

    public Long getId() {
        return id;
    }

    public Long getReportId() {
        return reportId;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public String getUnitKey() {
        return unitKey;
    }

    public String getIndicatorCode() {
        return indicatorCode;
    }

    public DeptLedgerSlot getSlot() {
        return slot;
    }

    public Action getAction() {
        return action;
    }

    public BigDecimal getQuantityBefore() {
        return quantityBefore;
    }

    public BigDecimal getQuantityAfter() {
        return quantityAfter;
    }

    public BigDecimal getAmountBefore() {
        return amountBefore;
    }

    public BigDecimal getAmountAfter() {
        return amountAfter;
    }

    public BigDecimal getAllocatedBefore() {
        return allocatedBefore;
    }

    public BigDecimal getAllocatedAfter() {
        return allocatedAfter;
    }

    public String getReason() {
        return reason;
    }

    public String getOperatedBy() {
        return operatedBy;
    }

    public Instant getOperatedAt() {
        return operatedAt;
    }

    public Long getChangeId() {
        return changeId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptLedgerAudit that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
