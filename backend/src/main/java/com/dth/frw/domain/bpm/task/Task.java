package com.dth.frw.domain.bpm.task;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * A unit of work somebody is expected to do.
 *
 * <p>Everything except the title and the two enums is optional, and that is the
 * point: a task is usually raised before it is known who will do it, when it is
 * due, or which team owns it. Requiring any of those would push people into
 * inventing a value to get past the form.
 *
 * <p>{@link #getCompletedAt()} is derived rather than entered — see
 * {@link com.dth.frw.module.bpm.task.service.TaskService}, which stamps it when
 * the status first reaches {@link TaskStatus#DONE} and clears it if the task is
 * reopened. Keeping it out of the request payload is what stops the timestamp
 * and the status from ever disagreeing.
 *
 * <p>Under row-level management. The name is the resource name verbatim -- the
 * same string {@code routes.tsx} declares, the same first half as
 * {@code tasks:read}, the same segment {@code TaskController} is mapped at --
 * because there is no lookup table between the layers to fall out of step. What
 * a policy on it may say is declared separately, by
 * {@link com.dth.frw.module.bpm.task.security.TaskRowLevelPolicies}: an entity
 * is a data model, and which of its columns may carry a security decision is a
 * different question.
 */
@RowLevelResource("tasks")
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TaskStatus status = TaskStatus.TODO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TaskPriority priority = TaskPriority.MEDIUM;

    // Eager, like every other to-one on a row the list renders: the table shows
    // the assignee on every line, so a lazy proxy would only turn one query
    // into N. Being to-one it widens the row rather than multiplying it.
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assignee_id")
    private User assignee;

    /**
     * The team that owns the task, which is not the same question as who is
     * doing it — an unassigned task can still belong to a department, and a
     * task can be handed to somebody outside the one that owns it.
     *
     * <p>Deliberately carries no organization beside it, unlike {@code users}:
     * a department already knows its own, and there is no second field here to
     * disagree with it.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    /** A date rather than an instant: a deadline is a day, not a moment. */
    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completed_at")
    private Instant completedAt;

    /**
     * Who raised it, stamped from the access token at creation and never
     * editable afterwards. {@code ON DELETE SET NULL} rather than
     * {@code RESTRICT}, unlike the rest of the schema: the history of who filed
     * a task is worth keeping, but not worth refusing to delete a leaver's
     * account over.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Task() {
        // for JPA
    }

    public Task(String title, String description, TaskStatus status, TaskPriority priority) {
        this.title = title;
        this.description = description;
        this.status = status;
        this.priority = priority;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /** True once the task needs no further work, whichever way it ended. */
    public boolean isClosed() {
        return status != null && status.isClosed();
    }

    /**
     * True when the deadline has passed and the work has not been closed.
     *
     * <p>Computed rather than stored, because a stored flag would be wrong
     * every night at midnight until something wrote to the row.
     */
    public boolean isOverdue() {
        return dueDate != null && !isClosed() && dueDate.isBefore(LocalDate.now());
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public TaskPriority getPriority() {
        return priority;
    }

    public void setPriority(TaskPriority priority) {
        this.priority = priority;
    }

    public User getAssignee() {
        return assignee;
    }

    public void setAssignee(User assignee) {
        this.assignee = assignee;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(Department department) {
        this.department = department;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Task task)) {
            return false;
        }
        return id != null && id.equals(task.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
