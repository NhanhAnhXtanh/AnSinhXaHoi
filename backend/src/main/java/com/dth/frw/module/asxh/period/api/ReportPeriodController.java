package com.dth.frw.module.asxh.period.api;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.period.api.dto.ReportPeriodPatchRequest;
import com.dth.frw.module.asxh.period.api.dto.ReportPeriodResponse;
import com.dth.frw.module.asxh.period.security.ReportPeriodPermissions;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/report_periods} — kỳ báo cáo.
 *
 * <p>Không có {@code POST}: kỳ chỉ sinh từ lịch ({@code /api/report_calendars}).
 * {@code PATCH} chỉ tinh chỉnh cửa sổ nhập của kỳ chưa mở đợt. Các action đổi trạng
 * thái ({@code /{id}/publish|close|extend|withdraw}) thuộc slice thiết lập kỳ, cùng
 * đường dẫn gốc nhưng controller khác.
 */
@RestController
@RequestMapping("/api/report_periods")
public class ReportPeriodController {

    private final ReportPeriodService service;

    public ReportPeriodController(ReportPeriodService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.PERIODS_READ + "')")
    public ResponseEntity<List<ReportPeriodResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<ReportPeriodResponse> rows = service.getMany(ids).stream()
                    .map(ReportPeriodResponse::from)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<ReportPeriod> page = service.list(params);
        return ListResponse.of(
                page.map(ReportPeriodResponse::from).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.PERIODS_READ + "')")
    public ReportPeriodResponse get(@PathVariable Long id) {
        return ReportPeriodResponse.from(service.get(id));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.PERIODS_WRITE + "')")
    public ReportPeriodResponse update(@PathVariable Long id, @Valid @RequestBody ReportPeriodPatchRequest request) {
        return ReportPeriodResponse.from(service.update(id, request));
    }

    /** Trả lại kỳ đã xoá — data provider đọc body của DELETE. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.PERIODS_DELETE + "')")
    public ReportPeriodResponse delete(@PathVariable Long id) {
        return ReportPeriodResponse.from(service.delete(id));
    }
}
