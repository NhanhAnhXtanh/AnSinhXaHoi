package com.dth.frw.domain.catalog.department;

import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.shared.security.rowlevel.RowLevelResource;
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
import java.util.Objects;

/**
 * A unit inside an {@link Organization}.
 *
 * <p>The organization is required: a department that belongs to nobody is not a
 * department, and making the column nullable would mean every screen and every
 * query had to have an opinion about what an orphan means.
 *
 * <p>{@code code} is unique <em>within</em> its organization rather than
 * globally — two companies both having a {@code SALES} is the normal case, and
 * a global constraint would make the second one impossible to name naturally.
 * That is also why the conflict check in the service is scoped by organization,
 * and why moving a department to another organization re-runs it.
 *
 * <p>Under row-level management. The name is the resource name verbatim -- the
 * same string {@code routes.tsx} declares and the same first half as the
 * permission codes -- and what a policy on it may say is declared separately by
 * {@link com.dth.frw.module.catalog.department.security.DepartmentRowLevelPolicies}.
 */
@RowLevelResource("departments")
@Entity
@Table(
        name = "departments",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_departments_organization_code",
                columnNames = {"organization_id", "code"}))
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable identifier, e.g. {@code SALES}. Unique within the organization. */
    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 500)
    private String description;

    // Eager: every list row renders the organization name, so a lazy proxy
    // would just turn one query into N.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(length = 255)
    private String email;

    @Column(length = 64)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DepartmentStatus status = DepartmentStatus.ACTIVE;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Department() {
        // for JPA
    }

    public Department(
            String code,
            String name,
            String description,
            Organization organization,
            DepartmentStatus status) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.organization = organization;
        this.status = status;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public DepartmentStatus getStatus() {
        return status;
    }

    public void setStatus(DepartmentStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /**
     * Identity by primary key — the usual JPA compromise, where a transient
     * instance is only ever equal to itself.
     */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Department department)) {
            return false;
        }
        return id != null && id.equals(department.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
