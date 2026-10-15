package com.dth.frw.module.security.role.api.dto;

import com.dth.frw.domain.security.permission.Permission;
import com.dth.frw.domain.security.role.Role;
import java.util.Comparator;
import java.util.List;

/**
 * Wire shape of a role.
 *
 * <p>{@code permissions} is nested rather than flattened to an id list because
 * the admin UI renders the codes on the show page and binds the form's
 * multi-select to the objects it was given.
 */
public record RoleResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean systemRole,
        List<PermissionSummary> permissions) {

    /**
     * The permission as this endpoint reports it.
     *
     * <p>Shape-identical to the permission resource's own response today, and
     * declared here anyway: reusing that record would make the permission API's
     * payload part of this endpoint's contract, so widening one would silently
     * widen the other.
     */
    public record PermissionSummary(Long id, String code, String name) {

        static PermissionSummary from(Permission permission) {
            return new PermissionSummary(permission.getId(), permission.getCode(), permission.getName());
        }
    }

    public static RoleResponse from(Role role) {
        return new RoleResponse(
                role.getId(),
                role.getCode(),
                role.getName(),
                role.getDescription(),
                role.isSystemRole(),
                role.getPermissions().stream()
                        // Sorted by code so the show page and the form list the
                        // grants in a stable order rather than in whatever
                        // order the join table came back in.
                        .sorted(Comparator.comparing(Permission::getCode))
                        .map(PermissionSummary::from)
                        .toList());
    }
}
