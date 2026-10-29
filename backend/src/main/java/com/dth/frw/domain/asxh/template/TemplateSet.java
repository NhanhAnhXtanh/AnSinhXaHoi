package com.dth.frw.domain.asxh.template;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Bộ mẫu báo cáo — nhóm các biểu ({@link Template}) ban hành cùng nhau.
 *
 * <p>Port từ {@code QtReportTemplate} của bản Jmix. Tên là duy nhất (không phân
 * biệt hoa thường) — chỉ mục {@code uq_asxh_template_sets_name} trên
 * {@code lower(name)} giữ điều đó ở tầng dữ liệu, service kiểm tra trước để trả
 * câu báo dễ hiểu. Bản cũ có ô Trạng thái nhưng đã gỡ (BR-09.3); "đang sử dụng"
 * được suy ra từ việc có biểu nào đã ban hành hay chưa.
 *
 * <p>Chưa đặt dưới quản lý row-level: bộ mẫu là danh mục dùng chung toàn Sở.
 */
@Entity
@Table(name = "asxh_template_sets")
public class TemplateSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected TemplateSet() {
        // for JPA
    }

    public TemplateSet(String name, String description) {
        this.name = name;
        this.description = description;
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
        if (!(other instanceof TemplateSet set)) {
            return false;
        }
        return id != null && id.equals(set.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
