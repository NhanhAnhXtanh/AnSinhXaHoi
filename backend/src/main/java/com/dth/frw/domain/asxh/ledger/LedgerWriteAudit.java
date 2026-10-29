package com.dth.frw.domain.asxh.ledger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Nhật ký mỗi lần ghi số liệu đã lưu của một tờ biểu (port {@code QtScriptWriteAudit} +
 * {@code QtLedgerAuditLog} của bản Jmix).
 *
 * <p><b>Không có khoá ngoại</b> tới phiếu / biểu, cố ý: dòng {@link Result#FAILED} được ghi trong
 * giao dịch RIÊNG ({@code REQUIRES_NEW}) để sống sót khi giao dịch duyệt bị huỷ, và nhật ký phải
 * còn kể cả khi phiếu đã bị thu hồi cùng kỳ.
 */
@Entity
@Table(name = "asxh_ledger_write_audits")
public class LedgerWriteAudit {

    public enum Result {
        SUCCESS,
        FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "sheet_id")
    private Long sheetId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "template_version_id")
    private Long templateVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LedgerSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Result result;

    @Column(name = "lines_added", nullable = false)
    private int linesAdded;

    @Column(name = "lines_updated", nullable = false)
    private int linesUpdated;

    @Column(name = "lines_removed", nullable = false)
    private int linesRemoved;

    @Column(name = "fail_reason", length = 2000)
    private String failReason;

    @Column(name = "operated_at", nullable = false)
    private Instant operatedAt;

    @Column(name = "operated_by", length = 255)
    private String operatedBy;

    protected LedgerWriteAudit() {
        // for JPA
    }

    public LedgerWriteAudit(Long reportId, Long sheetId, Long templateId, Long templateVersionId,
                            LedgerSource source, Result result) {
        this.reportId = reportId;
        this.sheetId = sheetId;
        this.templateId = templateId;
        this.templateVersionId = templateVersionId;
        this.source = source;
        this.result = result;
    }

    @PrePersist
    void onCreate() {
        if (operatedAt == null) {
            operatedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getReportId() {
        return reportId;
    }

    public Long getSheetId() {
        return sheetId;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public Long getTemplateVersionId() {
        return templateVersionId;
    }

    public LedgerSource getSource() {
        return source;
    }

    public Result getResult() {
        return result;
    }

    public int getLinesAdded() {
        return linesAdded;
    }

    public int getLinesUpdated() {
        return linesUpdated;
    }

    public int getLinesRemoved() {
        return linesRemoved;
    }

    public void setLines(int added, int updated, int removed) {
        this.linesAdded = added;
        this.linesUpdated = updated;
        this.linesRemoved = removed;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }

    public Instant getOperatedAt() {
        return operatedAt;
    }

    public String getOperatedBy() {
        return operatedBy;
    }

    public void setOperatedBy(String operatedBy) {
        this.operatedBy = operatedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof LedgerWriteAudit audit)) {
            return false;
        }
        return id != null && id.equals(audit.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
