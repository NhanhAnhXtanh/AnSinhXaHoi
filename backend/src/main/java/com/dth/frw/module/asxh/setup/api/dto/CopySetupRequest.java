package com.dth.frw.module.asxh.setup.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * {@code POST /api/period_assignments/copy} — áp dụng thiết lập của một kỳ cho các kỳ khác
 * (UC-23).
 *
 * <pre>
 * { "fromPeriodId": 12, "toPeriodIds": [13, 14] }
 * </pre>
 */
public record CopySetupRequest(
        @NotNull(message = "Chưa chọn kỳ để lấy thiết lập")
        Long fromPeriodId,

        @NotEmpty(message = "Chưa chọn kỳ nào để áp dụng thiết lập")
        List<Long> toPeriodIds) {
}
