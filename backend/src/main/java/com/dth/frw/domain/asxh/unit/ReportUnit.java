package com.dth.frw.domain.asxh.unit;

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
import java.time.Instant;
import java.util.Objects;

/**
 * Đơn vị báo cáo (Sở, UBND huyện/xã, trường…) — cây phân cấp qua {@link #parent}.
 * Port từ {@code Organization} của bản Jmix (bảng {@code QT_ORGANIZATION}).
 *
 * <p>{@link #budgetCode} là mã quan hệ ngân sách (QHNS): nhập tay, duy nhất (không
 * phân biệt hoa thường) và <b>bất biến</b> sau khi tạo (BR-01.1) — cột
 * {@code updatable = false}, service từ chối mọi lần đổi bằng thông báo rõ ràng.
 *
 * <p>{@link #active} và {@link #receivesReports} độc lập với nhau: một đơn vị còn
 * trong danh mục vẫn có thể không thuộc diện báo cáo. Chỉ đơn vị có cả hai cờ mới
 * lên ma trận thiết lập (BR-01.3).
 *
 * <p>Cha nạp LAZY: cây tự tham chiếu mà nạp EAGER thì mỗi dòng kéo theo cả chuỗi
 * tổ tiên. Service khởi tạo cha trong transaction trước khi trả ra controller
 * ({@code open-in-view=false}).
 */
@Entity
@Table(name = "asxh_report_units")
public class ReportUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Mã quan hệ ngân sách, ví dụ {@code 1051001}. Duy nhất, bất biến. */
    @Column(name = "budget_code", nullable = false, length = 32, unique = true, updatable = false)
    private String budgetCode;

    @Column(nullable = false, length = 255)
    private String name;

    /** {@code null} = đơn vị gốc. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private ReportUnit parent;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_type", nullable = false, length = 32)
    private ReportUnitType unitType = ReportUnitType.KHAC;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ReportBlock block = ReportBlock.TINH;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "receives_reports", nullable = false)
    private boolean receivesReports = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected ReportUnit() {
        // for JPA
    }

    public ReportUnit(String budgetCode, String name, ReportUnit parent,
                      ReportUnitType unitType, ReportBlock block) {
        this.budgetCode = budgetCode;
        this.name = name;
        this.parent = parent;
        this.unitType = unitType;
        this.block = block;
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

    public String getBudgetCode() {
        return budgetCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ReportUnit getParent() {
        return parent;
    }

    public void setParent(ReportUnit parent) {
        this.parent = parent;
    }

    public ReportUnitType getUnitType() {
        return unitType;
    }

    public void setUnitType(ReportUnitType unitType) {
        this.unitType = unitType;
    }

    public ReportBlock getBlock() {
        return block;
    }

    public void setBlock(ReportBlock block) {
        this.block = block;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isReceivesReports() {
        return receivesReports;
    }

    public void setReceivesReports(boolean receivesReports) {
        this.receivesReports = receivesReports;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /** Đồng nhất theo khoá chính — thoả hiệp JPA thường dùng. */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof ReportUnit unit)) {
            return false;
        }
        return id != null && id.equals(unit.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
