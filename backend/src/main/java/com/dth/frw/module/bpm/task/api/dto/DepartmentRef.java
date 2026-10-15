package com.dth.frw.module.bpm.task.api.dto;

/**
 * A department referred to by id in a task payload — the team that owns it.
 *
 * <p>Same nullable-id convention as {@link UserRef}, and for the same reason.
 */
public record DepartmentRef(Long id) {
}
