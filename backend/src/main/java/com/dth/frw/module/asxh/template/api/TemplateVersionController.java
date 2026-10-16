package com.dth.frw.module.asxh.template.api;

import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.api.dto.PublishRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionPatchRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionResponse;
import com.dth.frw.module.asxh.template.security.TemplatePermissions;
import com.dth.frw.module.asxh.template.service.TemplateDates;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
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
 * {@code /api/template_versions} — resource {@code template_versions} (phiên bản
 * mẫu), kèm các thao tác {@code POST /{id}/publish|lock|unlock|revoke}
 * (UC-13, UC-15, UC-17) và {@code GET /resolve} (UC-19).
 *
 * <p>Danh sách trả dạng gọn (không kèm workbook / script); {@code getOne} và
 * các thao tác trả dạng đầy đủ.
 */
@RestController
@RequestMapping("/api/template_versions")
public class TemplateVersionController {

    private final TemplateVersionService service;

    public TemplateVersionController(TemplateVersionService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_READ + "')")
    public ResponseEntity<List<TemplateVersionResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<TemplateVersionResponse> rows = service.getMany(ids).stream()
                    .map(TemplateVersionResponse::summary)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<TemplateVersion> page = service.list(params);
        return ListResponse.of(
                page.map(TemplateVersionResponse::summary).getContent(),
                page.getTotalElements());
    }

    /**
     * UC-19: phiên bản áp dụng cho biểu ở ngày mốc (mặc định hôm nay); ngày mốc
     * trước mọi bản thì mượn bản đã ban hành sớm nhất. Biểu chưa ban hành bản
     * nào → 409 kèm câu báo. Khai báo trước {@code /{id}} để đường dẫn chữ thắng.
     */
    @GetMapping("/resolve")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_READ + "')")
    public TemplateVersionResponse resolve(
            @RequestParam("templateId") Long templateId,
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date) {
        LocalDate anchor = date != null ? date : TemplateDates.today();
        return TemplateVersionResponse.summary(service.requireApplicable(templateId, anchor));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_READ + "')")
    public TemplateVersionResponse get(@PathVariable Long id) {
        return TemplateVersionResponse.full(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public ResponseEntity<TemplateVersionResponse> create(@Valid @RequestBody TemplateVersionRequest request) {
        TemplateVersion created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/template_versions/" + created.getId()))
                .body(TemplateVersionResponse.full(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public TemplateVersionResponse update(
            @PathVariable Long id, @Valid @RequestBody TemplateVersionPatchRequest request) {
        return TemplateVersionResponse.full(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_DELETE + "')")
    public TemplateVersionResponse delete(@PathVariable Long id) {
        return TemplateVersionResponse.summary(service.delete(id));
    }

    /** UC-13. Thân {@code {"effectiveFrom": "yyyy-MM-dd"}} tuỳ chọn. */
    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public TemplateVersionResponse publish(
            @PathVariable Long id, @RequestBody(required = false) PublishRequest request) {
        LocalDate effectiveFrom = request == null ? null : request.effectiveFrom();
        return TemplateVersionResponse.full(service.publish(id, effectiveFrom));
    }

    /** UC-15: khoá. */
    @PostMapping("/{id}/lock")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public TemplateVersionResponse lock(@PathVariable Long id) {
        return TemplateVersionResponse.full(service.lock(id));
    }

    /** UC-15: mở khoá. */
    @PostMapping("/{id}/unlock")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public TemplateVersionResponse unlock(@PathVariable Long id) {
        return TemplateVersionResponse.full(service.unlock(id));
    }

    /** UC-17: thu hồi (vĩnh viễn). */
    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAuthority('" + TemplatePermissions.TEMPLATE_VERSIONS_WRITE + "')")
    public TemplateVersionResponse revoke(@PathVariable Long id) {
        return TemplateVersionResponse.full(service.revoke(id));
    }
}
