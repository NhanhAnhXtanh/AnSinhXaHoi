package com.dth.frw.domain.asxh.dept;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.Objects;

/**
 * Một biểu trong số liệu Sở của một kỳ (port {@code QtDeptReportSheet}).
 *
 * <p>{@code templateVersion} = phiên bản biểu chọn theo NGÀY ĐẦU KỲ lúc lưu (BR-50.5), ghim cố
 * định. {@code draftJson} = bảng Sở đang sửa dở, CHƯA vào số liệu (UC-55 "Lưu dữ liệu"); số liệu
 * chỉ đổi khi "Kiểm tra &amp; hoàn tất" — máy chủ chạy hook {@code getSummaryData} trên bảng này.
 *
 * <p>{@link #revision} ({@code @Version}) chống ghi đè giữa hai phiên sửa cùng biểu.
 */
@Entity
@Table(
        name = "asxh_dept_report_sheets",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_dept_report_sheets_report_template",
                columnNames = {"report_id", "template_id"}))
public class DeptReportSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false, updatable = false)
    private DeptReport report;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private Template template;

    /** Phiên bản mẫu đã ghim — LAZY vì mang workbook vài MB. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false, updatable = false)
    private TemplateVersion templateVersion;

    @Column(name = "template_version_id", insertable = false, updatable = false)
    private Long templateVersionId;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "draft_json", columnDefinition = "text")
    private String draftJson;

    @Column(name = "draft_updated_at")
    private Instant draftUpdatedAt;

    @Column(name = "draft_updated_by", length = 255)
    private String draftUpdatedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeptSheetCompletion completion = DeptSheetCompletion.IN_PROGRESS;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "completed_by", length = 255)
    private String completedBy;

    @Version
    @Column(name = "revision", nullable = false)
    private long revision;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DeptReportSheet() {
        // for JPA
    }

    public DeptReportSheet(DeptReport report, Template template, TemplateVersion templateVersion, int displayOrder) {
        this.report = report;
        this.template = template;
        this.templateVersion = templateVersion;
        this.displayOrder = displayOrder;
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

    public DeptReport getReport() {
        return report;
    }

    public Template getTemplate() {
        return template;
    }

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    /** Id phiên bản đã ghim; thực thể vừa tạo thì lấy qua tham chiếu. */
    public Long getTemplateVersionId() {
        if (templateVersionId != null) {
            return templateVersionId;
        }
        return templateVersion == null ? null : templateVersion.getId();
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public String getDraftJson() {
        return draftJson;
    }

    public void setDraftJson(String draftJson) {
        this.draftJson = draftJson;
    }

    public Instant getDraftUpdatedAt() {
        return draftUpdatedAt;
    }

    public void setDraftUpdatedAt(Instant draftUpdatedAt) {
        this.draftUpdatedAt = draftUpdatedAt;
    }

    public String getDraftUpdatedBy() {
        return draftUpdatedBy;
    }

    public void setDraftUpdatedBy(String draftUpdatedBy) {
        this.draftUpdatedBy = draftUpdatedBy;
    }

    /** Có bảng đang sửa dở chưa vào số liệu (tab mang dấu •). */
    public boolean hasPendingDraft() {
        return draftUpdatedAt != null;
    }

    public DeptSheetCompletion getCompletion() {
        return completion;
    }

    public void setCompletion(DeptSheetCompletion completion) {
        this.completion = completion;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }

    public long getRevision() {
        return revision;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DeptReportSheet that)) {
            return false;
        }
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
