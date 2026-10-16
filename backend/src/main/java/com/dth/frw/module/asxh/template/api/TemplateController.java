package com.dth.frw.module.asxh.template.api;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.api.dto.TemplatePatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateResponse;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionResponse;
import com.dth.frw.module.asxh.template.security.TemplatePermissions;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateService.TemplateStats;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
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

/**
 * {@code /api/templates} — resource {@code templates} (biểu trong bộ mẫu, UC-10),
 * kèm thao tác {@code POST /{id}/next_version} (UC-14).
 */
@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService service;
    private final TemplateVersionService versionService;

    public TemplateController(TemplateService service, TemplateVersionService versionService) {
        this.service = service;
        this.versionService = versionService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATES_READ + "')")
    public ResponseEntity<List<TemplateResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<TemplateResponse> rows = respond(service.getMany(ids));
            return ListResponse.of(rows, rows.size());
        }

        Page<Template> page = service.list(params);
        return ListResponse.of(respond(page.getContent()), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATES_READ + "')")
    public TemplateResponse get(@PathVariable Long id) {
        return respond(service.get(id));
    }

    /** Tạo biểu kèm phiên bản đầu (Nháp). */
    @PostMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATES_WRITE + "')")
    public ResponseEntity<TemplateResponse> create(@Valid @RequestBody TemplateRequest request) {
        Template created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/templates/" + created.getId()))
                .body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATES_WRITE + "')")
    public TemplateResponse update(@PathVariable Long id, @Valid @RequestBody TemplatePatchRequest request) {
        return respond(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATES_DELETE + "')")
    public TemplateResponse delete(@PathVariable Long id) {
        return TemplateResponse.from(service.delete(id), 0, null, null);
    }

    /**
     * UC-14: tạo phiên bản kế tiếp từ đỉnh chuỗi của biểu. Trả về phiên bản mới
     * (đầy đủ workbook / script) với 201.
     */
    @PostMapping("/{id}/next_version")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public ResponseEntity<TemplateVersionResponse> nextVersion(@PathVariable Long id) {
        TemplateVersion created = versionService.nextVersion(id);
        return ResponseEntity
                .created(URI.create("/api/template_versions/" + created.getId()))
                .body(TemplateVersionResponse.full(created));
    }

    private TemplateResponse respond(Template template) {
        TemplateStats stats = service.stats(template.getId());
        return TemplateResponse.from(template, stats.versionCount(), stats.currentVersion(), stats.latestVersion());
    }

    private List<TemplateResponse> respond(List<Template> templates) {
        Map<Long, TemplateStats> stats = service.stats(templates.stream().map(Template::getId).toList());
        return templates.stream()
                .map(template -> {
                    TemplateStats s = stats.get(template.getId());
                    return s == null
                            ? TemplateResponse.from(template, 0, null, null)
                            : TemplateResponse.from(template, s.versionCount(), s.currentVersion(), s.latestVersion());
                })
                .toList();
    }
}
