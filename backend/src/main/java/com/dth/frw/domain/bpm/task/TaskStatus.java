package com.dth.frw.domain.bpm.task;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Where a task has got to.
 *
 * <p>Same wire convention as every other enum here: the admin UI sends and
 * renders the lower-case values while the constants stay idiomatic Java.
 *
 * <p>{@link #DONE} and {@link #CANCELLED} are both endings and are kept apart
 * on purpose — "finished" and "abandoned" are the same row only to a boolean.
 * {@link com.dth.frw.module.bpm.task.service.TaskService} stamps
 * {@code completedAt} on the first and not the second.
 */
public enum TaskStatus {

    /** Raised, not started. */
    TODO("todo"),

    /** Somebody is working on it. */
    IN_PROGRESS("in_progress"),

    /** Started and stuck, waiting on something outside the task. */
    BLOCKED("blocked"),

    /** Finished. */
    DONE("done"),

    /** Abandoned — it will not be done, and that is the answer. */
    CANCELLED("cancelled");

    private final String value;

    TaskStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static TaskStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (TaskStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw) || status.name().equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown task status: " + raw);
    }

    /** True for the two states that mean the task needs no more work. */
    public boolean isClosed() {
        return this == DONE || this == CANCELLED;
    }
}
