package com.dth.frw.module.asxh.setup.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * {@code PUT /api/period_assignments/matrix} — các ô chờ lưu của ma trận một kỳ.
 *
 * <p>{@code remove} chạy trước {@code add}, cùng một giao dịch. Kỳ đang mở chỉ nhận
 * {@code add} và được phát ngay thành một đợt bổ sung.
 *
 * <pre>
 * { "periodId": 12,
 *   "add":    [ { "unitId": 3, "templateId": 7 } ],
 *   "remove": [ { "unitId": 5, "templateId": 7 } ] }
 * </pre>
 */
public record MatrixChangeRequest(
        @NotNull(message = "Chưa chọn kỳ báo cáo")
        Long periodId,

        @Valid
        List<CellRef> add,

        @Valid
        List<CellRef> remove) {

    /** Một ô (đơn vị × biểu). */
    public record CellRef(
            @NotNull(message = "Thiếu đơn vị")
            Long unitId,

            @NotNull(message = "Thiếu biểu mẫu")
            Long templateId) {
    }
}
