package com.dth.frw.module.asxh.unit.api.dto;

/**
 * Đối tượng {@code parent} trên body yêu cầu đơn vị.
 *
 * <p>{@code id} được phép null — cùng hợp đồng ba trạng thái với
 * {@code OrganizationRef} ở slice user: vắng mặt {@code parent} = giữ nguyên,
 * {@code {"id": null}} = chuyển thành đơn vị gốc, {@code {"id": n}} = đặt cấp trên.
 * Chỉ đọc {@code id}; các thuộc tính khác (form gửi kèm khi sửa) bị bỏ qua.
 */
public record ParentRef(Long id) {
}
