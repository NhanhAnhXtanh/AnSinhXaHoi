package com.dth.frw.module.security.user.api.dto;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.security.role.Role;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Wire shape of a user.
 *
 * <p>No password field of any kind, hashed or otherwise: this record is the
 * only way a user leaves the application, so the hash having no place to go is
 * what guarantees it never does.
 *
 * <p>{@code roles} is nested rather than flattened to an id list because the
 * list view renders the role names as badges and the form binds its
 * multi-select to the objects it was given.
 */
public record UserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        UserStatus status,
        List<RoleSummary> roles,
        /** Null for an account that has not been placed. */
        OrganizationSummary organization,
        /** Null for an account in no department, placed or otherwise. */
        DepartmentSummary department,
        /** Đơn vị báo cáo ASXH; null với tài khoản Sở / UBND. */
        ReportUnitSummary reportUnit,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt) {

    /**
     * The role as this endpoint reports it.
     *
     * <p>Deliberately narrower than the role resource's own response — no
     * permission list, which a user row has no use for — and declared here
     * rather than imported so that widening the role endpoint cannot silently
     * widen this one.
     */
    public record RoleSummary(Long id, String code, String name) {

        static RoleSummary from(Role role) {
            return new RoleSummary(role.getId(), role.getCode(), role.getName());
        }
    }

    /**
     * The organization as this endpoint reports it — narrower than the
     * organization resource's own payload, and declared here rather than
     * imported for the same reason {@link RoleSummary} is.
     */
    public record OrganizationSummary(Long id, String code, String name) {

        static OrganizationSummary from(Organization organization) {
            return new OrganizationSummary(
                    organization.getId(), organization.getCode(), organization.getName());
        }
    }

    /**
     * The department as this endpoint reports it.
     *
     * <p>Carries no organization of its own, unlike the department resource's
     * payload: a user row already reports the organization beside it, and by
     * the composite foreign key on {@code users} the two cannot differ, so
     * nesting it again would only invite a reader to wonder which one wins.
     */
    public record DepartmentSummary(Long id, String code, String name) {

        static DepartmentSummary from(Department department) {
            return new DepartmentSummary(
                    department.getId(), department.getCode(), department.getName());
        }
    }

    /**
     * Đơn vị báo cáo theo cách endpoint này báo — khai riêng, không dùng chung DTO của slice
     * đơn vị. {@code active} để form người dùng báo trước "đơn vị đã ngừng hoạt động".
     */
    public record ReportUnitSummary(Long id, String budgetCode, String name, boolean active) {

        static ReportUnitSummary from(ReportUnit unit) {
            return new ReportUnitSummary(unit.getId(), unit.getBudgetCode(), unit.getName(), unit.isActive());
        }
    }

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getStatus(),
                user.getRoles().stream()
                        // Sorted by code so the badges keep a stable order
                        // rather than whatever order the join table returned.
                        .sorted(Comparator.comparing(Role::getCode))
                        .map(RoleSummary::from)
                        .toList(),
                user.getOrganization() == null
                        ? null
                        : OrganizationSummary.from(user.getOrganization()),
                user.getDepartment() == null
                        ? null
                        : DepartmentSummary.from(user.getDepartment()),
                user.getReportUnit() == null
                        ? null
                        : ReportUnitSummary.from(user.getReportUnit()),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getLastLoginAt());
    }
}
