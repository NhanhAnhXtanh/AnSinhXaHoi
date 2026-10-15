package com.dth.frw.module.bpm.task.api.dto;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/** Wire shape of a task. */
public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskStatus status,
        TaskPriority priority,
        /** Null while nobody has picked it up. */
        UserSummary assignee,
        /** Null when no team owns it. */
        DepartmentSummary department,
        LocalDate dueDate,
        Instant completedAt,
        /** Null once the account that raised it has been deleted. */
        UserSummary createdBy,
        /**
         * Whether the deadline has passed with the task still open.
         *
         * <p>Reported rather than left to the client to work out, so that "late"
         * means the same thing in the list, in the filter and in any other
         * client: a browser in another timezone would otherwise disagree with
         * the {@code overdue} filter about which tasks are late today.
         */
        boolean overdue,
        Instant createdAt,
        Instant updatedAt,
        /**
         * What this caller may do to <em>this row</em>, as
         * {@code {"write": true, "delete": false}}.
         *
         * <p>Computed as {@code USING} and {@code WITH CHECK} together against
         * the state the row is in now, which is the precise answer a button
         * needs: "you may open the edit form, as long as you do not push this
         * out of your scope". Reporting {@code USING} alone would show an Edit
         * button that always ends in a 422 — the flag saying one thing while the
         * system does another. Whether a <em>particular</em> change is allowed
         * is still the server's answer, and 422 is where it gives it.
         *
         * <p>Underscore-prefixed to keep it out of the business namespace, and
         * empty when the resource is unmanaged or an association a policy needs
         * was not fetched.
         */
        @com.fasterxml.jackson.annotation.JsonProperty("_can")
        Map<String, Boolean> can) {

    /**
     * The user as this endpoint reports it — no email, no status, no roles.
     *
     * <p>Declared here rather than imported from the user slice: reusing that
     * record would make the user API's payload part of this endpoint's
     * contract, so widening one response would silently widen the other. It is
     * also why this is narrow — a task row has no business carrying an
     * account's status around.
     */
    public record UserSummary(Long id, String username, String fullName) {

        public static UserSummary from(User user) {
            return new UserSummary(user.getId(), user.getUsername(), user.getFullName());
        }
    }

    /** The department as this endpoint reports it. */
    public record DepartmentSummary(Long id, String code, String name) {

        public static DepartmentSummary from(Department department) {
            return new DepartmentSummary(
                    department.getId(), department.getCode(), department.getName());
        }
    }

    /**
     * Without row flags — for a caller that has no scope to report against, such
     * as the echo of a deleted row.
     */
    public static TaskResponse from(Task task) {
        return from(task, null);
    }

    public static TaskResponse from(Task task, RowLevelSecurity rowLevel) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getPriority(),
                summarize(task.getAssignee(), rowLevel, UserSummary::from),
                summarize(task.getDepartment(), rowLevel, DepartmentSummary::from),
                task.getDueDate(),
                task.getCompletedAt(),
                summarize(task.getCreatedBy(), rowLevel, UserSummary::from),
                task.isOverdue(),
                task.getCreatedAt(),
                task.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(task));
    }

    /**
     * An embedded summary, masked when the caller may not read the row it came
     * from.
     *
     * <p>A row-level scope filters the <em>root</em> of the resource being
     * served; it does not follow into the summaries hanging off it. So a task a
     * manager can see could carry the name of somebody the manager is not
     * allowed to look up — the data reaching them sideways, through a payload
     * rather than through a list.
     *
     * <p>The tool for this already exists: {@code EntityEvaluator} answers "may
     * this caller read this row" from memory. Two conditions keep it honest.
     * The association must already be fetched, which
     * {@code TaskRowLevelPolicies.fields()} guarantees by declaring it — every
     * to-one on {@code Task} is eager, so this costs nothing today and would
     * cost nothing on a lazy one either, because the flags are simply not
     * reported when something was not fetched. And it applies only to a class
     * that is itself under management: {@code canRead} answers true for anything
     * unmanaged, so an ordinary summary is unaffected and pays nothing.
     */
    private static <E, S> S summarize(E entity, RowLevelSecurity rowLevel, java.util.function.Function<E, S> to) {
        if (entity == null) {
            return null;
        }
        if (rowLevel != null && !rowLevel.canRead(entity)) {
            // Null rather than a partial summary: the client shows a dash, which
            // reads as "not available to you" instead of as an empty field
            // somebody forgot to fill in.
            return null;
        }
        return to.apply(entity);
    }
}
