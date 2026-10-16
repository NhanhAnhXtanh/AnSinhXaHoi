package com.dth.frw.domain.asxh.period;

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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Kỳ báo cáo — port từ {@code QtReportingPeriod} của bản Jmix.
 *
 * <p>Duy nhất theo {@code (calendar, kind, seq)}; vì mỗi năm chỉ một lịch nên tương
 * đương ràng buộc {@code (year, periodType, seq)} cũ.
 *
 * <ul>
 *   <li>{@code fromDate → toDate}: khoảng số liệu, luôn phủ trọn các tháng của kỳ
 *       (để kỳ con ghép khít khi tổng hợp).</li>
 *   <li>{@code openFrom → deadline}: cửa sổ nhận nhập liệu; mặc định mở từ ngày đầu
 *       kỳ, hạn nộp = ngày cuối kỳ + số ngày hạn nộp của lịch (UC-20).</li>
 * </ul>
 *
 * <p>{@code code} là mã ngắn (T1, Q4, 6TĐN, NAM), {@code name} là nhãn đầy đủ
 * ("Quý IV/2026") — cả hai do hệ thống sinh.
 */
@Entity
@Table(
        name = "asxh_report_periods",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_report_periods_calendar_kind_seq",
                columnNames = {"calendar_id", "kind", "seq"}))
public class ReportPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Eager: mỗi dòng hiển thị năm của lịch; một năm chỉ một lịch nên persistence
    // context gom về một câu select.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "calendar_id", nullable = false, updatable = false)
    private ReportCalendar calendar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16, updatable = false)
    private PeriodKind kind;

    /** Số thứ tự trong loại kỳ của năm: tháng 1–12, quý 1–4, sáu tháng 1–2, năm 1. */
    @Column(nullable = false, updatable = false)
    private int seq;

    @Column(nullable = false, length = 16)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date", nullable = false)
    private LocalDate toDate;

    @Column(name = "open_from")
    private LocalDate openFrom;

    /** Hạn nộp (ngày cuối của cửa sổ nhận nhập liệu). */
    @Column(name = "deadline")
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PeriodStatus status = PeriodStatus.DRAFT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected ReportPeriod() {
        // for JPA
    }

    public ReportPeriod(ReportCalendar calendar, PeriodKind kind, int seq, String code, String name,
                        LocalDate fromDate, LocalDate toDate, LocalDate openFrom, LocalDate deadline) {
        this.calendar = calendar;
        this.kind = kind;
        this.seq = seq;
        this.code = code;
        this.name = name;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.openFrom = openFrom;
        this.deadline = deadline;
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

    public ReportCalendar getCalendar() {
        return calendar;
    }

    /** Năm dương lịch của kỳ (= năm của lịch). */
    public Integer getYear() {
        return calendar == null ? null : calendar.getYear();
    }

    public PeriodKind getKind() {
        return kind;
    }

    public int getSeq() {
        return seq;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getFromDate() {
        return fromDate;
    }

    public void setFromDate(LocalDate fromDate) {
        this.fromDate = fromDate;
    }

    public LocalDate getToDate() {
        return toDate;
    }

    public void setToDate(LocalDate toDate) {
        this.toDate = toDate;
    }

    public LocalDate getOpenFrom() {
        return openFrom;
    }

    public void setOpenFrom(LocalDate openFrom) {
        this.openFrom = openFrom;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public PeriodStatus getStatus() {
        return status;
    }

    public void setStatus(PeriodStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /** Hai khoảng số liệu có giao nhau không (đóng hai đầu). */
    public boolean overlaps(ReportPeriod other) {
        return other != null
                && !fromDate.isAfter(other.toDate)
                && !other.fromDate.isAfter(toDate);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof ReportPeriod period)) {
            return false;
        }
        return id != null && id.equals(period.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
