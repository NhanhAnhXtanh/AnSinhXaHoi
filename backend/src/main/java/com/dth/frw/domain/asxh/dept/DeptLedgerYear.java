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
 * Bộ đếm phiên bản số liệu Sở của MỘT năm + trạng thái khoá năm (port {@code QtDeptLedgerYear}).
 *
 * <p><b>Một dãy phiên bản chung cho cả năm</b> (BR-55.2): mọi lần lưu số liệu kỳ, hoàn tất một
 * biểu, khôi phục — ở bất kỳ kỳ, biểu nào — đều lấy số kế tiếp. Nhờ vậy "số liệu năm ở phiên bản k"
 * là một trạng thái nhất quán và báo cáo năm nộp lên chỉ cần ghim MỘT con số.
 *
 * <p>Dòng của năm bị khoá bi quan ({@code select … for update}) suốt giao dịch ghi — mọi lượt ghi
 * số liệu Sở trong năm xếp hàng tại đây.
 *
 * <p><b>Khoá năm</b> (UC-60): {@link #lockState} do agent BÁO CÁO NĂM đặt qua
 * {@code DeptYearLockService}; khác {@link DeptYearLockState#OPEN} thì mọi kỳ của năm chỉ xem.
 */
@Entity
@Table(name = "asxh_dept_ledger_years")
public class DeptLedgerYear {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "year_no", nullable = false, unique = true, updatable = false)
    private int year;

    /** Phiên bản mới nhất của năm; 0 = chưa có kỳ nào được lưu. */
    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "lock_state", nullable = false, length = 20)
    private DeptYearLockState lockState = DeptYearLockState.OPEN;

    /** Câu giải thích khoá cho người dùng (vd "Năm 2026 đã nộp UBND ngày 10/01/2027"). */
    @Column(name = "lock_note", length = 1000)
    private String lockNote;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "locked_by", length = 255)
    private String lockedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected DeptLedgerYear() {
        // for JPA
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

    public int getYear() {
        return year;
    }

    public int getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(int currentVersion) {
        this.currentVersion = currentVersion;
    }

    public DeptYearLockState getLockState() {
        return lockState;
    }

    public void setLockState(DeptYearLockState lockState) {
        this.lockState = lockState == null ? DeptYearLockState.OPEN : lockState;
    }

    public String getLockNote() {
        return lockNote;
    }

    public void setLockNote(String lockNote) {
        this.lockNote = lockNote;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public void setLockedAt(Instant lockedAt) {
        this.lockedAt = lockedAt;
    }

    public String getLockedBy() {
        return lockedBy;
    }

    public void setLockedBy(String lockedBy) {
        this.lockedBy = lockedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptLedgerYear that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
