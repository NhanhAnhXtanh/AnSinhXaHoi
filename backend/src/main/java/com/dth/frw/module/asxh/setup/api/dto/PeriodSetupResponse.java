package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.setup.service.PeriodLifecycleService;
import java.time.LocalDate;

/**
 * {@code GET /api/report_periods/{id}/setup} — trạng thái điều hành của một kỳ cho màn
 * "Thiết lập &amp; điều hành": khoá cả kỳ (kèm lý do bằng lời), số ô đã thiết lập, đã mở lần
 * đầu chưa, và các cờ bật/tắt nút. Cờ chỉ là gợi ý — máy chủ kiểm lại khi bấm.
 */
public record PeriodSetupResponse(
        Long periodId,
        String periodName,
        PeriodStatus periodStatus,
        LocalDate fromDate,
        LocalDate toDate,
        LocalDate deadline,
        boolean locked,
        String lockReason,
        long assignmentCount,
        boolean initialPublished,
        boolean canAssign,
        boolean canRemove,
        boolean canPublish,
        boolean canPublishSupplemental,
        boolean canClose,
        boolean canExtend,
        boolean canWithdraw,
        String readOnlyReason) {

    public static PeriodSetupResponse from(PeriodLifecycleService.SetupState state) {
        ReportPeriod period = state.period();
        return new PeriodSetupResponse(
                period.getId(),
                period.getName(),
                period.getStatus(),
                period.getFromDate(),
                period.getToDate(),
                period.getDeadline(),
                state.locked(),
                state.lockReason(),
                state.assignmentCount(),
                state.initialPublished(),
                state.canAssign(),
                state.canRemove(),
                state.canPublish(),
                state.canPublishSupplemental(),
                state.canClose(),
                state.canExtend(),
                state.canWithdraw(),
                state.readOnlyReason());
    }
}
