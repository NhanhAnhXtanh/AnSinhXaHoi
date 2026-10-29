package com.dth.frw.module.asxh.unit.api.dto;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /report_units/{id}} — trường {@code null} nghĩa là giữ nguyên.
 *
 * <p>{@code budgetCode} được nhận chỉ để từ chối có thông báo khi khác mã đã lưu
 * (BR-01.1); form sửa gửi lại nguyên bản ghi nên mã trùng mã cũ là bình thường.
 */
public record ReportUnitPatchRequest(
        String budgetCode,

        @Size(min = 1, max = 255, message = "Tên đơn vị phải từ 1 đến 255 ký tự")
        String name,

        ParentRef parent,

        ReportUnitType unitType,

        ReportBlock block,

        Boolean active,

        Boolean receivesReports) {
}
