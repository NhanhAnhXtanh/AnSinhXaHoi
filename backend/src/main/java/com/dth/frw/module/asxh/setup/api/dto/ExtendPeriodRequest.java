package com.dth.frw.module.asxh.setup.api.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** {@code POST /api/report_periods/{id}/extend} — hạn nộp mới (yyyy-MM-dd), từ hôm nay trở đi. */
public record ExtendPeriodRequest(
        @NotNull(message = "Hạn nộp mới phải từ hôm nay trở đi.")
        LocalDate deadline) {
}
