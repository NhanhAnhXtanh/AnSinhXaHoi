package com.dth.frw.module.bpm.task.api.dto;

/**
 * A user referred to by id in a task payload — the assignee.
 *
 * <p>The id is nullable, following the same three-state convention the user
 * slice uses for placement: omitting {@code assignee} leaves it alone,
 * {@code {"id": null}} unassigns the task, and {@code {"id": n}} assigns it.
 * Jackson reports an omitted object and an explicit {@code null} identically,
 * so the distinction has to live one level down in the id.
 */
public record UserRef(Long id) {
}
