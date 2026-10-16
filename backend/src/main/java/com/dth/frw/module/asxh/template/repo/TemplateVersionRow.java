package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Một phiên bản mẫu ở dạng gọn — mọi cột trừ {@code workbook_json} và
 * {@code script_text}.
 *
 * <p>Danh sách phiên bản không trả workbook / script, nhưng nạp entity
 * {@code TemplateVersion} thì Hibernate vẫn kéo cả hai cột văn bản (vài MB mỗi
 * dòng với biểu thật) từ cơ sở dữ liệu rồi mới bỏ đi. Dòng này được đọc bằng
 * truy vấn chỉ chọn các cột nhẹ ({@link TemplateVersionSummaryQuery}).
 */
public record TemplateVersionRow(
        Long id,
        Template template,
        int versionNo,
        Long previousVersionId,
        TemplateStatus status,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Instant publishedAt,
        String publishedBy,
        Instant revokedAt,
        String revokedBy,
        Instant createdAt,
        Instant updatedAt) {
}
