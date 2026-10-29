package com.dth.frw.module.security.user.service;

import com.dth.frw.module.asxh.unit.service.ReportUnitActivationChanged;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Đồng bộ trạng thái tài khoản theo trạng thái đơn vị báo cáo (UC-02, BR-02.1, BR-02.2,
 * BR-70.2): ngừng hoạt động đơn vị ⇒ ngừng mọi tài khoản của đơn vị và cây con; kích hoạt lại
 * ⇒ bật lại tài khoản của chính đơn vị.
 *
 * <p>{@code @EventListener} thường (không phải sau commit): chạy trong giao dịch của lần sửa
 * đơn vị, để đơn vị và tài khoản đổi cùng nhau hoặc không đổi gì.
 */
@Component
public class ReportUnitAccountSync {

    private final UserService userService;

    public ReportUnitAccountSync(UserService userService) {
        this.userService = userService;
    }

    @EventListener
    public void on(ReportUnitActivationChanged event) {
        if (event.active()) {
            userService.reactivateAccountsOfUnit(event.unitId());
        } else {
            userService.deactivateAccountsOfUnitTree(event.unitId());
        }
    }
}
