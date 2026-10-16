package com.dth.frw.module.security.auth.api.dto;

import com.dth.frw.domain.security.user.User;

/**
 * The signed-in identity, as {@code GET /auth/me} and every token response
 * report it.
 *
 * <p>Identity only: who the account is, not what it may do. Roles and
 * permissions are a separate payload behind a separate endpoint
 * ({@link AuthoritiesResponse}, {@code GET /auth/permissions}), for the same
 * reason they are no longer stamped into the access token — they grow with the
 * permission model, and the things that read an identity (an account menu, a
 * profile header) do not need them.
 *
 * <p>Narrower than the user resource's own response and declared separately
 * rather than imported: this is the shape of "who am I", and widening what an
 * administrator can see about somebody else should not widen it.
 */
public record CurrentUserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        /**
         * Đơn vị báo cáo ASXH của tài khoản (cấp Đơn vị), {@code null} với tài khoản Sở / UBND.
         * Thuộc "tôi là ai" chứ không phải "tôi được làm gì": màn Hồ sơ và đầu trang nhập liệu
         * hiện tên đơn vị của người đăng nhập mà không cần quyền đọc danh mục đơn vị.
         */
        ReportUnitSummary reportUnit) {

    /** Đơn vị báo cáo theo cách endpoint này báo — khai riêng, không dùng DTO slice khác. */
    public record ReportUnitSummary(Long id, String name) {
    }

    public static CurrentUserResponse from(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getReportUnit() == null
                        ? null
                        : new ReportUnitSummary(user.getReportUnit().getId(), user.getReportUnit().getName()));
    }
}
