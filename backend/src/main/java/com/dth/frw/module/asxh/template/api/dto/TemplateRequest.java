package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.TemplateKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * {@code POST /templates} — tạo biểu kèm phiên bản đầu tiên ở trạng thái Nháp
 * trong cùng giao dịch (UC-10, BR-10.1).
 *
 * <p>Mã nội bộ do hệ thống sinh nên không có ở đây. {@code kind} trống thì là
 * biểu chi tiết; {@code sortOrder} trống thì đứng cuối bộ mẫu;
 * {@code effectiveFrom} là ngày áp dụng gợi ý cho phiên bản đầu — trống thì lấy
 * ngày 1 tháng sau, như form cũ.
 */
public record TemplateRequest(
        @NotNull(message = "Hãy chọn bộ mẫu")
        @Valid
        TemplateSetRef set,

        @NotBlank(message = "Hãy nhập tên ngắn của biểu (ví dụ 1a)")
        @Size(max = 32, message = "Tên ngắn tối đa 32 ký tự")
        String shortName,

        @NotBlank(message = "Hãy nhập tên biểu")
        @Size(max = 500, message = "Tên biểu tối đa 500 ký tự")
        String name,

        TemplateKind kind,

        @Min(value = 0, message = "Thứ tự không được âm")
        Integer sortOrder,

        LocalDate effectiveFrom) {
}
