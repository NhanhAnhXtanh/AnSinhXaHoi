package com.dth.frw.module.asxh.dept.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Thân yêu cầu của {@code /api/dept_reports}. */
public final class DeptRequests {

    private DeptRequests() {
    }

    /** {@code POST /api/dept_reports} — "Lưu số liệu" cho kỳ đã chốt đợt (UC-54). */
    public record SavePeriodRequest(@NotNull(message = "Vui lòng chọn kỳ báo cáo") Long periodId) {
    }

    /** {@code PUT /api/dept_reports/{id}/sheets/{sheet}/draft} — "Lưu dữ liệu" bảng đang sửa. */
    public record DraftRequest(
            @NotBlank(message = "Bảng tính rỗng, chưa có gì để lưu")
            // Lớp chặn thứ hai sau WorkbookBodySizeFilter (thân không khai Content-Length) — trần 20MB.
            @Size(max = 20_971_520, message = "Bảng tính quá lớn (tối đa 20MB). Hãy xoá bớt dòng, cột hoặc vùng trống thừa rồi lưu lại.")
            String workbookJson,
            @NotNull(message = "Thiếu số hiệu bản lưu của biểu") Long revision) {
    }

    /** Lý do điều chỉnh (không bắt buộc) — hoàn tất một biểu / lưu mọi biểu. */
    public record ReasonRequest(@Size(max = 1000, message = "Lý do tối đa 1000 ký tự") String reason) {
    }

    /** {@code POST /api/dept_reports/{id}/restore} — khôi phục số liệu một phiên bản cũ. */
    public record RestoreRequest(
            @NotNull(message = "Vui lòng chọn phiên bản") @Min(value = 1, message = "Phiên bản không hợp lệ") Integer versionNo,
            @Size(max = 1000, message = "Lý do tối đa 1000 ký tự") String reason) {
    }
}
