package com.dth.frw.module.asxh.period.api;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.module.asxh.period.api.dto.CalendarUpdatePlanResponse;
import com.dth.frw.module.asxh.period.api.dto.PeriodPreviewResponse;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarPatchRequest;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarRequest;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarResponse;
import com.dth.frw.module.asxh.period.security.ReportPeriodPermissions;
import com.dth.frw.module.asxh.period.service.PeriodPlanner;
import com.dth.frw.module.asxh.period.service.ReportCalendarService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.ArrayList;
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
 * {@code /api/report_calendars} — lịch báo cáo năm.
 *
 * <p>Ngoài dialect simple-REST còn hai endpoint chỉ đọc, khai TRƯỚC {@code /{id}} để
 * đường dẫn chữ thắng biến đường dẫn:
 * <ul>
 *   <li>{@code GET /preview?year=&deadlineDays=&kinds=thang,quy} — khung "Xem trước kỳ sẽ tạo";</li>
 *   <li>{@code GET /{id}/update_plan?deadlineDays=&kinds=} — tóm tắt cho hộp xác nhận cập nhật.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/report_calendars")
public class ReportCalendarController {

    private final ReportCalendarService service;

    public ReportCalendarController(ReportCalendarService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_READ + "')")
    public ResponseEntity<List<ReportCalendarResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        List<ReportCalendar> rows;
        long total;
        if (!ids.isEmpty()) {
            rows = service.getMany(ids);
            total = rows.size();
        } else {
            Page<ReportCalendar> page = service.list(params);
            rows = page.getContent();
            total = page.getTotalElements();
        }

        Map<Long, Long> counts = service.periodCounts(rows.stream().map(ReportCalendar::getId).toList());
        List<ReportCalendarResponse> body = rows.stream()
                .map(calendar -> ReportCalendarResponse.from(
                        calendar,
                        service.lockedKinds(calendar.getId()),
                        counts.getOrDefault(calendar.getId(), 0L),
                        service.yearLockReason(calendar).orElse(null)))
                .toList();
        return ListResponse.of(body, total);
    }

    @GetMapping("/preview")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_READ + "')")
    public List<PeriodPreviewResponse> preview(
            @RequestParam int year,
            @RequestParam(required = false) Integer deadlineDays,
            @RequestParam(required = false) List<String> kinds) {
        int days = deadlineDays == null ? PeriodPlanner.DEFAULT_DEADLINE_DAYS : deadlineDays;
        List<PeriodKind> selected = kinds == null ? List.copyOf(PeriodPlanner.DEFAULT_KINDS) : parseKinds(kinds);
        return service.preview(year, selected, days).stream()
                .map(row -> PeriodPreviewResponse.from(row.plan(), row.exists()))
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_READ + "')")
    public ReportCalendarResponse get(@PathVariable Long id) {
        ReportCalendar calendar = service.get(id);
        return ReportCalendarResponse.from(calendar, service.lockedKinds(id), service.periodCount(id),
                service.yearLockReason(calendar).orElse(null));
    }

    @GetMapping("/{id}/update_plan")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_READ + "')")
    public CalendarUpdatePlanResponse updatePlan(
            @PathVariable Long id,
            @RequestParam(required = false) Integer deadlineDays,
            @RequestParam(required = false) List<String> kinds) {
        return CalendarUpdatePlanResponse.from(
                service.planUpdate(id, kinds == null ? null : parseKinds(kinds), deadlineDays));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_WRITE + "')")
    public ResponseEntity<ReportCalendarResponse> create(@Valid @RequestBody ReportCalendarRequest request) {
        ReportCalendarService.CalendarResult result = service.create(request);
        Long id = result.calendar().getId();
        return ResponseEntity
                .created(URI.create("/api/report_calendars/" + id))
                .body(ReportCalendarResponse.from(
                        result.calendar(), service.lockedKinds(id), service.periodCount(id),
                        result.created(), result.skipped(), null, null,
                        service.yearLockReason(result.calendar()).orElse(null)));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_WRITE + "')")
    public ReportCalendarResponse update(@PathVariable Long id, @Valid @RequestBody ReportCalendarPatchRequest request) {
        ReportCalendarService.CalendarResult result = service.update(id, request);
        return ReportCalendarResponse.from(
                result.calendar(), service.lockedKinds(id), service.periodCount(id),
                result.created(), result.skipped(), result.removed(), result.rescheduled(),
                service.yearLockReason(result.calendar()).orElse(null));
    }

    /** Trả lại lịch đã xoá — data provider đọc body của DELETE. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + ReportPeriodPermissions.CALENDARS_DELETE + "')")
    public ReportCalendarResponse delete(@PathVariable Long id) {
        return ReportCalendarResponse.from(service.delete(id), List.of(), 0L, null);
    }

    /** {@code kinds=thang,quy} hoặc {@code kinds=thang&kinds=quy}; Spring đã tách dấu phẩy. */
    private static List<PeriodKind> parseKinds(List<String> raw) {
        List<PeriodKind> kinds = new ArrayList<>();
        for (String value : raw) {
            if (value == null) {
                continue;
            }
            for (String token : value.split(",")) {
                PeriodKind kind = PeriodKind.from(token);
                if (kind != null) {
                    kinds.add(kind);
                }
            }
        }
        return kinds;
    }
}
