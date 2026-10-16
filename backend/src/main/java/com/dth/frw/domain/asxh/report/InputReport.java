package com.dth.frw.domain.asxh.report;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Phiếu nhập: một đơn vị × một kỳ × một đợt phát hành (port {@code QtInputReport}).
 *
 * <p>Phiếu gộp: mọi biểu của đợt nằm trong phiếu dưới dạng tờ biểu
 * ({@link InputReportSheet}). Một đơn vị có thể có nhiều phiếu trong cùng kỳ — đợt bổ sung
 * sinh phiếu riêng khi phiếu cũ đã nộp (BR-26.2), và mỗi lần Sở trả lại sinh một phiên bản
 * mới ({@code revisionNo + 1}, trỏ {@code previousRevision}) — nên KHÔNG có ràng buộc duy
 * nhất theo (đơn vị, kỳ).
 *
 * <p>Đơn vị, kỳ và đợt EAGER vì mọi dòng danh sách đều hiển thị chúng; phiên bản liền trước
 * LAZY vì chỉ lịch sử phiên bản mới cần.
 */
@Entity
@Table(
        name = "asxh_input_reports",
        indexes = {
                @Index(name = "idx_asxh_input_reports_period", columnList = "period_id"),
                @Index(name = "idx_asxh_input_reports_unit", columnList = "unit_id"),
                @Index(name = "idx_asxh_input_reports_status", columnList = "status")
        })
public class InputReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private ReportUnit unit;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private ReportPeriod period;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "publication_id", nullable = false)
    private Publication publication;

    /** 1 là bản phát đầu; mỗi lần Sở trả lại sinh bản kế tiếp. */
    @Column(name = "revision_no", nullable = false)
    private int revisionNo = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_revision_id")
    private InputReport previousRevision;

    /** Cùng cột với {@code previousRevision}, chỉ đọc — trả id ra API mà không chạm proxy lười. */
    @Column(name = "previous_revision_id", insertable = false, updatable = false)
    private Long previousRevisionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportStatus status = ReportStatus.DRAFT;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "submitted_by", length = 255)
    private String submittedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by", length = 255)
    private String approvedBy;

    @Column(name = "returned_at")
    private Instant returnedAt;

    @Column(name = "returned_by", length = 255)
    private String returnedBy;

    /** Lý do Sở trả lại (bắt buộc khi trả lại); xoá khi đơn vị nộp lại. */
    @Column(name = "return_reason", length = 1000)
    private String returnReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected InputReport() {
        // for JPA
    }

    public InputReport(ReportUnit unit, ReportPeriod period, Publication publication) {
        this.unit = unit;
        this.period = period;
        this.publication = publication;
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

    public ReportUnit getUnit() {
        return unit;
    }

    public ReportPeriod getPeriod() {
        return period;
    }

    public Publication getPublication() {
        return publication;
    }

    public int getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(int revisionNo) {
        this.revisionNo = revisionNo;
    }

    public InputReport getPreviousRevision() {
        return previousRevision;
    }

    public void setPreviousRevision(InputReport previousRevision) {
        this.previousRevision = previousRevision;
    }

    /** Id phiên bản liền trước; trên thực thể vừa tạo thì lấy từ tham chiếu (lúc đó là thực thể thật). */
    public Long getPreviousRevisionId() {
        if (previousRevisionId == null && previousRevision != null) {
            return previousRevision.getId();
        }
        return previousRevisionId;
    }

    public ReportStatus getStatus() {
        return status;
    }

    public void setStatus(ReportStatus status) {
        this.status = status;
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

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public Instant getReturnedAt() {
        return returnedAt;
    }

    public void setReturnedAt(Instant returnedAt) {
        this.returnedAt = returnedAt;
    }

    public String getReturnedBy() {
        return returnedBy;
    }

    public void setReturnedBy(String returnedBy) {
        this.returnedBy = returnedBy;
    }

    public String getReturnReason() {
        return returnReason;
    }

    public void setReturnReason(String returnReason) {
        this.returnReason = returnReason;
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
        if (!(other instanceof InputReport report)) {
            return false;
        }
        return id != null && id.equals(report.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
