package com.dth.frw.module.bpm.task.repo;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.shared.data.SecuredRepository;

/**
 * A {@link SecuredRepository}, not a {@code JpaRepository}.
 *
 * <p>That is the whole change, and it is the one that makes the guarantee hold:
 * {@code findById}, {@code findAll()} and {@code findAllById} do not exist here,
 * so no read path can forget to carry a scope. Every method that survives takes
 * a {@code Specification}, and {@code TaskService} is the only thing that builds
 * one.
 *
 * <p>Adding an unscoped read means declaring a method on this interface. That is
 * a thing a reviewer sees.
 */
public interface TaskRepository extends SecuredRepository<Task, Long> {
}
