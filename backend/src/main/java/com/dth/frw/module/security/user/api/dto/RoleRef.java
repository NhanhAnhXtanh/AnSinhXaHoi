package com.dth.frw.module.security.user.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * A role referred to by id in a user payload.
 *
 * <p>The form's multi-select writes to {@code roles[n].id}, and on edit the
 * record it was loaded from still carries the role's code and name, so the
 * payload arrives as whole objects. Only the id is read; anything else is
 * ignored.
 */
public record RoleRef(@NotNull(message = "Role id is required") Long id) {
}
