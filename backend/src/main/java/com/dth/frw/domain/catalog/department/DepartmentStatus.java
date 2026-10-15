package com.dth.frw.domain.catalog.department;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Whether a department is still in use.
 *
 * <p>Shaped like {@code OrganizationStatus} and declared separately rather than
 * shared with it. The two happen to have the same values today, and a single
 * enum would make every future value of one a value of the other — a department
 * that is being reorganised is not a state an organization has.
 */
public enum DepartmentStatus {

    /** In use — the default for anything newly created. */
    ACTIVE("active"),

    /** Disbanded or merged away. Kept for the records that still reference it. */
    INACTIVE("inactive");

    private final String value;

    DepartmentStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static DepartmentStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (DepartmentStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw) || status.name().equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown department status: " + raw);
    }
}
