package com.dth.frw.domain.bpm.task;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * How much a task matters relative to the others.
 *
 * <p>Stored as its name, like every other enum here, which is what makes the
 * column readable in a query and survivable across a reordering of the
 * constants. The cost is that the database cannot order by importance — sorting
 * the column sorts {@code HIGH, LOW, MEDIUM, URGENT}, which is alphabetical and
 * meaningless — so the list endpoint deliberately does not offer priority as a
 * sort property. Filtering by it works; ordering by it would need a rank column
 * beside this one, and nothing has needed that yet.
 */
public enum TaskPriority {

    LOW("low"),
    MEDIUM("medium"),
    HIGH("high"),
    URGENT("urgent");

    private final String value;

    TaskPriority(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static TaskPriority from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (TaskPriority priority : values()) {
            if (priority.value.equalsIgnoreCase(raw) || priority.name().equalsIgnoreCase(raw)) {
                return priority;
            }
        }
        throw new IllegalArgumentException("Unknown task priority: " + raw);
    }
}
