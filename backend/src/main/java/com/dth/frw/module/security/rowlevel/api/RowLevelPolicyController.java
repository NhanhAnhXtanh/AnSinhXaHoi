package com.dth.frw.module.security.rowlevel.api;

import com.dth.frw.domain.security.rowlevel.RowLevelPolicy;
import com.dth.frw.module.security.rowlevel.api.dto.CoverageResponse;
import com.dth.frw.module.security.rowlevel.api.dto.ExplainResponse;
import com.dth.frw.module.security.rowlevel.api.dto.PolicyMetadataResponse;
import com.dth.frw.module.security.rowlevel.api.dto.RowLevelPolicyPatchRequest;
import com.dth.frw.module.security.rowlevel.api.dto.RowLevelPolicyRequest;
import com.dth.frw.module.security.rowlevel.api.dto.RowLevelPolicyResponse;
import com.dth.frw.module.security.rowlevel.api.dto.SimulateRequest;
import com.dth.frw.module.security.rowlevel.api.dto.SimulateResponse;
import com.dth.frw.module.security.rowlevel.service.RowLevelPolicyInsights;
import com.dth.frw.module.security.rowlevel.service.RowLevelPolicyService;
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
 * {@code /api/row_level_policies} — data scopes, as an ordinary resource of the
 * admin UI.
 *
 * <p>It speaks the data provider's dialect like every other resource:
 * {@code _start}/{@code _end}/{@code _sort}/{@code _order}, a bare JSON array,
 * {@code X-Total-Count}, and a body on {@code DELETE}. Four extra endpoints
 * hang off it, and they are what make the feature operable rather than merely
 * correct — the condition builder, "which rule is doing this", "why can this
 * person not see that", and the coverage grid.
 *
 * <p>Only {@code ADMIN} holds these codes, and {@code 016} says so explicitly
 * rather than joining every role: editing a data scope is editing the security
 * model.
 *
 * <p>{@code /explain} and {@code /simulate} additionally require
 * {@code users:read}, because they take somebody else's account id — simulating
 * another person's access is reading about another person.
 */
@RestController
@RequestMapping("/api/row_level_policies")
public class RowLevelPolicyController {

    private final RowLevelPolicyService service;
    private final RowLevelPolicyInsights insights;

    public RowLevelPolicyController(RowLevelPolicyService service, RowLevelPolicyInsights insights) {
        this.service = service;
        this.insights = insights;
    }

    /**
     * Serves both {@code getList} and {@code getMany}.
     *
     * <p>They differ only in the query string — {@code getMany} sends
     * {@code ids[n]} and no window — so they share one endpoint, with the id
     * lookup answered unpaged.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "')")
    public ResponseEntity<List<RowLevelPolicyResponse>> list(
            @RequestParam MultiValueMap<String, String> query) {

        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<RowLevelPolicyResponse> rows = service.getMany(ids).stream()
                    .map(service::toResponse)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<RowLevelPolicy> page = service.list(params);
        return ListResponse.of(
                page.map(service::toResponse).getContent(),
                page.getTotalElements());
    }

    /**
     * What a policy on a resource may say: its fields, their operators, the
     * context keys, and the policies declared in source.
     *
     * <p>This is what lets the admin screen offer only valid choices, and
     * therefore what lets it have no free-text expression box at all.
     */
    @GetMapping("/metadata")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "')")
    public PolicyMetadataResponse metadata(@RequestParam String resource) {
        return insights.metadata(resource);
    }

    /** Which rules apply to one account on one resource, and what they add up to. */
    @GetMapping("/explain")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "') "
            + "and hasAuthority('" + Permissions.USERS_READ + "')")
    public ExplainResponse explain(
            @RequestParam String resource,
            @RequestParam String action,
            @RequestParam Long userId) {
        return insights.explain(resource, action, userId);
    }

    /**
     * Whether one account could do one thing to one row, answered in three
     * values.
     *
     * <p>The most useful operational tool here by some distance. Without it,
     * every "why can I not see this record" is an afternoon of reading logs.
     */
    @PostMapping("/simulate")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "') "
            + "and hasAuthority('" + Permissions.USERS_READ + "')")
    public SimulateResponse simulate(@Valid @RequestBody SimulateRequest request) {
        return insights.simulate(request);
    }

    /** The role-by-action grid, so a policy gap is a red cell rather than an invisible default. */
    @GetMapping("/coverage")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "')")
    public CoverageResponse coverage() {
        return insights.coverage();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_READ + "')")
    public RowLevelPolicyResponse get(@PathVariable Long id) {
        return service.toResponse(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_WRITE + "')")
    public ResponseEntity<RowLevelPolicyResponse> create(
            @Valid @RequestBody RowLevelPolicyRequest request) {

        RowLevelPolicy created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/row_level_policies/" + created.getId()))
                .body(service.toResponse(created));
    }

    /**
     * {@code PATCH} is what the data provider sends by default; {@code PUT} is
     * mapped to the same handler so the resource is also usable from clients
     * that only speak full replacement.
     */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_WRITE + "')")
    public RowLevelPolicyResponse update(
            @PathVariable Long id,
            @Valid @RequestBody RowLevelPolicyPatchRequest request) {

        return service.toResponse(service.update(id, request));
    }

    /** Echoes the deleted row — the data provider parses the response body. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.ROW_LEVEL_POLICIES_DELETE + "')")
    public RowLevelPolicyResponse delete(@PathVariable Long id) {
        return service.toResponse(service.delete(id));
    }
}
