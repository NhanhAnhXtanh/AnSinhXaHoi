package com.dth.frw.module.asxh.template.api;

import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetPatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetResponse;
import com.dth.frw.module.asxh.template.security.TemplatePermissions;
import com.dth.frw.module.asxh.template.service.TemplateSetService;
import com.dth.frw.module.asxh.template.service.TemplateSetService.SetStats;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
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

/** {@code /api/template_sets} — resource {@code template_sets} (bộ mẫu, UC-09). */
@RestController
@RequestMapping("/api/template_sets")
public class TemplateSetController {

    private final TemplateSetService service;

    public TemplateSetController(TemplateSetService service) {
        this.service = service;
    }

    /** {@code getList} và {@code getMany} dùng chung, như controller của base. */
    @GetMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_SETS_READ + "')")
    public ResponseEntity<List<TemplateSetResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<TemplateSetResponse> rows = respond(service.getMany(ids));
            return ListResponse.of(rows, rows.size());
        }

        Page<TemplateSet> page = service.list(params);
        return ListResponse.of(respond(page.getContent()), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_SETS_READ + "')")
    public TemplateSetResponse get(@PathVariable Long id) {
        return respond(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_SETS_WRITE + "')")
    public ResponseEntity<TemplateSetResponse> create(@Valid @RequestBody TemplateSetRequest request) {
        TemplateSet created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/template_sets/" + created.getId()))
                .body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_SETS_WRITE + "')")
    public TemplateSetResponse update(@PathVariable Long id, @Valid @RequestBody TemplateSetPatchRequest request) {
        return respond(service.update(id, request));
    }

    /** Trả lại dòng đã xoá — data provider đọc thân phản hồi. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_SETS_DELETE + "')")
    public TemplateSetResponse delete(@PathVariable Long id) {
        return TemplateSetResponse.from(service.delete(id), 0, false);
    }

    private TemplateSetResponse respond(TemplateSet set) {
        SetStats stats = service.stats(set.getId());
        return TemplateSetResponse.from(set, stats.templateCount(), stats.inUse());
    }

    private List<TemplateSetResponse> respond(List<TemplateSet> sets) {
        Map<Long, SetStats> stats = service.stats(sets.stream().map(TemplateSet::getId).toList());
        return sets.stream()
                .map(set -> {
                    SetStats s = stats.get(set.getId());
                    return TemplateSetResponse.from(set, s == null ? 0 : s.templateCount(), s != null && s.inUse());
                })
                .toList();
    }
}
