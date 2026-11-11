package com.dth.frw.module.asxh.setup.api;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.module.asxh.notification.service.AsxhNotifier;
import com.dth.frw.module.asxh.setup.api.dto.ExtendPeriodRequest;
import com.dth.frw.module.asxh.setup.api.dto.PeriodActionResponse;
import com.dth.frw.module.asxh.setup.api.dto.PeriodSetupResponse;
import com.dth.frw.module.asxh.setup.api.dto.PublicationResponse;
import com.dth.frw.module.asxh.setup.api.dto.WithdrawPeriodRequest;
import com.dth.frw.module.asxh.setup.security.SetupPermissions;
import com.dth.frw.module.asxh.setup.service.PeriodLifecycleService;
import com.dth.frw.module.asxh.setup.service.PublicationService;
import com.dth.frw.shared.web.ListParams;
import jakarta.validation.Valid;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Điều hành đợt của một kỳ, treo dưới {@code /api/report_periods} của slice kỳ báo cáo nhưng
 * thuộc slice thiết lập (CRUD kỳ ở controller của slice kỳ; các đường dẫn ở đây không trùng
 * đường dẫn nào của nó).
 *
 * <ul>
 *   <li>{@code GET  /setup_locks?ids[0]=…} — khoá cả kỳ của nhiều kỳ (nhãn "Đã khoá", UC-31).</li>
 *   <li>{@code GET  /{id}/setup} — trạng thái điều hành + cờ bật/tắt nút.</li>
 *   <li>{@code POST /{id}/publish} — mở đợt lần đầu (UC-24), hoặc đợt bổ sung nếu đã mở (UC-26).</li>
 *   <li>{@code POST /{id}/close} — chốt đợt (UC-27).</li>
 *   <li>{@code POST /{id}/extend} {@code {"deadline":"2026-11-30"}} — gia hạn &amp; mở lại (UC-28).</li>
 *   <li>{@code POST /{id}/withdraw} {@code {"confirmName":"Quý I/2026"}} — thu hồi (UC-29).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/report_periods")
public class PeriodOperationController {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PeriodLifecycleService lifecycleService;
    private final PublicationService publicationService;
    // Báo cho tài khoản các đơn vị SAU khi đợt đã mở xong (không nằm trong giao dịch mở đợt).
    private final AsxhNotifier notifier;

    public PeriodOperationController(PeriodLifecycleService lifecycleService, PublicationService publicationService,
                                     AsxhNotifier notifier) {
        this.lifecycleService = lifecycleService;
        this.publicationService = publicationService;
        this.notifier = notifier;
    }

    /**
     * Bare JSON array {@code [{periodId, kind, reason, sourcePeriodId, sourcePeriodName}]}; kỳ
     * không bị khoá không có dòng.
     */
    @GetMapping("/setup_locks")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_READ + "')")
    public List<PeriodLifecycleService.PeriodLockInfo> locks(@RequestParam MultiValueMap<String, String> query) {
        List<Long> ids = new ListParams(query).ids();
        return ids.isEmpty() ? List.of() : lifecycleService.locks(ids);
    }

    @GetMapping("/{id}/setup")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_READ + "')")
    public PeriodSetupResponse setup(@PathVariable Long id) {
        return PeriodSetupResponse.from(lifecycleService.setupState(id));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_WRITE + "')")
    public PeriodActionResponse publish(@PathVariable Long id) {
        Publication publication = publicationService.publish(id);
        notifier.publicationOpened(publication);
        ReportPeriod period = publication.getPeriod();
        String message = publication.getKind() == PublicationKind.LAN_DAU
                ? "%s: đã mở, tạo %d phiếu.".formatted(period.getName(), publication.getReportCount())
                : "Đã mở đợt bổ sung cho kỳ %s: %d tờ biểu mới, %d phiếu mới."
                        .formatted(period.getName(), publication.getSheetCount(), publication.getReportCount());
        return PeriodActionResponse.of(period, PublicationResponse.from(publication), message);
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_WRITE + "')")
    public PeriodActionResponse close(@PathVariable Long id) {
        ReportPeriod period = lifecycleService.close(id);
        return PeriodActionResponse.of(period, null, "Đã chốt kỳ " + period.getName() + ".");
    }

    @PostMapping("/{id}/extend")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_WRITE + "')")
    public PeriodActionResponse extend(@PathVariable Long id, @Valid @RequestBody ExtendPeriodRequest request) {
        ReportPeriod period = lifecycleService.extend(id, request.deadline());
        return PeriodActionResponse.of(period, null,
                "Đã gia hạn kỳ %s đến %s và mở lại.".formatted(period.getName(), request.deadline().format(DATE)));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_WRITE + "')")
    public PeriodActionResponse withdraw(@PathVariable Long id, @Valid @RequestBody WithdrawPeriodRequest request) {
        ReportPeriod period = lifecycleService.withdraw(id, request.confirmName());
        return PeriodActionResponse.of(period, null,
                "Đã thu hồi kỳ " + period.getName() + "; kỳ quay về bước thiết lập.");
    }
}
