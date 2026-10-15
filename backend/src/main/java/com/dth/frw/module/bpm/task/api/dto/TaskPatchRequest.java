package com.dth.frw.module.bpm.task.api.dto;

import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * {@code PATCH /tasks/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 *
 * <p>Three fields need a way to say "clear it", and each takes the shape its
 * type allows. {@code assignee} and {@code department} use the nullable-id
 * convention: {@code {"id": null}} clears, {@code {"id": n}} sets. That trick
 * has nowhere to live on a scalar, so {@code dueDate} arrives as a
 * <strong>string</strong> here rather than a {@link LocalDate} — {@code ""}
 * clears it, an ISO date sets it — which is the same "empty string clears"
 * convention the optional text fields elsewhere already use. Typing it as a
 * {@code LocalDate} would look tidier and quietly make the deadline
 * unremovable, because Jackson turns {@code ""} into {@code null} and this
 * record reads {@code null} as "leave it alone".
 *
 * <p>{@code TaskRequest} keeps a real {@link LocalDate}, having nothing to
 * clear on a task that does not exist yet.
 */
public record TaskPatchRequest(
        @Size(min = 1, max = 255, message = "Title must be between 1 and 255 characters")
        String title,

        String description,

        TaskStatus status,

        TaskPriority priority,

        @Valid
        UserRef assignee,

        @Valid
        DepartmentRef department,

        @Pattern(
                regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$",
                message = "Due date must be an ISO date (YYYY-MM-DD), or empty to clear it")
        String dueDate) {
}
