package com.dth.frw.module.asxh.unit.api.dto;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /report_units}.
 *
 * <p>{@code block}, {@code active}, {@code receivesReports} tuỳ chọn: thiếu khối thì
 * suy từ loại đơn vị; hai cờ mặc định bật (đơn vị mới thuộc diện báo cáo).
 */
public record ReportUnitRequest(
        @NotBlank(message = "Vui lòng nhập mã đơn vị (mã quan hệ ngân sách)")
        @Size(max = 32, message = "Mã đơn vị tối đa 32 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã đơn vị chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang")
        String budgetCode,

        @NotBlank(message = "Vui lòng nhập tên đơn vị")
        @Size(max = 255, message = "Tên đơn vị tối đa 255 ký tự")
        String name,

        ParentRef parent,

        @NotNull(message = "Vui lòng chọn loại đơn vị")
        ReportUnitType unitType,

        ReportBlock block,

        Boolean active,

        Boolean receivesReports) {
}
