package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.module.asxh.period.service.PeriodPlanner;
import java.time.LocalDate;

/**
 * Một kỳ trong khung "Xem trước kỳ sẽ tạo" (UC-06 bước 4). {@code exists} = kỳ đã có
 * trong lịch đã lưu của năm đó (luôn {@code false} khi năm chưa có lịch).
 */
public record PeriodPreviewResponse(
        int year,
        PeriodKind kind,
        int seq,
        String code,
        String name,
        LocalDate fromDate,
        LocalDate toDate,
        LocalDate openFrom,
        LocalDate deadline,
        boolean exists) {

    public static PeriodPreviewResponse from(PeriodPlanner.PeriodPlan plan, boolean exists) {
        return new PeriodPreviewResponse(
                plan.year(), plan.kind(), plan.seq(), plan.code(), plan.name(),
                plan.fromDate(), plan.toDate(), plan.openFrom(), plan.deadline(), exists);
    }
}
