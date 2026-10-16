package com.dth.frw.module.asxh.summary.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** {@code POST /api/summary/snapshot} — ảnh chụp workbook tổng hợp (UC-57). */
public record SnapshotRequest(
        @NotNull(message = "Vui lòng chọn kỳ báo cáo") Long periodId,
        @NotNull(message = "Vui lòng chọn phiên bản mẫu") Long templateVersionId,
        @NotBlank(message = "Bảng tính rỗng") String workbookJson) {
}
