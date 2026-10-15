package com.dth.frw.module.security.user.api.dto;

/**
 * A department referred to by id in a user payload.
 *
 * <p>Same "id may be null to clear it" convention as {@link OrganizationRef},
 * and the same reason for it.
 *
 * <p>Sending a department without an organization is not an error: the service
 * takes the organization from the department, which is the only one it could
 * legally be. Sending both and having them disagree <em>is</em> an error, and
 * is refused with a message naming each.
 */
public record DepartmentRef(Long id) {
}
