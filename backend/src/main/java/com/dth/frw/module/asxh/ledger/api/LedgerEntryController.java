package com.dth.frw.module.asxh.ledger.api;

import com.dth.frw.module.asxh.ledger.api.dto.LedgerEntryResponse;
import com.dth.frw.module.asxh.ledger.security.LedgerPermissions;
import com.dth.frw.module.asxh.ledger.service.LedgerEntryService;
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
 * {@code /api/ledger_entries} — số liệu đã lưu của phiếu (chỉ đọc, theo dialect của data provider).
 *
 * <p>Không có tạo / sửa / xoá: số liệu chỉ được ghi khi Sở phê duyệt phiếu (hoặc nạp BHXH qua
 * {@code POST /api/input_reports/{id}/ledger_imports}). Lọc: {@code report.id}, {@code sheet.id},
 * {@code period.id}, {@code template.id}, {@code unit.id}, {@code submitterUnit.id},
 * {@code indicatorCode}, {@code q}.
 */
@RestController
@RequestMapping("/api/ledger_entries")
public class LedgerEntryController {

    private final LedgerEntryService service;

    public LedgerEntryController(LedgerEntryService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + LedgerPermissions.LEDGER_ENTRIES_READ + "')")
    public ResponseEntity<List<LedgerEntryResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);
        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<LedgerEntryResponse> rows = service.getMany(ids);
            return ListResponse.of(rows, rows.size());
        }
        Page<LedgerEntryResponse> page = service.list(params);
        return ListResponse.of(page.getContent(), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + LedgerPermissions.LEDGER_ENTRIES_READ + "')")
    public LedgerEntryResponse get(@PathVariable Long id) {
        return service.get(id);
    }
}
