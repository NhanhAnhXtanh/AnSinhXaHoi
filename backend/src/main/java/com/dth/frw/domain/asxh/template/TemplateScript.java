package com.dth.frw.domain.asxh.template;

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
import java.time.Instant;
import java.util.Objects;

/**
 * Một kịch bản (script) của phiên bản mẫu — port {@code QtTemplateScript} của bản Jmix.
 *
 * <p>Một phiên bản có NHIỀU kịch bản; mỗi kịch bản là một đoạn mã kết thúc bằng
 * {@code return defineScript({...})} đăng ký một số hook (onLoad, beforeEdit, validate,
 * getInputData, getSummaryData…). Máy chạy biên dịch và chạy TỪNG kịch bản riêng, chỉ kịch bản
 * {@link #enabled}, theo {@link #displayOrder} tăng dần — một kịch bản lỗi cú pháp không kéo
 * các kịch bản khác chết theo.
 *
 * <p>{@link #sheetCode} {@code null} = áp cho mọi biểu của phiên bản; có giá trị = chỉ biểu có
 * mã đó ({@code asxh_templates.code}, BM-xxxxxx). Bản React chốt "một phiên bản đúng một biểu"
 * nên hai lựa chọn chạy như nhau; giữ cột để khớp mô hình và dữ liệu của bản Jmix.
 *
 * <p>{@link #declaredHooks} chỉ để hiển thị (trình duyệt tính khi lưu), không quyết định chạy.
 * {@link #scriptHash} là SHA-256 của {@link #code} lúc lưu.
 */
@Entity
@Table(name = "asxh_template_scripts")
public class TemplateScript {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false)
    private TemplateVersion templateVersion;

    /** {@code null} = mọi biểu; BM-xxxxxx = riêng biểu đó. */
    @Column(name = "sheet_code", length = 32)
    private String sheetCode;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 500)
    private String description;

    /** Mã nguồn JS — bắt buộc nhưng được rỗng khi vừa thêm trong màn soạn. */
    @Column(nullable = false, columnDefinition = "text")
    private String code = "";

    @Column(name = "declared_hooks", length = 500)
    private String declaredHooks;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "script_hash", length = 64)
    private String scriptHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    protected TemplateScript() {
        // for JPA
    }

    public TemplateScript(TemplateVersion templateVersion) {
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

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    public String getSheetCode() {
        return sheetCode;
    }

    public void setSheetCode(String sheetCode) {
        this.sheetCode = sheetCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDeclaredHooks() {
        return declaredHooks;
    }

    public void setDeclaredHooks(String declaredHooks) {
        this.declaredHooks = declaredHooks;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(int displayOrder) {
        this.displayOrder = displayOrder;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getScriptHash() {
        return scriptHash;
    }

    public void setScriptHash(String scriptHash) {
        this.scriptHash = scriptHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof TemplateScript script)) {
            return false;
        }
        return id != null && id.equals(script.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
