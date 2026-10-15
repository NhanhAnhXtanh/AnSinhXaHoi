package com.dth.frw.module.bpm.task.repo;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected, as everywhere else: a new
 * filter control on the frontend degrades to "not narrowed" instead of blanking
 * the table with a 400.
 */
public final class TaskSpecifications {

    private TaskSpecifications() {
    }

    public static Specification<Task> from(ListParams params) {
        List<Specification<Task>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Task> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "title" -> textSpec("title", criterion);
                case "description" -> textSpec("description", criterion);
                case "status" -> statusSpec(criterion);
                case "priority" -> prioritySpec(criterion);
                case "assignee.id", "assigneeId" -> relationSpec("assignee", criterion);
                case "department.id", "departmentId" -> relationSpec("department", criterion);
                case "createdBy.id", "createdById" -> relationSpec("createdBy", criterion);
                case "dueDate" -> dueDateSpec(criterion);
                // Not a column. "Is this late?" is the question a task list is
                // really asked, and it is two conditions over two columns plus
                // today's date, which no single filter field could express.
                case "overdue" -> overdueSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` is the quick filter: one term across title and description,
        // because the provider has no way to express an OR across fields.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            var byText = cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Task> idSpec(ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<Task> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static Specification<Task> statusSpec(ListParams.Criterion criterion) {
        TaskStatus status;
        try {
            status = TaskStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // Filtering by a status that does not exist is a valid question
            // with an empty answer, not a bad request.
            return never();
        }
        if (status == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    private static Specification<Task> prioritySpec(ListParams.Criterion criterion) {
        TaskPriority priority;
        try {
            priority = TaskPriority.from(criterion.value());
        } catch (IllegalArgumentException e) {
            return never();
        }
        if (priority == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("priority"), priority)
                : (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    /**
     * Filters on a nullable to-one association by id.
     *
     * <p>The join has to be an explicit {@code LEFT} one. Writing
     * {@code root.get("assignee").get("id")} lets JPA add an <em>inner</em>
     * join, which drops every unassigned task before the {@code IS NULL} branch
     * below can see it — so {@code _ne} would silently return a subset.
     */
    private static Specification<Task> relationSpec(String attribute, ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return (root, query, cb) -> {
            var join = root.join(attribute, JoinType.LEFT);
            return criterion.operator() == ListParams.Operator.NE
                    ? cb.or(cb.isNull(join.get("id")), cb.notEqual(join.get("id"), id))
                    : cb.equal(join.get("id"), id);
        };
    }

    /**
     * {@code dueDate} filtering. {@code _gte}/{@code _lte} take an ISO date and
     * are real bounds; equality is a single day.
     */
    private static Specification<Task> dueDateSpec(ListParams.Criterion criterion) {
        LocalDate date = parseDate(criterion.value());
        if (date == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.<LocalDate>get("dueDate"), date);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.<LocalDate>get("dueDate"), date);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("dueDate"), date);
            default -> (root, query, cb) -> cb.equal(root.get("dueDate"), date);
        };
    }

    /**
     * {@code overdue=true} — a deadline in the past on a task nobody has
     * closed.
     *
     * <p>"Today" is resolved on the server at query time rather than sent by
     * the client, so the answer cannot depend on a browser clock. It does mean
     * the boundary is the server's day, which is the same day the rest of the
     * application reasons in.
     */
    private static Specification<Task> overdueSpec(ListParams.Criterion criterion) {
        boolean wanted = Boolean.parseBoolean(criterion.value().trim());
        LocalDate today = LocalDate.now();
        return (root, query, cb) -> {
            var late = cb.and(
                    cb.isNotNull(root.get("dueDate")),
                    cb.lessThan(root.<LocalDate>get("dueDate"), today),
                    root.get("status").in(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED));
            return wanted ? late : cb.not(late);
        };
    }

    /** A predicate no row can satisfy — an unmatchable filter value. */
    private static Specification<Task> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
