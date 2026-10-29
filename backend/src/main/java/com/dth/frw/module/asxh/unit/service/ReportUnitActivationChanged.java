package com.dth.frw.module.asxh.unit.service;

/**
 * Một đơn vị báo cáo vừa đổi trạng thái hoạt động — phát trong giao dịch của lần sửa đơn vị.
 *
 * <p>Sự kiện chứ không gọi thẳng: tài khoản người dùng ({@code UserService}) đã phụ thuộc
 * {@link ReportUnitService} để giải đơn vị của tài khoản, gọi ngược lại là vòng phụ thuộc Spring
 * không dựng được. Bên nghe ({@code ReportUnitAccountSync} ở slice người dùng) chạy đồng bộ
 * trong cùng giao dịch, nên lỗi ở đó huỷ luôn lần sửa đơn vị.
 *
 * @param unitId id đơn vị
 * @param active {@code false} = vừa ngừng hoạt động (lan xuống cây con, BR-02.1);
 *               {@code true} = vừa kích hoạt lại (chỉ chính đơn vị, BR-02.2)
 */
public record ReportUnitActivationChanged(Long unitId, boolean active) {
}
