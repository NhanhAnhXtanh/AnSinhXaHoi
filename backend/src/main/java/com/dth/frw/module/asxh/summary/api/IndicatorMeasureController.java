package com.dth.frw.module.asxh.summary.api;

import com.dth.frw.module.asxh.summary.api.dto.IndicatorMeasureRequest;
import com.dth.frw.module.asxh.summary.api.dto.IndicatorMeasureResponse;
import com.dth.frw.module.asxh.summary.security.IndicatorMeasurePermissions;
import com.dth.frw.module.asxh.summary.service.IndicatorMeasureService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Màn "Bản chất chỉ tiêu": khai bản chất đại lượng của từng chỉ tiêu để tổng hợp nhiều kỳ gộp đúng
 * (cộng dồn / lấy kỳ cao nhất / lấy kỳ mới nhất — {@code MeasureKind}).
 *
 * <ul>
 *   <li>{@code GET /api/indicator_measures?_start=&_end=&q=&sheet=&measureKind=} — danh mục, mảng trần +
 *       {@code X-Total-Count}. {@code measureKind=UNSET} lọc chỉ tiêu chưa khai.</li>
 *   <li>{@code GET /api/indicator_measures/sheets} — tên ngắn các biểu có chỉ tiêu (cho ô lọc).</li>
 *   <li>{@code PUT /api/indicator_measures} — khai cho một hoặc nhiều mã (mã nằm trong thân, không trong
 *       đường dẫn: mã chỉ tiêu có dấu chấm và ký tự tuỳ ý do script mẫu đặt).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/indicator_measures")
public class IndicatorMeasureController {

    private final IndicatorMeasureService service;

    public IndicatorMeasureController(IndicatorMeasureService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + IndicatorMeasurePermissions.READ + "')")
    public ResponseEntity<List<IndicatorMeasureResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        IndicatorMeasureService.Page page = service.list(new ListParams(query));
        return ListResponse.of(page.rows().stream().map(IndicatorMeasureResponse::from).toList(), page.total());
    }

    @GetMapping("/sheets")
    @PreAuthorize("hasAuthority('" + IndicatorMeasurePermissions.READ + "')")
    public List<String> sheets() {
        return service.sheets();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('" + IndicatorMeasurePermissions.WRITE + "')")
    public List<IndicatorMeasureResponse> declare(@Valid @RequestBody IndicatorMeasureRequest request) {
        return service.declare(request.indicatorCodes(), request.measureKind(), request.note()).stream()
                .map(IndicatorMeasureResponse::from)
                .toList();
    }
}
