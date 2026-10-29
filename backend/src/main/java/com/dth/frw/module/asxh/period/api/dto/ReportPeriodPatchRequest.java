package com.dth.frw.module.asxh.period.api.dto;

import java.time.LocalDate;

/**
 * {@code PATCH /report_periods/{id}} — Sở tinh chỉnh cửa sổ nhận nhập liệu của một
 * kỳ chưa mở đợt; trường {@code null} = giữ nguyên.
 *
 * <p>Trạng thái KHÔNG đổi qua đây: mở đợt / chốt / gia hạn / thu hồi là các action
 * riêng ở slice thiết lập ({@code POST /api/report_periods/{id}/publish|close|extend|withdraw}).
 * Khoảng số liệu, loại kỳ và số thứ tự do hệ thống sinh, không sửa tay.
 */
public record ReportPeriodPatchRequest(
        LocalDate openFrom,

        LocalDate deadline) {
}
