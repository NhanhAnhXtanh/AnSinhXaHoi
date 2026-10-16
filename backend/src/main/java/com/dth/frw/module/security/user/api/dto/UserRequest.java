package com.dth.frw.module.security.user.api.dto;

import com.dth.frw.domain.security.user.UserStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /users} payload.
 *
 * <p>The password is set by whoever creates the account, because there is no
 * self-registration and no mail server to send an invitation through. It is
 * accepted here in the clear over the transport and hashed before it reaches
 * the database — it is never stored, echoed or logged.
 */
public record UserRequest(
        @NotBlank(message = "Vui lòng nhập tên đăng nhập.")
        @Size(min = 3, max = 100, message = "Tên đăng nhập cần từ 3 đến 100 ký tự.")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                message = "Tên đăng nhập chỉ gồm chữ không dấu, chữ số, dấu chấm, gạch dưới và gạch ngang.")
        String username,

        @NotBlank(message = "Vui lòng nhập thư điện tử.")
        @Email(message = "Địa chỉ thư điện tử chưa đúng.")
        @Size(max = 255, message = "Thư điện tử tối đa 255 ký tự.")
        String email,

        @NotBlank(message = "Vui lòng nhập họ tên.")
        @Size(max = 255, message = "Họ tên tối đa 255 ký tự.")
        String fullName,

        @NotBlank(message = "Vui lòng đặt mật khẩu.")
        // Length is the only rule worth enforcing here. Composition rules push
        // people towards predictable substitutions without adding real entropy,
        // and a longer minimum buys more than a required symbol does.
        @Size(min = 8, max = 100, message = "Mật khẩu cần từ 8 đến 100 ký tự.")
        String password,

        /** Optional; a user created without one starts active. */
        UserStatus status,

        /**
         * Optional placement. A department may be sent without an organization
         * — the organization is then taken from the department, being the only
         * one it could legally be — but the two disagreeing is refused.
         */
        @Valid
        OrganizationRef organization,

        @Valid
        DepartmentRef department,

        /**
         * Đơn vị báo cáo ASXH, không bắt buộc. Có đơn vị ⇒ tài khoản cấp Đơn vị, chỉ thấy
         * phiếu của đơn vị mình; để trống ⇒ tài khoản Sở / UBND.
         */
        @Valid
        ReportUnitRef reportUnit,

        @NotEmpty(message = "Vui lòng chọn ít nhất một vai trò.")
        @Valid
        List<RoleRef> roles) {
}
