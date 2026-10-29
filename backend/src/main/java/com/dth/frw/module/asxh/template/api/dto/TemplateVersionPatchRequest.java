package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * {@code PATCH /template_versions/{id}} — lưu từ Designer (UC-11, UC-12) hoặc
 * đổi ngày áp dụng. Trường {@code null} nghĩa là giữ nguyên. Chỉ phiên bản
 * Nháp / Đang thử nghiệm sửa được.
 */
public record TemplateVersionPatchRequest(
        LocalDate effectiveFrom,

        @Size(max = 20_971_520, message = "Bảng tính quá lớn (tối đa 20MB)")
        String workbookJson,

        @Size(max = 2_000_000, message = "Script quá dài")
        String scriptText) {
}
