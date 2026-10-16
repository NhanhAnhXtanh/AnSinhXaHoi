package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;

/**
 * Kết quả lưu ma trận. {@code message} là câu báo cho người dùng ("Đã lưu N ô, gỡ M ô cho kỳ …"
 * / "Đã mở đợt bổ sung cho kỳ …"); {@code publication} có khi kỳ đang mở và vừa phát đợt bổ sung.
 */
public record MatrixChangeResponse(
        Long periodId,
        PeriodStatus periodStatus,
        int added,
        int removed,
        int unchanged,
        PublicationResponse publication,
        String message) {
}
