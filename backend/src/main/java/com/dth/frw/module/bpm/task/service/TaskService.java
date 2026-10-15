package com.dth.frw.module.bpm.task.service;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.domain.bpm.task.TaskPriority;
import com.dth.frw.domain.bpm.task.TaskStatus;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.system.notification.NotificationLevel;
import com.dth.frw.module.bpm.task.api.dto.DepartmentRef;
import com.dth.frw.module.bpm.task.api.dto.TaskPatchRequest;
import com.dth.frw.module.bpm.task.api.dto.TaskRequest;
import com.dth.frw.module.bpm.task.api.dto.UserRef;
import com.dth.frw.module.bpm.task.repo.TaskRepository;
import com.dth.frw.module.bpm.task.repo.TaskSpecifications;
import com.dth.frw.module.catalog.department.service.DepartmentService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.module.security.user.service.UserService;
import com.dth.frw.module.system.notification.service.NotificationService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TaskService {

    /**
     * Sort properties the list endpoint accepts; anything else is ignored.
     *
     * <p>{@code status} and {@code priority} are deliberately absent. Both are
     * stored as their names, so ordering by either orders alphabetically —
     * {@code HIGH, LOW, MEDIUM, URGENT} — which looks like a working sort and
     * answers a different question from the one the user asked. Filtering by
     * them works; ordering by importance would need a rank column, and nothing
     * has needed one yet.
     */
    private static final Set<String> SORTABLE =
            Set.of("id", "title", "dueDate", "completedAt", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final TaskRepository repository;

    // Each reached through its own feature's service rather than its
    // repository, which also means an unknown id produces the same 404 that
    // resource's own endpoints would.
    private final UserService userService;

    private final DepartmentService departmentService;

    // Assigning work to somebody is exactly what the notification feature is
    // for: NotificationService.notify is called inside this transaction, and it
    // is the row it writes -- not the socket -- that is the record. Whoever is
    // offline finds the notification waiting at their next sign-in.
    private final NotificationService notificationService;

    // Which rows this caller may reach. Reached through a service like every
    // other feature, and every method it offers hands back a Specification
    // rather than running anything -- so the scope becomes part of the query
    // that was going to run anyway, and this whole layer costs no extra SQL.
    private final RowLevelSecurity rowLevel;

    public TaskService(TaskRepository repository,
                       UserService userService,
                       DepartmentService departmentService,
                       NotificationService notificationService,
                       RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.userService = userService;
        this.departmentService = departmentService;
        this.notificationService = notificationService;
        this.rowLevel = rowLevel;
    }

    /**
     * The scope goes first and the caller's filters second, and the order is not
     * cosmetic: {@code Specification.and} has no subtraction, so nothing a query
     * string can say will widen what comes back.
     */
    public Page<Task> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(Task.class, Action.READ)
                        .and(TaskSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    /**
     * One task, if it is inside the caller's read scope.
     *
     * <p>A row outside it produces a {@code 404}, not a {@code 403}, because as
     * far as this caller is concerned it does not exist. Distinguishing the two
     * would turn this endpoint into a way of probing which ids are real — the
     * position {@code NotificationService} already established for somebody
     * else's notifications.
     */
    public Task get(Long id) {
        return repository.findOne(rowLevel.byId(Task.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Task", id));
    }

    /**
     * Resolves the ids a {@code getMany} request asked for, in one query.
     *
     * <p>Returns fewer rows than were asked for when some are out of scope. That
     * is the right answer: Refine uses this to resolve foreign-key labels, so a
     * missing row shows as a dash rather than as somebody else's data.
     */
    public List<Task> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(Task.class, Action.READ, ids));
    }

    @Transactional
    public Task create(TaskRequest request) {
        Task task = new Task(
                request.title().trim(),
                trimToNull(request.description()),
                request.status() == null ? TaskStatus.TODO : request.status(),
                request.priority() == null ? TaskPriority.MEDIUM : request.priority());

        task.setAssignee(resolveUser(request.assignee(), null));
        task.setDepartment(resolveDepartment(request.department(), null));
        task.setDueDate(request.dueDate());
        task.setCreatedBy(currentUser());
        applyCompletion(task, null);

        Task saved = repository.persist(task);
        // Flushed first, because the check has to run against a complete row:
        // before this, `id` is null (identity keys are assigned on flush) and
        // `createdAt` is null (@PrePersist has not run). A harmless-looking
        // policy such as `createdAt >= today` evaluated on that would refuse
        // every create. Throwing after the insert is safe -- the exception marks
        // the transaction rollback-only, so the row goes away again -- and the
        // wasted insert is worth it for a case that is meant to be rare.
        repository.flush();
        rowLevel.checkWritable(saved);

        announceAssignment(saved, null);
        return saved;
    }

    @Transactional
    public Task update(Long id, TaskPatchRequest request) {
        // USING, on the state as it stands. Out of scope is a 404, which is
        // indistinguishable from "no such task" -- deliberately.
        //
        // The entity that gets written is the one that was read through the
        // scope. Reading one copy to check it and then saving a detached copy
        // over the same key would either raise NonUniqueObjectException or,
        // worse, silently overwrite with the detached one.
        Task task = repository.findOne(rowLevel.byId(Task.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Task", id));

        // Kept before anything is written, so the notification below can tell a
        // genuine hand-over from a save that left the assignee alone.
        User previousAssignee = task.getAssignee();
        TaskStatus previousStatus = task.getStatus();

        if (request.title() != null) {
            task.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            task.setDescription(trimToNull(request.description()));
        }
        if (request.status() != null) {
            task.setStatus(request.status());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        if (request.assignee() != null) {
            task.setAssignee(resolveUser(request.assignee(), task.getAssignee()));
        }
        if (request.department() != null) {
            task.setDepartment(resolveDepartment(request.department(), task.getDepartment()));
        }
        if (request.dueDate() != null) {
            // Empty string clears it; the DTO's @Pattern has already rejected
            // anything that is neither empty nor an ISO date.
            task.setDueDate(request.dueDate().isBlank() ? null : LocalDate.parse(request.dueDate()));
        }

        applyCompletion(task, previousStatus);

        // WITH CHECK, on the state this save would leave behind. In memory, on
        // an entity already loaded, so it costs nothing -- and it is what stops
        // a task being moved to another department in order to hide it from
        // your own. USING on its own is a privilege escalation by laundering.
        rowLevel.checkWritable(task);

        Task saved = repository.persist(task);
        announceAssignment(saved, previousAssignee);
        return saved;
    }

    @Transactional
    public Task delete(Long id) {
        // Its own action, not a read followed by a delete: somebody may be
        // allowed to see a row without being allowed to remove it, and reusing
        // the read scope here would quietly grant the second with the first.
        Task task = repository.findOne(rowLevel.byId(Task.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Task", id));
        repository.remove(task);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return task;
    }

    /**
     * Keeps {@code completedAt} agreeing with the status.
     *
     * <p>Derived here rather than accepted from the request, which is what
     * stops the timestamp and the status from ever contradicting each other.
     * The stamp is only written on the transition <em>into</em> {@code DONE},
     * so re-saving a task that was finished last week does not move the date it
     * was finished on.
     *
     * <p>{@code CANCELLED} deliberately does not stamp it. An abandoned task
     * was never completed, and recording a completion date for one would make
     * "how long did this take to finish" quietly wrong.
     */
    private void applyCompletion(Task task, TaskStatus previousStatus) {
        boolean nowDone = task.getStatus() == TaskStatus.DONE;
        boolean wasDone = previousStatus == TaskStatus.DONE;

        if (nowDone && !wasDone) {
            task.setCompletedAt(Instant.now());
        } else if (!nowDone) {
            // Reopened, or moved to cancelled. Either way it is not finished,
            // so a completion date would be a lie left behind by a past state.
            task.setCompletedAt(null);
        }
    }

    /**
     * Tells the new assignee, when there is one and it is not the person who
     * did the assigning.
     *
     * <p>No notification for a save that left the assignee where it was, which
     * is why the previous value is captured before the update runs — otherwise
     * every edit to a task would ping whoever holds it.
     *
     * <p>Nobody is told when they assign a task to themselves: they were the
     * one who just did it, and a bell for your own action is noise.
     */
    private void announceAssignment(Task task, User previousAssignee) {
        User assignee = task.getAssignee();
        if (assignee == null) {
            return;
        }
        if (previousAssignee != null && Objects.equals(previousAssignee.getId(), assignee.getId())) {
            return;
        }
        if (CurrentUser.id().map(id -> id.equals(assignee.getId())).orElse(false)) {
            return;
        }

        notificationService.notify(
                assignee.getId(),
                task.getPriority() == TaskPriority.URGENT
                        ? NotificationLevel.WARNING
                        : NotificationLevel.INFO,
                "Task assigned to you",
                task.getTitle(),
                // A frontend route rather than a URL: the API does not know
                // which host is serving the admin UI.
                "/tasks/show/" + task.getId());
    }

    /**
     * Resolves a {@code {"id": ...}} reference against its own feature.
     *
     * <p>Three states, as everywhere a reference is optional: the caller has
     * already established the field was sent, {@code id == null} means clear
     * it, and an id means set it. {@code current} is returned only for the
     * caller that passes it as a no-op default.
     */
    private User resolveUser(UserRef ref, User current) {
        if (ref == null) {
            return current;
        }
        return ref.id() == null ? null : userService.get(ref.id());
    }

    private Department resolveDepartment(DepartmentRef ref, Department current) {
        if (ref == null) {
            return current;
        }
        return ref.id() == null ? null : departmentService.get(ref.id());
    }

    /** Who is filing this, off the access token. Null on an unauthenticated call. */
    private User currentUser() {
        return CurrentUser.id().map(userService::get).orElse(null);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
