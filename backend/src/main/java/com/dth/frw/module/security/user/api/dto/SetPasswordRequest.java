package com.dth.frw.module.security.user.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /users/{id}/password} payload — an administrator setting somebody
 * else's password.
 *
 * <p>No current password is asked for, and none could be: the administrator
 * does not know it, and the point of the endpoint is to restore access to an
 * account whose password has been lost. The permission check is what authorises
 * it. Changing your <em>own</em> password goes through
 * {@code POST /api/auth/change-password} instead, which does require the
 * current one.
 */
public record SetPasswordRequest(
        @NotBlank(message = "Vui lòng nhập mật khẩu mới.")
        @Size(min = 8, max = 100, message = "Mật khẩu cần từ 8 đến 100 ký tự.")
        String password) {
}
