package com.dth.frw.domain.asxh.dept;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Một phiếu đơn vị đã duyệt làm nguồn cho số liệu Sở của kỳ, đóng băng lúc lưu (port
 * {@code QtDeptReportSource}). Số gốc của số liệu Sở tính trên đúng tập này, không trôi theo
 * phiếu được duyệt sau đó.
 *
 * <p>Chỉ lưu id thuần (không khoá ngoại tới phiếu): thu hồi kỳ xoá phiếu bằng lệnh hàng loạt, và
 * tập nguồn là bản ghi lịch sử.
 */
@Entity
@Table(name = "asxh_dept_report_sources")
public class DeptReportSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, updatable = false)
    private DeptReport report;

    @Column(name = "input_report_id", nullable = false, updatable = false)
    private Long inputReportId;

    @Column(name = "unit_id", nullable = false, updatable = false)
    private Long unitId;

    @Column(name = "period_id", nullable = false, updatable = false)
    private Long periodId;

    @Column(name = "revision_no", nullable = false, updatable = false)
    private int revisionNo;

    @Column(name = "approved_at", updatable = false)
    private Instant approvedAt;

    protected DeptReportSource() {
        // for JPA
    }

    public DeptReportSource(DeptReport report, Long inputReportId, Long unitId, Long periodId,
                            int revisionNo, Instant approvedAt) {
        this.report = report;
        this.inputReportId = inputReportId;
        this.unitId = unitId;
        this.periodId = periodId;
        this.revisionNo = revisionNo;
        this.approvedAt = approvedAt;
    }

    public Long getId() {
        return id;
    }

    public DeptReport getReport() {
        return report;
    }

    public Long getInputReportId() {
        return inputReportId;
    }

    public Long getUnitId() {
        return unitId;
    }

    public Long getPeriodId() {
        return periodId;
    }

    public int getRevisionNo() {
        return revisionNo;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptReportSource that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
