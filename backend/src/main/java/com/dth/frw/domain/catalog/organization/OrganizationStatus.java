package com.dth.frw.domain.catalog.organization;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Whether an organization is still in use.
 *
 * <p>Same wire convention as {@code UserStatus} and {@code BlogPostStatus}: the
 * admin UI sends and renders lower-case values, while the constants stay
 * idiomatic Java.
 *
 * <p>Two values rather than three, because there is nothing here that
 * corresponds to {@code LOCKED} — an organization is either something the
 * business still operates or one it has retired. Retiring one is what the UI
 * offers in place of a delete once departments hang off it, since the
 * {@code RESTRICT} foreign key refuses that delete anyway.
 */
public enum OrganizationStatus {

    /** In use — the default for anything newly created. */
    ACTIVE("active"),

    /** Retired. Kept for the records that still reference it. */
    INACTIVE("inactive");

    private final String value;

    OrganizationStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static OrganizationStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (OrganizationStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw) || status.name().equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown organization status: " + raw);
    }
}
