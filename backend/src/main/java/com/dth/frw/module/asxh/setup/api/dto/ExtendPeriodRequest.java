package com.dth.frw.module.asxh.setup.api.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** {@code POST /api/report_periods/{id}/extend} — hạn nộp mới (yyyy-MM-dd), sau ngày cuối kỳ và
 * không phải ngày đã qua. */
public record ExtendPeriodRequest(
        @NotNull(message = "Vui lòng chọn hạn nộp mới.")
        LocalDate deadline) {
}
