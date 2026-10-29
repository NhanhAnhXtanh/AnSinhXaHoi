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
import java.time.Instant;
import java.util.Objects;

/**
 * Một mốc trong lịch sử số liệu Sở (port {@code QtDeptChange}) — mỗi lần lưu sinh ra một phiên bản
 * năm là MỘT mốc cho mỗi biểu có đổi số. Chỉ ghi thêm, không sửa.
 *
 * <p>{@code reportId} = số liệu kỳ ({@link DeptReport}); mốc của báo cáo năm (agent BÁO CÁO NĂM)
 * để {@code reportId} null và điền {@code reportYear} + {@code annualRef} (id phiếu năm của slice
 * đó). {@code templateId} null = cả kỳ / cả phiếu.
 */
@Entity
@Table(
        name = "asxh_dept_changes",
        indexes = {
                @Index(name = "ix_asxh_dept_changes_report", columnList = "report_id"),
                @Index(name = "ix_asxh_dept_changes_year", columnList = "report_year")
        })
public class DeptChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_year", nullable = false, updatable = false)
    private int reportYear;

    @Column(name = "report_id", updatable = false)
    private Long reportId;

    /** Id phiếu năm của slice báo cáo năm (không khoá ngoại — slice đó sở hữu bảng). */
    @Column(name = "annual_ref", updatable = false)
    private Long annualRef;

    @Column(name = "template_id", updatable = false)
    private Long templateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private DeptChangeAction action;

    /** Phiên bản năm sinh ra ({@code null} = mốc không đổi số, vd nộp năm). */
    @Column(name = "version_no", updatable = false)
    private Integer versionNo;

    @Column(name = "row_count", updatable = false)
    private Integer rowCount;

    @Column(length = 1000, updatable = false)
    private String note;

    @Column(nullable = false, length = 255, updatable = false)
    private String actor;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected DeptChange() {
        // for JPA
    }

    public DeptChange(int reportYear, Long reportId, Long templateId, DeptChangeAction action,
                      Integer versionNo, Integer rowCount, String note, String actor, Instant occurredAt) {
        this.reportYear = reportYear;
        this.reportId = reportId;
        this.templateId = templateId;
        this.action = action;
        this.versionNo = versionNo;
        this.rowCount = rowCount;
        this.note = note;
        this.actor = actor;
        this.occurredAt = occurredAt;
    }

    /** Mốc của báo cáo năm — cho agent BÁO CÁO NĂM. */
    public static DeptChange forYear(int reportYear, Long annualRef, DeptChangeAction action, Integer versionNo,
                                     String note, String actor, Instant occurredAt) {
        DeptChange change = new DeptChange(reportYear, null, null, action, versionNo, null, note, actor, occurredAt);
        change.annualRef = annualRef;
        return change;
    }

    public Long getId() {
        return id;
    }

    public int getReportYear() {
        return reportYear;
    }

    public Long getReportId() {
        return reportId;
    }

    public Long getAnnualRef() {
        return annualRef;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public DeptChangeAction getAction() {
        return action;
    }

    public Integer getVersionNo() {
        return versionNo;
    }

    public Integer getRowCount() {
        return rowCount;
    }

    public String getNote() {
        return note;
    }

    public String getActor() {
        return actor;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptChange that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
