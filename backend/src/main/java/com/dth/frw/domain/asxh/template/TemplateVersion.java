package com.dth.frw.domain.asxh.template;

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
 * Một phiên bản của một biểu — giữ workbook và script của biểu tại một thời
 * điểm áp dụng.
 *
 * <p>Gộp {@code QtTemplateVersion} + {@code QtTemplateSheet} +
 * {@code QtTemplateScript} của bản Jmix: bản cũ đã chốt "một phiên bản đúng một
 * biểu" (BR-11.1) nên tách ba bảng không còn lý do. Workbook SpreadJS và script
 * lưu nguyên dạng văn bản (JSON / mã JS).
 * TODO: chưa port máy chạy script phía máy chủ (GraalJS) và chuẩn hoá workbook
 * (cắt dòng trống, gỡ sheet "Evaluation Version") — hiện chỉ lưu và trả lại.
 *
 * <p>{@link #previousVersion} là bản nguồn khi tạo bằng "phiên bản kế tiếp";
 * phiên bản đầu chuỗi để trống. Quan hệ này là thứ giữ chuỗi thẳng (không rẽ
 * nhánh) và quy tắc "ngày áp dụng phải sau bản nguồn".
 *
 * <p>{@link #effectiveTo} không do người dùng nhập (BR-13.1): service tính lại
 * mỗi khi trạng thái trong chuỗi đổi — bằng ngày trước ngày áp dụng của bản đã
 * ban hành kế sau, để trống với bản cuối và với mọi bản không ở trạng thái
 * {@link TemplateStatus#PUBLISHED}.
 */
@Entity
@Table(
        name = "asxh_template_versions",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_asxh_template_versions_template_no",
                columnNames = {"template_id", "version_no"}))
public class TemplateVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Eager: mọi màn phiên bản đều hiện tên biểu và bộ mẫu.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    /** Số thứ tự phiên bản trong biểu, bắt đầu từ 1. */
    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_version_id")
    private TemplateVersion previousVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TemplateStatus status = TemplateStatus.DRAFT;

    @Column(name = "effective_from")
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /** Workbook SpreadJS (JSON). */
    @Column(name = "workbook_json", nullable = false, columnDefinition = "text")
    private String workbookJson = "{}";

    /** Script của biểu (mã JS theo các hook onLoad, validate, getInputData…). */
    @Column(name = "script_text", nullable = false, columnDefinition = "text")
    private String scriptText = "";

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "published_by", length = 255)
    private String publishedBy;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by", length = 255)
    private String revokedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected TemplateVersion() {
        // for JPA
    }

    public TemplateVersion(Template template, int versionNo, TemplateVersion previousVersion) {
        this.template = template;
        this.versionNo = versionNo;
        this.previousVersion = previousVersion;
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

    public Template getTemplate() {
        return template;
    }

    public int getVersionNo() {
        return versionNo;
    }

    public TemplateVersion getPreviousVersion() {
        return previousVersion;
    }

    public TemplateStatus getStatus() {
        return status;
    }

    public void setStatus(TemplateStatus status) {
        this.status = status;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public LocalDate getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(LocalDate effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public String getWorkbookJson() {
        return workbookJson;
    }

    public void setWorkbookJson(String workbookJson) {
        this.workbookJson = workbookJson;
    }

    public String getScriptText() {
        return scriptText;
    }

    public void setScriptText(String scriptText) {
        this.scriptText = scriptText;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(String publishedBy) {
        this.publishedBy = publishedBy;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedBy() {
        return revokedBy;
    }

    public void setRevokedBy(String revokedBy) {
        this.revokedBy = revokedBy;
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
        if (!(other instanceof TemplateVersion version)) {
            return false;
        }
        return id != null && id.equals(version.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
