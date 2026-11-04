package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.module.asxh.template.service.TemplateFormLockChanged;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Khoá / mở khoá cả biểu ⇒ tính lại trạng thái thiết lập của các kỳ chưa mở đợt có ô của biểu
 * đó: không còn ô nào dùng được thì về Chưa thiết lập, có lại thì về Đã thiết lập.
 *
 * <p>{@code @EventListener} thường (không phải sau commit): chạy trong giao dịch của lần khoá,
 * để biểu và trạng thái kỳ đổi cùng nhau hoặc không đổi gì.
 */
@Component
public class TemplateLockSetupSync {

    private final PeriodAssignmentService assignmentService;

    public TemplateLockSetupSync(PeriodAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    @EventListener
    public void on(TemplateFormLockChanged event) {
        assignmentService.syncSetupStatusOfTemplate(event.templateId());
    }
}
