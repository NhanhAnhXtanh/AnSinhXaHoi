package com.dth.frw.module.asxh.setup.api;

import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse;
import com.dth.frw.module.asxh.setup.api.dto.PublicationResponse;
import com.dth.frw.module.asxh.setup.security.SetupPermissions;
import com.dth.frw.module.asxh.setup.service.PublicationItemService;
import com.dth.frw.module.asxh.setup.service.PublicationService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/publications} — lịch sử mở đợt (UC-30), chỉ đọc. Đợt được tạo bởi
 * {@code POST /api/report_periods/{id}/publish} và bởi ma trận khi kỳ đang mở.
 *
 * <p>{@code GET /{id}/items} — chi tiết đợt: từng dòng đơn vị × biểu mà đợt đã phát, gom sẵn trên
 * máy chủ (bản Jmix có bảng {@code ReportPublicationItem}; ở đây suy ra từ tờ biểu, xem
 * {@code PublicationItemAssembler}). Lịch sử về sau của một dòng đọc ở
 * {@code /api/input_reports/{id}/history} và {@code /api/input_reports/{id}/ledger_audits}.
 */
@RestController
@RequestMapping("/api/publications")
public class PublicationController {

    private final PublicationService service;
    private final PublicationItemService itemService;

    public PublicationController(PublicationService service, PublicationItemService itemService) {
        this.service = service;
        this.itemService = itemService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_READ + "')")
    public ResponseEntity<List<PublicationResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<PublicationResponse> rows = service.getMany(ids).stream().map(PublicationResponse::from).toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<Publication> page = service.list(params);
        return ListResponse.of(page.map(PublicationResponse::from).getContent(), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_READ + "')")
    public PublicationResponse get(@PathVariable Long id) {
        return PublicationResponse.from(service.get(id));
    }

    @GetMapping("/{id}/items")
    @PreAuthorize("hasAuthority('" + SetupPermissions.PUBLICATIONS_READ + "')")
    public PublicationItemsResponse items(@PathVariable Long id) {
        return itemService.items(id);
    }
}
