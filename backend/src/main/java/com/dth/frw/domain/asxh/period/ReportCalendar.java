package com.dth.frw.domain.asxh.period;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lịch báo cáo của một năm (UC-06). Port từ {@code ReportCalendar} của bản Jmix.
 *
 * <p>Mỗi năm tối đa một lịch (BR-06.1 — unique {@code year_no}); năm bất biến sau
 * khi tạo (BR-06.3). Mã lịch và trạng thái lịch đã bị gỡ có chủ ý (BR-06.4); tên
 * lịch không còn lưu mà suy ra "Lịch báo cáo năm N" (BA 15/09 đề nghị bỏ tên).
 *
 * <p>{@link #deadlineDays} là hạn nộp mặc định (số ngày sau khi hết kỳ) dùng khi
 * sinh kỳ; {@code kinds} là các loại kỳ đã chọn, lưu chuỗi CSV tên hằng
 * ({@code "THANG,QUY,SAU_THANG"}) — đủ cho bốn giá trị, khỏi bảng phụ. Trường để
 * {@code String} thay vì dùng {@code AttributeConverter} cho {@code Set} để
 * Hibernate so sánh bẩn trên chuỗi, không phải trên tập hợp có thể bị sửa tại chỗ.
 */
@Entity
@Table(name = "asxh_report_calendars")
public class ReportCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "year_no", nullable = false, unique = true, updatable = false)
    private Integer year;

    @Column(name = "deadline_days", nullable = false)
    private int deadlineDays = 5;

    @Column(name = "kinds", nullable = false, length = 64)
    private String kinds = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected ReportCalendar() {
        // for JPA
    }

    public ReportCalendar(int year, int deadlineDays, Collection<PeriodKind> kinds) {
        this.year = year;
        this.deadlineDays = deadlineDays;
        setKinds(kinds);
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

    public Integer getYear() {
        return year;
    }

    /** Tên hiển thị suy ra từ năm. */
    public String getName() {
        return "Lịch báo cáo năm " + year;
    }

    public int getDeadlineDays() {
        return deadlineDays;
    }

    public void setDeadlineDays(int deadlineDays) {
        this.deadlineDays = deadlineDays;
    }

    /** Các loại kỳ đã chọn, theo thứ tự khai báo của enum. */
    public Set<PeriodKind> getKinds() {
        EnumSet<PeriodKind> result = EnumSet.noneOf(PeriodKind.class);
        if (kinds == null || kinds.isBlank()) {
            return result;
        }
        Arrays.stream(kinds.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .map(PeriodKind::from)
                .forEach(result::add);
        return result;
    }

    public void setKinds(Collection<PeriodKind> kinds) {
        EnumSet<PeriodKind> ordered = EnumSet.noneOf(PeriodKind.class);
        if (kinds != null) {
            kinds.stream().filter(Objects::nonNull).forEach(ordered::add);
        }
        this.kinds = ordered.stream().map(Enum::name).collect(Collectors.joining(","));
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
        if (!(other instanceof ReportCalendar calendar)) {
            return false;
        }
        return id != null && id.equals(calendar.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
