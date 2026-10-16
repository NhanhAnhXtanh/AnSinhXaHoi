package com.dth.frw.module.security.user.api.dto;

import com.dth.frw.domain.security.user.UserStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PATCH /users/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 *
 * <p>There is deliberately no password field. Changing someone else's password
 * is a different act from editing their profile, with a different permission
 * story and a different audit meaning, so it has its own endpoint
 * ({@code POST /users/{id}/password}) rather than hiding inside a form save.
 */
public record UserPatchRequest(
        @Size(min = 3, max = 100, message = "Tên đăng nhập cần từ 3 đến 100 ký tự.")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                message = "Tên đăng nhập chỉ gồm chữ không dấu, chữ số, dấu chấm, gạch dưới và gạch ngang.")
        String username,

        @Email(message = "Địa chỉ thư điện tử chưa đúng.")
        @Size(max = 255, message = "Thư điện tử tối đa 255 ký tự.")
        String email,

        @Size(min = 1, max = 255, message = "Họ tên cần từ 1 đến 255 ký tự.")
        String fullName,

        UserStatus status,

        /**
         * Placement. Omitting either leaves it alone; sending {@code {"id":
         * null}} clears it. Clearing the organization clears the department
         * with it, since a department outside an organization is a state the
         * schema does not allow.
         */
        @Valid
        OrganizationRef organization,

        @Valid
        DepartmentRef department,

        /** Đơn vị báo cáo ASXH: bỏ trường = giữ nguyên, {@code {"id": null}} = bỏ gắn. */
        @Valid
        ReportUnitRef reportUnit,

        // Size rather than NotEmpty, because null and empty have to mean
        // different things here: omitting the field leaves the assignments
        // alone, while an empty list is rejected. NotEmpty would reject both.
        // An account with no role can sign in and do nothing, which reads as a
        // broken system rather than a deliberate one -- disabling the account
        // is what that is for.
        @Size(min = 1, message = "Vui lòng chọn ít nhất một vai trò.")
        @Valid
        List<RoleRef> roles) {
}
