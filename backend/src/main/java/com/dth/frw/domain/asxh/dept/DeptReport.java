package com.dth.frw.domain.asxh.dept;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.Objects;

/**
 * Số liệu tổng hợp Sở đã lưu của MỘT kỳ (port {@code QtDeptReport} loại {@code PERIOD} — bản Jmix
 * gọi là "phiếu Sở kỳ"; chữ người dùng thấy là "số liệu tổng hợp đã lưu").
 *
 * <p>Lập MỘT lần cho mỗi kỳ khi kỳ đã chốt đợt (UC-54 / BR-27.1): chụp số tổng hợp của mọi biểu
 * theo từng đơn vị vào {@link DeptLedgerLine}, đóng băng tập phiếu đơn vị nguồn
 * ({@link DeptReportSource}). Sau đó Sở sửa số trên màn Tổng hợp (UC-55), mỗi lần lưu là một
 * phiên bản mới CHUNG của năm ({@link DeptLedgerYear}).
 *
 * <p>Báo cáo năm (agent BÁO CÁO NĂM) KHÔNG dùng bảng này cho phiếu năm — nó đọc số liệu năm qua
 * {@code module/asxh/dept/query/DeptYearDataQuery}.
 */
@Entity
@Table(
        name = "asxh_dept_reports",
        uniqueConstraints = @UniqueConstraint(name = "uq_asxh_dept_reports_period", columnNames = "period_id"))
public class DeptReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "period_id", nullable = false, updatable = false)
    private ReportPeriod period;

    /** Năm của kỳ (năm của lịch) — khoá dãy phiên bản. */
    @Column(name = "report_year", nullable = false, updatable = false)
    private int reportYear;

    /** Phiên bản năm GẦN NHẤT làm đổi số của kỳ này. */
    @Column(name = "ledger_version", nullable = false)
    private int ledgerVersion;

    /** SHA-256 của tập "id:revisionNo" các phiếu nguồn — so để biết nguồn đã đổi sau khi lưu (BR-55.4). */
    @Column(name = "source_fingerprint", length = 64)
    private String sourceFingerprint;

    @Column(name = "source_count", nullable = false)
    private int sourceCount;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected DeptReport() {
        // for JPA
    }

    public DeptReport(ReportPeriod period, int reportYear) {
        this.period = period;
        this.reportYear = reportYear;
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

    public ReportPeriod getPeriod() {
        return period;
    }

    public int getReportYear() {
        return reportYear;
    }

    public int getLedgerVersion() {
        return ledgerVersion;
    }

    public void setLedgerVersion(int ledgerVersion) {
        this.ledgerVersion = ledgerVersion;
    }

    public String getSourceFingerprint() {
        return sourceFingerprint;
    }

    public void setSourceFingerprint(String sourceFingerprint) {
        this.sourceFingerprint = sourceFingerprint;
    }

    public int getSourceCount() {
        return sourceCount;
    }

    public void setSourceCount(int sourceCount) {
        this.sourceCount = sourceCount;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
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
        if (!(other instanceof DeptReport that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
