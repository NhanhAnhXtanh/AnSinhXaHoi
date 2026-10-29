package com.dth.frw.domain.asxh.dept;

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
import java.time.Instant;
import java.util.Objects;

/**
 * Bản chất đại lượng của một mã chỉ tiêu — thay cột {@code QT_CRITERION.MEASURE_KIND} của bản
 * Jmix (bản React chưa có danh mục chỉ tiêu riêng).
 *
 * <p>Chỉ tiêu KHÔNG có dòng ở đây được gộp theo {@link MeasureKind#DEFAULT} (người = MAX, tiền =
 * cộng) — đúng hành vi bản Jmix với chỉ tiêu chưa phân loại. Bảng để trống khi khởi tạo; Sở / người
 * quản trị mẫu biểu khai dần ở màn "Bản chất chỉ tiêu" ({@code /api/indicator_measures}).
 */
@Entity
@Table(name = "asxh_indicator_measures")
public class IndicatorMeasure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "indicator_code", nullable = false, length = 100, unique = true)
    private String indicatorCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "measure_kind", nullable = false, length = 20)
    private MeasureKind measureKind = MeasureKind.DEFAULT;

    @Column(length = 1000)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected IndicatorMeasure() {
        // for JPA
    }

    public IndicatorMeasure(String indicatorCode, MeasureKind measureKind) {
        this.indicatorCode = indicatorCode;
        this.measureKind = measureKind;
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

    public String getIndicatorCode() {
        return indicatorCode;
    }

    public MeasureKind getMeasureKind() {
        return measureKind;
    }

    public void setMeasureKind(MeasureKind measureKind) {
        this.measureKind = measureKind;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
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
        if (!(other instanceof IndicatorMeasure that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
