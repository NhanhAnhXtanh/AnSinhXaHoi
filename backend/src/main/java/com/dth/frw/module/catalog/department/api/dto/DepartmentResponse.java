package com.dth.frw.module.catalog.department.api.dto;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.department.DepartmentStatus;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Map;
import java.time.Instant;

/**
 * Wire shape of a department.
 *
 * <p>{@code organization} is nested rather than flattened to an
 * {@code organizationId} because the admin UI reads {@code organization.name}
 * in the list column and binds its form field to {@code organization.id}.
 */
public record DepartmentResponse(
        Long id,
        String code,
        String name,
        String description,
        OrganizationSummary organization,
        String email,
        String phone,
        DepartmentStatus status,
        Instant createdAt,
        Instant updatedAt,
        /**
         * What this caller may do to <em>this row</em>, as
         * {@code {"write": true, "delete": false}}.
         *
         * <p>{@code USING} and {@code WITH CHECK} together against the state the
         * row is in now, which is the precise answer a button needs. Empty when
         * the resource is unmanaged or an association a policy needs was not
         * fetched.
         */
        @com.fasterxml.jackson.annotation.JsonProperty("_can")
        Map<String, Boolean> can) {

    /**
     * The organization as this endpoint reports it.
     *
     * <p>A narrower shape than the organization resource's own response, and
     * declared here rather than imported: reusing that record would make the
     * organization API's payload part of this endpoint's contract, so widening
     * one response would silently widen the other.
     */
    public record OrganizationSummary(Long id, String code, String name, OrganizationStatus status) {

        static OrganizationSummary from(Organization organization) {
            return new OrganizationSummary(
                    organization.getId(),
                    organization.getCode(),
                    organization.getName(),
                    organization.getStatus());
        }
    }

    /** Without row flags — for the echo of a deleted row, which nobody can act on. */
    public static DepartmentResponse from(Department department) {
        return from(department, null);
    }

    public static DepartmentResponse from(Department department, RowLevelSecurity rowLevel) {
        return new DepartmentResponse(
                department.getId(),
                department.getCode(),
                department.getName(),
                department.getDescription(),
                OrganizationSummary.from(department.getOrganization()),
                department.getEmail(),
                department.getPhone(),
                department.getStatus(),
                department.getCreatedAt(),
                department.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(department));
    }
}
