package com.dth.frw.module.asxh.template.api.dto;

import java.time.LocalDate;

/**
 * Thân (tuỳ chọn) của {@code POST /template_versions/{id}/publish}: ngày áp dụng
 * chốt ngay trong hộp ban hành. Trống thì dùng ngày đã lưu trên phiên bản.
 */
public record PublishRequest(LocalDate effectiveFrom) {
}
