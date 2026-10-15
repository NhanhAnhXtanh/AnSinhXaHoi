package com.dth.frw.module.bpm.task.api.dto;

import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * {@code POST /tasks} payload.
 *
 * <p>Only the title is required. A task is usually raised before it is known
 * who will do it, when it is due or which team owns it, and requiring any of
 * those would push people into inventing a value to get past the form.
 *
 * <p>There is no {@code completedAt} and no {@code createdBy}: the first is
 * derived from the status and the second is stamped from the access token, so
 * neither is something a caller gets to assert.
 */
public record TaskRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must be at most 255 characters")
        String title,

        String description,

        /** Optional; a task created without one starts as {@code todo}. */
        TaskStatus status,

        /** Optional; a task created without one is {@code medium}. */
        TaskPriority priority,

        @Valid
        UserRef assignee,

        @Valid
        DepartmentRef department,

        LocalDate dueDate) {
}
