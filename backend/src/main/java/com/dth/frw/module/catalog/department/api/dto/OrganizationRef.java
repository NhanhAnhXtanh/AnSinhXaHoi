package com.dth.frw.module.catalog.department.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * The {@code organization} object on a department request body.
 *
 * <p>The form's select writes to {@code organization.id}, and on edit the record
 * it was loaded from still carries the organization's other fields, so the
 * payload arrives as a whole object. Only the id is read; any other property is
 * ignored.
 */
public record OrganizationRef(@NotNull(message = "Organization is required") Long id) {
}
