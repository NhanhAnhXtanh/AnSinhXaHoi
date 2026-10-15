package com.dth.frw.module.bpm.task.security;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What a row-level policy on {@code tasks} may say.
 *
 * <p>It lives in the task slice because a feature's policies belong to that
 * feature, and it implements an interface from {@code shared/} so the task slice
 * never has to know the policy engine exists. The dependency the other way —
 * {@code TaskService} calling {@code RowLevelSecurity} — goes through a
 * {@code service}, exactly as its calls to {@code UserService} and
 * {@code NotificationService} do.
 */
@Component
public class TaskRowLevelPolicies implements RowLevelPolicySet<Task> {

    @Override
    public String resource() {
        return "tasks";
    }

    @Override
    public Class<Task> entityClass() {
        return Task.class;
    }

    /**
     * {@code FULL}, because {@code tasks} is already running with data in it.
     *
     * <p>Switching row-level management on therefore changes nobody's view:
     * every role starts with no scope, and no scope under {@code FULL} means not
     * narrowed. That is what makes this shippable without a seed migration and
     * without a day on which somebody loses a row.
     *
     * <p>It is not the destination. Once all three roles have a scope for all
     * three actions — watch the coverage matrix until no cell is red — this
     * becomes {@code NONE}, and from then on a role nobody wrote a policy for
     * sees nothing instead of everything. See {@link DefaultScope}.
     */
    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    /**
     * The closed set of fields a policy may mention.
     *
     * <p>{@code title} and {@code description} are deliberately absent: free
     * text is not a security boundary, and a scope written over it would break
     * the first time somebody renamed a task.
     */
    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.column("status", TaskStatus.class, false),
                FieldDescriptor.column("priority", TaskPriority.class, false),
                FieldDescriptor.column("dueDate", LocalDate.class),
                FieldDescriptor.column("completedAt", Instant.class),
                FieldDescriptor.column("createdAt", Instant.class, false),
                // The to-one associations. Declared here so that (a) the
                // compiler emits an EXISTS against the right table, and (b) the
                // read path knows what has to be fetched before row flags can be
                // computed without an N+1.
                FieldDescriptor.reference("assignee", User.class),
                FieldDescriptor.reference("department", Department.class),
                FieldDescriptor.reference("createdBy", User.class));
    }

    /**
     * Fields a {@code write} policy may not use, because their value only exists
     * after the row has been flushed.
     *
     * <p>Refused at the moment such a policy is <em>saved</em>, with the reason
     * given. The alternative is that somebody writes {@code createdAt >= today},
     * everything looks fine, and then every attempt to create a task is turned
     * down for no visible cause — a bug that looks like it lives in the create
     * form.
     */
    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt", "completedAt");
    }
}
