package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.module.asxh.period.service.ReportCalendarService;
import java.util.List;

/**
 * Tóm tắt một lần cập nhật lịch cho hộp xác nhận "Cập nhật lịch báo cáo" (UC-21 bước 3):
 * thêm loại kỳ X (tạo mới N kỳ), bỏ loại kỳ Y (xoá N kỳ chưa gán), hạn nộp a → b ngày
 * (tính lại cho N kỳ chưa gán), các kỳ đã gán giữ hạn cũ. {@code empty = true} thì hiện
 * "Không có thay đổi nào để cập nhật."
 */
public record CalendarUpdatePlanResponse(
        List<PeriodKind> addedKinds,
        int createdPeriods,
        List<PeriodKind> removedKinds,
        int removedPeriods,
        int oldDeadlineDays,
        int newDeadlineDays,
        int rescheduledPeriods,
        List<String> keptDeadlineCodes,
        boolean empty) {

    public static CalendarUpdatePlanResponse from(ReportCalendarService.UpdatePlan plan) {
        return new CalendarUpdatePlanResponse(
                plan.addedKinds(),
                plan.createdPeriods(),
                plan.removedKinds(),
                plan.removedPeriods(),
                plan.oldDeadlineDays(),
                plan.newDeadlineDays(),
                plan.rescheduledPeriods(),
                plan.keptDeadlineCodes(),
                plan.isEmpty());
    }
}
