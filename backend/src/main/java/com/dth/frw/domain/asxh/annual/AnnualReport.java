package com.dth.frw.domain.asxh.annual;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Một lần Sở nộp báo cáo năm lên UBND — "Phiếu n" của năm (port {@code QtDeptReport} loại
 * {@code YEAR} của bản Jmix).
 *
 * <p><b>Ghim phiên bản số liệu</b> (BR-59.2): {@link #ledgerVersion} là phiên bản số liệu tổng hợp
 * của năm lúc nộp ({@code DeptYearDataQuery.currentVersion}); mở lại phiếu về sau luôn đọc số ở đúng
 * phiên bản đó dù Sở đã sửa kỳ. Phiên bản mẫu các biểu năm ghim ở {@link AnnualReportSheet}.
 *
 * <p><b>Một năm một phiếu còn hiệu lực</b> (BR-59.1) — giữ bằng chỉ mục duy nhất một phần trên
 * {@code report_year} với trạng thái đang chờ / đã duyệt (changelog 150), không chỉ bằng code.
 */
@Entity
@Table(
        name = "asxh_annual_reports",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_annual_reports_year_revision", columnNames = {"report_year", "revision_no"}))
public class AnnualReport {

    /** Số văn bản phiếu nộp, ví dụ "12/TTr-STC". */
    public static final int DOC_NO_MAX_LENGTH = 50;

    /** Lý do trả lại / mở lại. */
    public static final int REASON_MAX_LENGTH = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_year", nullable = false, updatable = false)
    private int reportYear;

    /** "Phiếu n" — đếm từ 1 trong năm. */
    @Column(name = "revision_no", nullable = false, updatable = false)
    private int revisionNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AnnualReportStatus status = AnnualReportStatus.SUBMITTED;

    /** Phiên bản số liệu tổng hợp của năm đã ghim lúc nộp. */
    @Column(name = "ledger_version", nullable = false, updatable = false)
    private int ledgerVersion;

    @Column(name = "doc_no", nullable = false, length = DOC_NO_MAX_LENGTH)
    private String docNo;

    @Column(name = "doc_date", nullable = false)
    private LocalDate docDate;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "submitted_by", length = 255)
    private String submittedBy;

    /** Lần UBND quyết định gần nhất (duyệt / trả lại / mở lại). */
    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decided_by", length = 255)
    private String decidedBy;

    @Column(name = "return_reason", length = REASON_MAX_LENGTH)
    private String returnReason;

    /** {@code true} = bị MỞ LẠI sau khi đã duyệt (UC-65), khác trả lại thường (UC-64). */
    @Column(nullable = false)
    private boolean reopened;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected AnnualReport() {
        // for JPA
    }

    public AnnualReport(int reportYear, int revisionNo, int ledgerVersion, String docNo, LocalDate docDate) {
        this.reportYear = reportYear;
        this.revisionNo = revisionNo;
        this.ledgerVersion = ledgerVersion;
        this.docNo = docNo;
        this.docDate = docDate;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public int getReportYear() {
        return reportYear;
    }

    public int getRevisionNo() {
        return revisionNo;
    }

    public AnnualReportStatus getStatus() {
        return status;
    }

    public void setStatus(AnnualReportStatus status) {
        this.status = status;
    }

    public int getLedgerVersion() {
        return ledgerVersion;
    }

    public String getDocNo() {
        return docNo;
    }

    public LocalDate getDocDate() {
        return docDate;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Instant decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(String decidedBy) {
        this.decidedBy = decidedBy;
    }

    public String getReturnReason() {
        return returnReason;
    }

    public void setReturnReason(String returnReason) {
        this.returnReason = returnReason;
    }

    public boolean isReopened() {
        return reopened;
    }

    public void setReopened(boolean reopened) {
        this.reopened = reopened;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof AnnualReport that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
