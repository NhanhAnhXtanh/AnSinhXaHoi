package com.dth.frw.module.catalog.organization.api.dto;

import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /organizations} payload.
 *
 * <p>{@code status} is optional — an organization created without one starts
 * active, which is what the form's default already sends.
 */
public record OrganizationRequest(
        @NotBlank(message = "Code is required")
        @Size(max = 64, message = "Code must be at most 64 characters")
        // The same shape a role code has: something a person can type into a
        // filter or quote in a spreadsheet without quoting rules getting
        // involved.
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Code may contain letters, digits, dots, underscores and hyphens only")
        String code,

        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be at most 255 characters")
        String name,

        @Size(max = 500, message = "Description must be at most 500 characters")
        String description,

        @Email(message = "Enter a valid email address")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @Size(max = 64, message = "Phone must be at most 64 characters")
        String phone,

        @Size(max = 500, message = "Address must be at most 500 characters")
        String address,

        OrganizationStatus status) {
}
