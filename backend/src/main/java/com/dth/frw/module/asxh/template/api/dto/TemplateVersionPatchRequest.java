package com.dth.frw.module.asxh.template.api.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code PATCH /template_versions/{id}} — lưu từ Designer (UC-11, UC-12) hoặc
 * đổi ngày áp dụng. Trường {@code null} nghĩa là giữ nguyên. Chỉ phiên bản
 * Nháp / Đang thử nghiệm sửa được.
 *
 * <p>{@code scripts} là CẢ danh sách kịch bản của phiên bản (thay toàn bộ, như nút
 * Lưu của Designer bản Jmix: bảng tính + kịch bản trong một giao dịch).
 */
public record TemplateVersionPatchRequest(
        LocalDate effectiveFrom,

        @Size(max = 20_971_520, message = "Bảng tính quá lớn (tối đa 20MB)")
        String workbookJson,

        @Size(max = 500, message = "Quá nhiều kịch bản (tối đa 500)")
        List<TemplateScriptPayload> scripts) {
}
