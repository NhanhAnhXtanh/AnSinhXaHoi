package com.dth.frw.module.asxh.unit.api;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitPatchRequest;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitRequest;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitResponse;
import com.dth.frw.module.asxh.unit.security.ReportUnitPermissions;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
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
 * {@code /api/report_units} — resource {@code report_units} của giao diện quản trị.
 *
 * <p>Đoạn đường dẫn phải trùng tên resource frontend khai trong {@code routes.tsx},
 * vì data provider dựng endpoint là {@code {apiURL}/{resource}}.
 */
@RestController
@RequestMapping("/api/report_units")
public class ReportUnitController {

    private final ReportUnitService service;

    public ReportUnitController(ReportUnitService service) {
        this.service = service;
    }

    /** Phục vụ cả {@code getList} lẫn {@code getMany} (khác nhau ở {@code ids[n]}). */
    @GetMapping
    @PreAuthorize("hasAuthority('" + ReportUnitPermissions.READ + "')")
    public ResponseEntity<List<ReportUnitResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<ReportUnitResponse> rows = service.getMany(ids).stream()
                    .map(ReportUnitResponse::from)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<ReportUnit> page = service.list(params);
        return ListResponse.of(
                page.map(ReportUnitResponse::from).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportUnitPermissions.READ + "')")
    public ReportUnitResponse get(@PathVariable Long id) {
        return ReportUnitResponse.from(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + ReportUnitPermissions.WRITE + "')")
    public ResponseEntity<ReportUnitResponse> create(@Valid @RequestBody ReportUnitRequest request) {
        ReportUnit created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/report_units/" + created.getId()))
                .body(ReportUnitResponse.from(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + ReportUnitPermissions.WRITE + "')")
    public ReportUnitResponse update(@PathVariable Long id, @Valid @RequestBody ReportUnitPatchRequest request) {
        return ReportUnitResponse.from(service.update(id, request));
    }

    /** Trả lại dòng đã xoá — data provider đọc body của DELETE. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportUnitPermissions.DELETE + "')")
    public ReportUnitResponse delete(@PathVariable Long id) {
        return ReportUnitResponse.from(service.delete(id));
    }
}
