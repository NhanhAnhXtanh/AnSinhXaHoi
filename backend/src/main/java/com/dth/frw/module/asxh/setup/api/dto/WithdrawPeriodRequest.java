package com.dth.frw.module.asxh.setup.api.dto;

import jakarta.validation.constraints.NotBlank;

/** {@code POST /api/report_periods/{id}/withdraw} — gõ lại đúng tên kỳ để xác nhận (BR-29.1). */
public record WithdrawPeriodRequest(
        @NotBlank(message = "Gõ lại tên kỳ để xác nhận thu hồi")
        String confirmName) {
}
