package com.dth.frw.domain.catalog.organization;

import com.dth.frw.shared.security.rowlevel.RowLevelResource;
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
 * A company, subsidiary or other top-level body that departments belong to.
 *
 * <p>{@link #getCode()} is the stable handle — short, unique and meant to be
 * quoted by people rather than an id nobody can remember. The name is what the
 * UI renders; the code is what a person types into a filter and what an import
 * or an integration joins on, which is why it is unique and why the service
 * refuses a duplicate with a message about the field rather than letting the
 * index raise a 409 about a constraint name.
 *
 * <p>Under row-level management. The name is the resource name verbatim -- the
 * same string {@code routes.tsx} declares and the same first half as the
 * permission codes -- and what a policy on it may say is declared separately by
 * {@link com.dth.frw.module.catalog.organization.security.OrganizationRowLevelPolicies}.
 */
@RowLevelResource("organizations")
@Entity
@Table(name = "organizations")
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable identifier, e.g. {@code HQ}. Unique, case-insensitively. */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(length = 255)
    private String email;

    @Column(length = 64)
    private String phone;

    @Column(length = 500)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrganizationStatus status = OrganizationStatus.ACTIVE;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Organization() {
        // for JPA
    }

    public Organization(String code, String name, String description, OrganizationStatus status) {
        this.code = code;
        this.name = name;
        this.description = description;
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

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public OrganizationStatus getStatus() {
        return status;
    }

    public void setStatus(OrganizationStatus status) {
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
        if (!(other instanceof Organization organization)) {
            return false;
        }
        return id != null && id.equals(organization.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
