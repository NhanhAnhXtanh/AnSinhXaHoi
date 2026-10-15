package com.dth.frw.module.catalog.organization.api.dto;

import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Map;
import java.time.Instant;

/** Wire shape of an organization. */
public record OrganizationResponse(
        Long id,
        String code,
        String name,
        String description,
        String email,
        String phone,
        String address,
        OrganizationStatus status,
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

    /** Without row flags — for the echo of a deleted row, which nobody can act on. */
    public static OrganizationResponse from(Organization organization) {
        return from(organization, null);
    }

    public static OrganizationResponse from(Organization organization, RowLevelSecurity rowLevel) {
        return new OrganizationResponse(
                organization.getId(),
                organization.getCode(),
                organization.getName(),
                organization.getDescription(),
                organization.getEmail(),
                organization.getPhone(),
                organization.getAddress(),
                organization.getStatus(),
                organization.getCreatedAt(),
                organization.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(organization));
    }
}
