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
import java.time.Instant;
import java.util.Objects;

/**
 * Một biểu trong bộ mẫu (1a, 1b, …) — chuỗi các {@link TemplateVersion}.
 *
 * <p>Tương ứng "series" của bản Jmix: ở đó chuỗi được định danh bằng
 * {@code sheetCode} (BM-xxxxxx) chép qua từng phiên bản; ở đây chuỗi là một
 * dòng thật, nên {@link #code} chỉ còn là mã nội bộ ổn định cho sổ cái / tổng
 * hợp / tích hợp tham chiếu — hệ thống tự sinh, bất biến, <b>không hiển thị</b>
 * cho người dùng (họ thấy {@link #shortName} và {@link #name}).
 *
 * <p>{@link #shortName} là nhãn ngắn trên tab biểu ("1a") và duy nhất trong bộ
 * mẫu (không phân biệt hoa thường).
 *
 * <p>Trường Java tên {@code templateSet} (cột {@code template_set_id}) chứ không
 * phải {@code set} để khỏi đụng từ khoá {@code SET} của truy vấn; API vẫn đọc /
 * ghi dưới tên {@code set}, và {@link #getSet()} là bí danh cho tiện.
 */
@Entity
@Table(name = "asxh_templates")
public class Template {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Eager: mọi dòng danh sách đều hiện tên bộ mẫu.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_set_id", nullable = false)
    private TemplateSet templateSet;

    /** Mã nội bộ tự sinh (BM-xxxxxx), bất biến, không hiển thị. */
    @Column(nullable = false, length = 32, unique = true, updatable = false)
    private String code;

    /** Nhãn ngắn trên tab biểu, ví dụ {@code 1a}. Duy nhất trong bộ mẫu. */
    @Column(name = "short_name", nullable = false, length = 32)
    private String shortName;

    @Column(nullable = false, length = 500)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TemplateKind kind = TemplateKind.CHI_TIET;

    /** Thứ tự tab biểu trong bộ mẫu; nhỏ đứng trước. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Template() {
        // for JPA
    }

    public Template(TemplateSet templateSet, String code, String shortName, String name,
                    TemplateKind kind, int sortOrder) {
        this.templateSet = templateSet;
        this.code = code;
        this.shortName = shortName;
        this.name = name;
        this.kind = kind;
        this.sortOrder = sortOrder;
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

    public TemplateSet getTemplateSet() {
        return templateSet;
    }

    /** Bí danh của {@link #getTemplateSet()} — tên trường trên API là {@code set}. */
    public TemplateSet getSet() {
        return templateSet;
    }

    public void setTemplateSet(TemplateSet templateSet) {
        this.templateSet = templateSet;
    }

    public String getCode() {
        return code;
    }

    public String getShortName() {
        return shortName;
    }

    public void setShortName(String shortName) {
        this.shortName = shortName;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public TemplateKind getKind() {
        return kind;
    }

    public void setKind(TemplateKind kind) {
        this.kind = kind;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
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
        if (!(other instanceof Template template)) {
            return false;
        }
        return id != null && id.equals(template.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
