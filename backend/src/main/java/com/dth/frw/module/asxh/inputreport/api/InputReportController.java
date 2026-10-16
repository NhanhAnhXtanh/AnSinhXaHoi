package com.dth.frw.module.asxh.inputreport.api;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportHistoryResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportSummaryResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.ReturnReportRequest;
import com.dth.frw.module.asxh.inputreport.security.InputReportPermissions;
import com.dth.frw.module.asxh.inputreport.service.InputReportQueryService;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
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
 * {@code /api/input_reports} — phiếu nhập.
 *
 * <p>Chỉ đọc theo dialect của data provider ({@code getList}/{@code getMany}/{@code getOne});
 * không có tạo / sửa / xoá trực tiếp: phiếu chỉ sinh từ đợt phát hành (BR-33.3) và chỉ mất
 * khi thu hồi kỳ. Chuyển trạng thái là các action {@code POST /{id}/submit|approve|return}.
 * Số liệu nằm ở {@code /api/input_report_sheets}.
 */
@RestController
@RequestMapping("/api/input_reports")
public class InputReportController {

    private final InputReportService service;
    private final InputReportQueryService queries;

    public InputReportController(InputReportService service, InputReportQueryService queries) {
        this.service = service;
        this.queries = queries;
    }

    /**
     * {@code getList} và {@code getMany}. Lọc: {@code period.id}, {@code period.status},
     * {@code unit.id}, {@code status} (nhiều giá trị cách dấu phẩy), {@code display} (trạng thái
     * hiển thị: draft, overdue, returned, submitted, approved, locked), {@code year},
     * {@code templateSet.id}, {@code publication.id}, {@code includeSuperseded}, {@code q}.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public ResponseEntity<List<InputReportResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<InputReport> rows = service.getMany(ids);
            List<InputReportResponse> body = withProgress(rows);
            return ListResponse.of(body, body.size());
        }

        Page<InputReport> page = service.list(params);
        return ListResponse.of(withProgress(page.getContent()), page.getTotalElements());
    }

    /**
     * Số đếm thẻ lọc nhanh + lựa chọn ô Kỳ / Bộ biểu mẫu (UC-33, UC-39). Nhận cùng tham số lọc
     * như {@code getList}; lọc trạng thái ({@code status}, {@code display}) bị bỏ qua khi đếm.
     * Khai trước {@code /{id}} cho rõ — đường dẫn chữ luôn thắng biến đường dẫn.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public InputReportSummaryResponse summary(@RequestParam MultiValueMap<String, String> query) {
        return queries.summary(query);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public InputReportResponse get(@PathVariable Long id) {
        return one(service.get(id));
    }

    /** Lịch sử phiên bản và lịch sử thao tác (UC-44), tính từ phiên bản bất kỳ trong chuỗi. */
    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public InputReportHistoryResponse history(@PathVariable Long id) {
        return queries.history(id);
    }

    /** Nộp phiếu lên Sở (UC-38, UC-43). */
    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_WRITE + "')")
    public InputReportResponse submit(@PathVariable Long id) {
        return one(service.submit(id));
    }

    /** Sở phê duyệt (UC-41). */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_APPROVE + "')")
    public InputReportResponse approve(@PathVariable Long id) {
        return one(service.approve(id));
    }

    /**
     * Sở trả lại (UC-42). Trả về PHIÊN BẢN MỚI ({@code RETURNED}, {@code revisionNo + 1}) —
     * id khác id trong đường dẫn; bản cũ chuyển {@code SUPERSEDED}.
     */
    @PostMapping("/{id}/return")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_APPROVE + "')")
    public InputReportResponse returnReport(@PathVariable Long id, @Valid @RequestBody ReturnReportRequest request) {
        return one(service.returnReport(id, request.reason()));
    }

    private InputReportResponse one(InputReport report) {
        return withProgress(List.of(report)).getFirst();
    }

    /** Tiến độ và tên đơn vị cha của cả trang trong hai câu truy vấn, không phải hai câu mỗi dòng. */
    private List<InputReportResponse> withProgress(List<InputReport> rows) {
        List<Long> ids = InputReportService.idsOf(rows);
        Map<Long, InputReportService.Progress> progress = service.progress(ids);
        Map<Long, String> parents = queries.parentNames(ids);
        return rows.stream()
                .map(row -> InputReportResponse.from(
                        row, progress.get(row.getId()), parents.get(row.getUnit().getId())))
                .toList();
    }
}
