package com.dth.frw.module.catalog.department.api.dto;

import com.dth.frw.domain.catalog.department.DepartmentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /departments} payload.
 *
 * <p>{@code status} is optional — a department created without one starts
 * active, which is what the form's default already sends. The organization is
 * not optional: a department that belongs to nobody is not a department.
 */
public record DepartmentRequest(
        @NotBlank(message = "Code is required")
        @Size(max = 64, message = "Code must be at most 64 characters")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Code may contain letters, digits, dots, underscores and hyphens only")
        String code,

        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be at most 255 characters")
        String name,

        @Size(max = 500, message = "Description must be at most 500 characters")
        String description,

        @NotNull(message = "Organization is required")
        @Valid
        OrganizationRef organization,

        @Email(message = "Enter a valid email address")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @Size(max = 64, message = "Phone must be at most 64 characters")
        String phone,

        DepartmentStatus status) {
}
