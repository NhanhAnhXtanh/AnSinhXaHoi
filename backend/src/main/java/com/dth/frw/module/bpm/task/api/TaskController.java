package com.dth.frw.module.bpm.task.api;

import com.dth.frw.domain.bpm.task.Task;
import com.dth.frw.module.bpm.task.api.dto.TaskPatchRequest;
import com.dth.frw.module.bpm.task.api.dto.TaskRequest;
import com.dth.frw.module.bpm.task.api.dto.TaskResponse;
import com.dth.frw.module.bpm.task.service.TaskService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.Permissions;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/tasks} — the {@code tasks} resource of the admin UI.
 *
 * <p>The path segment has to match the resource name declared in the frontend's
 * {@code routes.tsx}, because the data provider builds every endpoint as
 * {@code {apiURL}/{resource}} — and the same name is the first half of the
 * permission codes checked below.
 *
 * <p>{@code tasks:read} decides whether this endpoint answers at all; which rows
 * it answers with is decided a layer further in, by the row-level scope
 * {@code TaskService} folds into every query. The two are sequential and
 * independent: without the permission a caller never reaches the second layer,
 * and with the permission but an empty scope they get an empty list — which is
 * the correct answer, not a fault.
 *
 * <p>Each row carries a {@code _can} object saying what this caller may do to
 * it, so the admin UI hides the Edit and Delete buttons on exactly the rows
 * where they would be refused.
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService service;

    // Only to stamp each row with what this caller may do to it. The filtering
    // itself already happened, inside the service, as part of the query.
    private final RowLevelSecurity rowLevel;

    public TaskController(TaskService service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    /**
     * Serves both {@code getList} and {@code getMany}.
     *
     * <p>They differ only in the query string — {@code getMany} sends
     * {@code ids[n]} and no window — so they share one endpoint, with the id
     * lookup answered unpaged.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.TASKS_READ + "')")
    public ResponseEntity<List<TaskResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<TaskResponse> rows = service.getMany(ids).stream()
                    .map(task -> TaskResponse.from(task, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<Task> page = service.list(params);
        return ListResponse.of(
                page.map(task -> TaskResponse.from(task, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.TASKS_READ + "')")
    public TaskResponse get(@PathVariable Long id) {
        return TaskResponse.from(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.TASKS_WRITE + "')")
    public ResponseEntity<TaskResponse> create(@Valid @RequestBody TaskRequest request) {
        Task created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/tasks/" + created.getId()))
                .body(TaskResponse.from(created, rowLevel));
    }

    /**
     * {@code PATCH} is what the data provider sends by default; {@code PUT} is
     * mapped to the same handler so the resource is also usable from clients
     * that only speak full replacement.
     */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.TASKS_WRITE + "')")
    public TaskResponse update(@PathVariable Long id, @Valid @RequestBody TaskPatchRequest request) {
        return TaskResponse.from(service.update(id, request), rowLevel);
    }

    /** Echoes the deleted row — the data provider parses the response body. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.TASKS_DELETE + "')")
    public TaskResponse delete(@PathVariable Long id) {
        return TaskResponse.from(service.delete(id));
    }
}
