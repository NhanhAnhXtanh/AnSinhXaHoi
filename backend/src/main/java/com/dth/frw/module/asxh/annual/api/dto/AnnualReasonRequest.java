package com.dth.frw.module.asxh.annual.api.dto;

/** Thân của {@code POST /api/annual_reports/{id}/return|reopen}: lý do (bắt buộc, kiểm ở service). */
public record AnnualReasonRequest(String reason) {
}
