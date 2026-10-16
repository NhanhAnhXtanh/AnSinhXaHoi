package com.dth.frw.module.asxh.setup.api;

import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.module.asxh.setup.api.dto.CopySetupRequest;
import com.dth.frw.module.asxh.setup.api.dto.CopySetupResponse;
import com.dth.frw.module.asxh.setup.api.dto.MatrixChangeRequest;
import com.dth.frw.module.asxh.setup.api.dto.MatrixChangeResponse;
import com.dth.frw.module.asxh.setup.api.dto.PeriodAssignmentResponse;
import com.dth.frw.module.asxh.setup.api.dto.PublicationResponse;
import com.dth.frw.module.asxh.setup.security.SetupPermissions;
import com.dth.frw.module.asxh.setup.service.PeriodAssignmentService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/period_assignments} — các ô của ma trận thiết lập (UC-22).
 *
 * <p>Đọc theo dialect của data provider: màn ma trận gọi
 * {@code GET ?period.id=…&_start=0&_end=1000} để lấy mọi ô đã lưu của kỳ. Ghi không theo từng
 * dòng mà theo lô: {@code PUT /matrix} lưu cả gói ô chờ gán / chờ gỡ trong một giao dịch;
 * {@code POST /copy} áp dụng thiết lập của một kỳ cho các kỳ khác (UC-23).
 * {@code /matrix}, {@code /copy} khai trước {@code /{id}} nên đường dẫn chữ thắng biến đường dẫn.
 */
@RestController
@RequestMapping("/api/period_assignments")
public class PeriodAssignmentController {

    private final PeriodAssignmentService service;

    public PeriodAssignmentController(PeriodAssignmentService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_READ + "')")
    public ResponseEntity<List<PeriodAssignmentResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<PeriodAssignmentResponse> rows = service.getMany(ids).stream()
                    .map(PeriodAssignmentResponse::from)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<PeriodAssignment> page = service.list(params);
        return ListResponse.of(page.map(PeriodAssignmentResponse::from).getContent(), page.getTotalElements());
    }

    /**
     * Lưu thay đổi của ma trận. Kỳ đang mở: chỉ nhận ô thêm và phát ngay đợt bổ sung (UC-26).
     * Lỗi nghiệp vụ (kỳ bị khoá cả kỳ, đơn vị không nhận báo cáo, ô đã phát phiếu…) trả 409 với
     * câu báo tiếng Việt; không ô nào được ghi.
     */
    @PutMapping("/matrix")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_WRITE + "')")
    public MatrixChangeResponse saveMatrix(@Valid @RequestBody MatrixChangeRequest request) {
        PeriodAssignmentService.MatrixResult result = service.applyMatrix(
                request.periodId(), cells(request.add()), cells(request.remove()));
        return new MatrixChangeResponse(
                result.period().getId(),
                result.period().getStatus(),
                result.added(),
                result.removed(),
                result.unchanged(),
                PublicationResponse.from(result.publication()),
                result.message());
    }

    /**
     * Áp dụng thiết lập cho kỳ khác (UC-23): chỉ cộng thêm, chỉ kỳ chưa mở đợt cùng năm; kỳ
     * đích bị khoá cả kỳ (trùng kỳ khác đã mở đợt) thì 409 kèm lý do, không ghi gì.
     */
    @PostMapping("/copy")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_WRITE + "')")
    public CopySetupResponse copy(@Valid @RequestBody CopySetupRequest request) {
        PeriodAssignmentService.CopyResult result = service.copy(request.fromPeriodId(), request.toPeriodIds());
        return new CopySetupResponse(
                request.fromPeriodId(),
                result.added(),
                result.unchanged(),
                result.skipped(),
                result.targets().stream().map(CopySetupResponse.PeriodSummary::from).toList(),
                result.message());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PERIOD_ASSIGNMENTS_READ + "')")
    public PeriodAssignmentResponse get(@PathVariable Long id) {
        return PeriodAssignmentResponse.from(service.get(id));
    }

    private static List<PeriodAssignmentService.Cell> cells(List<MatrixChangeRequest.CellRef> refs) {
        if (refs == null) {
            return List.of();
        }
        return refs.stream()
                .map(ref -> new PeriodAssignmentService.Cell(ref.unitId(), ref.templateId()))
                .toList();
    }
}
