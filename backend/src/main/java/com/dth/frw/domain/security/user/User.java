package com.dth.frw.domain.security.user;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.security.permission.Permission;
import com.dth.frw.domain.security.role.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * An account that can sign in.
 *
 * <p>The password is only ever held as {@link #getPasswordHash()} and never
 * leaves this class in any other form: no DTO exposes it, and the service layer
 * only ever writes an already-encoded value into it.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String username;

    @Column(nullable = false, length = 255, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UserStatus status = UserStatus.ACTIVE;

    // Eager: the list view renders the role badges on every row, and signing in
    // needs the whole role graph to mint a token, so a lazy proxy here would
    // only turn one query into N.
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new LinkedHashSet<>();

    /**
     * Where in the company this account sits. Optional.
     *
     * <p>Nullable because an account is a way to sign in before it is a person
     * on an org chart: the seeded administrator, a service account, somebody
     * whose placement is not known yet. Requiring it would also mean inventing
     * an organization for every account that already exists.
     *
     * <p>Eager, like {@code roles}: the user list renders both of these on
     * every row, so a lazy proxy would only turn one query into N. Being
     * to-one, they widen the row rather than multiply it, which is why they
     * cost the authority cache's load nothing beyond two extra joins.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    /**
     * The unit inside {@link #getOrganization()} this account belongs to.
     * Optional, and never set without an organization.
     *
     * <p>The pair has an invariant — a user's department must belong to that
     * user's organization — and it is the <em>database</em> that holds it, not
     * this class and not the service. {@code users (organization_id,
     * department_id)} is a composite foreign key onto {@code departments
     * (organization_id, id)}, so the two columns cannot disagree no matter who
     * writes them, and moving a department to another organization while
     * somebody is still in it is refused rather than silently leaving those
     * accounts pointing across company lines.
     *
     * <p>That refusal is also what keeps the invariant out of the department
     * feature: checking it there would mean reading the user table from inside
     * a slice that has no business doing so. {@link
     * com.dth.frw.module.security.user.service.UserService} still checks the
     * pair before writing, but only to raise a message naming the organization
     * and the department instead of the constraint.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    /**
     * Đơn vị báo cáo ASXH mà tài khoản này nhập liệu thay mặt. Không bắt buộc.
     *
     * <p>Có đơn vị ⇒ tài khoản <b>cấp Đơn vị</b> (BR-69.1): chỉ thấy và chỉ ghi được phiếu
     * của chính đơn vị đó — bộ lọc nằm ở {@code InputReportRowLevelPolicies}, đọc giá trị
     * này qua bộ nhớ đệm quyền (không truy vấn mỗi request). Để trống ⇒ tài khoản Sở / UBND,
     * không bị lọc theo đơn vị (BR-72.1).
     *
     * <p>EAGER như {@code organization}: danh sách người dùng hiện tên đơn vị trên mỗi dòng
     * và bộ nhớ đệm quyền cần id của nó; quan hệ một-một nên chỉ nới dòng, không nhân dòng.
     * Khoá ngoại {@code RESTRICT}: xoá đơn vị còn tài khoản bị từ chối, vì để trống cột này
     * sẽ biến tài khoản đơn vị thành tài khoản Sở (không bị lọc) mà không ai hay.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "report_unit_id")
    private ReportUnit reportUnit;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {
        // for JPA
    }

    public User(String username, String email, String passwordHash, String fullName, UserStatus status) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
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

    /**
     * Every permission code this user holds, from every role, de-duplicated.
     *
     * <p>This is what is stamped into the access token at login, which is why
     * authorising a request never touches the database.
     */
    public Set<String> permissionCodes() {
        Set<String> codes = new TreeSet<>();
        for (Role role : roles) {
            for (Permission permission : role.getPermissions()) {
                codes.add(permission.getCode());
            }
        }
        return codes;
    }

    /** Role codes, in the same shape and for the same reason as above. */
    public Set<String> roleCodes() {
        Set<String> codes = new TreeSet<>();
        for (Role role : roles) {
            codes.add(role.getCode());
        }
        return codes;
    }

    /** Only an active account may authenticate. */
    public boolean canSignIn() {
        return status == UserStatus.ACTIVE;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    /** Takes an already-encoded hash; encoding is the service layer's job. */
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles.clear();
        this.roles.addAll(roles);
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(Department department) {
        this.department = department;
    }

    public ReportUnit getReportUnit() {
        return reportUnit;
    }

    public void setReportUnit(ReportUnit reportUnit) {
        this.reportUnit = reportUnit;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof User user)) {
            return false;
        }
        return id != null && id.equals(user.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
