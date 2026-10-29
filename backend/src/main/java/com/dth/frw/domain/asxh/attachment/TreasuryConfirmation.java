package com.dth.frw.domain.asxh.attachment;

import com.dth.frw.domain.asxh.report.InputReport;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Ô tích "Đã có phiếu xác nhận của Kho bạc" của một phiếu (BR-38.1) — bản Jmix để là cột
 * {@code treasuryConfirmed} trên phiếu; ở đây tách bảng riêng để slice đính kèm không phải sửa
 * bảng phiếu. Không có dòng = chưa tích.
 *
 * <p>Gắn với một phiên bản phiếu: phiên bản sinh ra khi trả lại không có dòng này nên ô tích tự
 * bỏ (UC-42).
 */
@Entity
@Table(name = "asxh_input_report_treasury_confirmations")
public class TreasuryConfirmation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, unique = true)
    private InputReport report;

    @Column(nullable = false)
    private boolean confirmed;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    protected TreasuryConfirmation() {
        // for JPA
    }

    public TreasuryConfirmation(InputReport report) {
        this.report = report;
    }

    public Long getId() {
        return id;
    }

    public InputReport getReport() {
        return report;
    }

    public boolean isConfirmed() {
        return confirmed;
    }

    public void setConfirmed(boolean confirmed, String by) {
        this.confirmed = confirmed;
        this.updatedAt = Instant.now();
        this.updatedBy = by;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof TreasuryConfirmation that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
