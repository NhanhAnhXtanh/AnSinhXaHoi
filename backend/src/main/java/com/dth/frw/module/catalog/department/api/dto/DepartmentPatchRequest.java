package com.dth.frw.module.catalog.department.api.dto;

import com.dth.frw.domain.catalog.department.DepartmentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /departments/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 *
 * <p>Moving a department to another organization is a legitimate edit, so
 * {@code organization} is patchable; the service re-runs the duplicate-code
 * check against the destination, because a code is only unique within one
 * organization.
 */
public record DepartmentPatchRequest(
        @Size(min = 1, max = 64, message = "Code must be between 1 and 64 characters")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Code may contain letters, digits, dots, underscores and hyphens only")
        String code,

        @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
        String name,

        @Size(max = 500, message = "Description must be at most 500 characters")
        String description,

        @Valid
        OrganizationRef organization,

        @Email(message = "Enter a valid email address")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @Size(max = 64, message = "Phone must be at most 64 characters")
        String phone,

        DepartmentStatus status) {
}
