package com.dth.frw.module.catalog.organization.api.dto;

import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /organizations/{id}} payload.
 *
 * <p>A {@code null} field means "leave it unchanged". The admin UI happens to
 * always send the whole form, but keeping the patch semantics honest means the
 * endpoint is also usable from anything that sends a real partial update.
 *
 * <p>The optional text fields are the exception to that rule in one direction:
 * an empty string clears them, because that is the only way a form with a
 * cleared input can say so.
 */
public record OrganizationPatchRequest(
        @Size(min = 1, max = 64, message = "Code must be between 1 and 64 characters")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Code may contain letters, digits, dots, underscores and hyphens only")
        String code,

        @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
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
