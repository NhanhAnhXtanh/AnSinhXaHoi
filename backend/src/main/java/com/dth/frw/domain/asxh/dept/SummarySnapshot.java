package com.dth.frw.domain.asxh.dept;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.TemplateVersion;
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
 * Ảnh chụp workbook tổng hợp của (kỳ × phiên bản mẫu) — UC-57, port {@code QtSummarySnapshot}.
 * Chỉ là bản lưu hiển thị, KHÔNG dùng để tính (BR-57.1). Khoá ngoại RESTRICT tới phiên bản mẫu
 * nên ảnh chụp chặn xoá phiên bản đó (UC-16).
 */
@Entity
@Table(
        name = "asxh_summary_snapshots",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_summary_snapshots_period_version",
                columnNames = {"period_id", "template_version_id"}))
public class SummarySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "period_id", nullable = false, updatable = false)
    private ReportPeriod period;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false, updatable = false)
    private TemplateVersion templateVersion;

    @Column(name = "workbook_json", nullable = false, columnDefinition = "text")
    private String workbookJson;

    @Column(name = "rendered_at", nullable = false)
    private Instant renderedAt;

    @Column(name = "rendered_by", length = 255)
    private String renderedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected SummarySnapshot() {
        // for JPA
    }

    public SummarySnapshot(ReportPeriod period, TemplateVersion templateVersion) {
        this.period = period;
        this.templateVersion = templateVersion;
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

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    public String getWorkbookJson() {
        return workbookJson;
    }

    public void setWorkbookJson(String workbookJson) {
        this.workbookJson = workbookJson;
    }

    public Instant getRenderedAt() {
        return renderedAt;
    }

    public void setRenderedAt(Instant renderedAt) {
        this.renderedAt = renderedAt;
    }

    public String getRenderedBy() {
        return renderedBy;
    }

    public void setRenderedBy(String renderedBy) {
        this.renderedBy = renderedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof SummarySnapshot that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
