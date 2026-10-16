package com.dth.frw.domain.asxh.report;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Một ô của ma trận thiết lập: kỳ {@code period} giao biểu {@code template} cho đơn vị
 * {@code unit}.
 *
 * <p>Thiết lập lưu theo BIỂU (mẫu), không theo phiên bản: phiên bản cụ thể chỉ được chọn và
 * ghim vào tờ biểu lúc mở đợt (theo ngày mở đợt). Port từ {@code ReportPeriodTemplate} +
 * {@code ReportPeriodScope(Organization)} của bản Jmix, rút về đúng kiểu phạm vi mà ma trận
 * dùng — "danh sách đơn vị, bao gồm".
 *
 * <p>Ba khoá ngoại đều EAGER: mỗi dòng ma trận hiển thị tên đơn vị, tên kỳ và tên biểu, và
 * {@code spring.jpa.open-in-view=false} nên không thể nạp lười sau khi giao dịch đóng.
 */
@Entity
@Table(
        name = "asxh_period_assignments",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_period_assignments_cell",
                columnNames = {"period_id", "unit_id", "template_id"}))
public class PeriodAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private ReportPeriod period;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private ReportUnit unit;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PeriodAssignment() {
        // for JPA
    }

    public PeriodAssignment(ReportPeriod period, ReportUnit unit, Template template, String createdBy) {
        this.period = period;
        this.unit = unit;
        this.template = template;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public ReportPeriod getPeriod() {
        return period;
    }

    public ReportUnit getUnit() {
        return unit;
    }

    public Template getTemplate() {
        return template;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PeriodAssignment assignment)) {
            return false;
        }
        return id != null && id.equals(assignment.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
