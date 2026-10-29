package com.dth.frw.module.security.user.api.dto;

/**
 * Đơn vị báo cáo ASXH được nhắc tới bằng id trong payload người dùng.
 *
 * <p>Cùng quy ước ba trạng thái với {@link OrganizationRef}: bỏ hẳn trường thì giữ nguyên,
 * {@code {"id": null}} là bỏ gắn đơn vị (tài khoản trở thành tài khoản Sở / UBND),
 * {@code {"id": n}} là gắn vào đơn vị {@code n}. Vì vậy id cố ý không {@code @NotNull}.
 */
public record ReportUnitRef(Long id) {
}
