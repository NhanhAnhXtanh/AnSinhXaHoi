package com.dth.frw.domain.asxh.report;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.Objects;

/**
 * Một đợt phát hành phiếu của kỳ (UC-24 mở đợt lần đầu, UC-26 đợt bổ sung).
 *
 * <p>Port từ {@code ReportPublication} của bản Jmix. Bỏ mã đợt dạng {@code PUB-…} (là mã
 * máy, không hiển thị cho cán bộ) — thay bằng số thứ tự đợt trong kỳ, duy nhất theo
 * {@code (period_id, publication_no)}; ràng buộc đó cũng là chốt chặn khi hai người bấm mở
 * đợt cùng lúc. Bỏ bảng dòng chi tiết {@code ReportPublicationItem}: tờ biểu
 * ({@link InputReportSheet}) đã trỏ về phiếu và phiếu trỏ về đợt.
 */
@Entity
@Table(
        name = "asxh_publications",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_publications_period_no",
                columnNames = {"period_id", "publication_no"}))
public class Publication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private ReportPeriod period;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PublicationKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PublicationStatus status = PublicationStatus.PUBLISHED;

    /** Thứ tự đợt trong kỳ, bắt đầu từ 1 (đếm cả đợt đã thu hồi). */
    @Column(name = "publication_no", nullable = false)
    private int publicationNo;

    /** Số đơn vị được đợt này chạm tới (có biểu mới hoặc biểu đã có). */
    @Column(name = "unit_count", nullable = false)
    private int unitCount;

    /** Số phiếu MỚI đợt này tạo ra. */
    @Column(name = "report_count", nullable = false)
    private int reportCount;

    /** Số tờ biểu mới được phát. */
    @Column(name = "sheet_count", nullable = false)
    private int sheetCount;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Thời điểm thu hồi cùng kỳ (UC-29); {@code null} khi đợt còn hiệu lực. */
    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected Publication() {
        // for JPA
    }

    public Publication(ReportPeriod period, PublicationKind kind, int publicationNo, String createdBy) {
        this.period = period;
        this.kind = kind;
        this.publicationNo = publicationNo;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    /** Thu hồi cùng kỳ — đợt không còn được tính là kỳ đã mở. */
    public void cancel() {
        this.status = PublicationStatus.CANCELLED;
        this.cancelledAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public ReportPeriod getPeriod() {
        return period;
    }

    public PublicationKind getKind() {
        return kind;
    }

    public PublicationStatus getStatus() {
        return status;
    }

    public int getPublicationNo() {
        return publicationNo;
    }

    public int getUnitCount() {
        return unitCount;
    }

    public void setUnitCount(int unitCount) {
        this.unitCount = unitCount;
    }

    public int getReportCount() {
        return reportCount;
    }

    public void setReportCount(int reportCount) {
        this.reportCount = reportCount;
    }

    public int getSheetCount() {
        return sheetCount;
    }

    public void setSheetCount(int sheetCount) {
        this.sheetCount = sheetCount;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Publication publication)) {
            return false;
        }
        return id != null && id.equals(publication.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
