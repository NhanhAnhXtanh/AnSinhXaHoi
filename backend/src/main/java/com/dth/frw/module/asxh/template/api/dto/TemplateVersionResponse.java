package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRow;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Phiên bản mẫu trên dây.
 *
 * <p>{@code workbookJson} chỉ có ở {@code getOne} (và các thao tác trả về một
 * phiên bản); trong danh sách để {@code null} cho nhẹ. Kịch bản đọc riêng qua
 * {@code GET /template_versions/{id}/scripts}.
 * {@code previousVersionId} là bản nguồn khi tạo bằng "phiên bản kế tiếp".
 */
public record TemplateVersionResponse(
        Long id,
        TemplateSummary template,
        int versionNo,
        Long previousVersionId,
        TemplateStatus status,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Instant publishedAt,
        String publishedBy,
        Instant revokedAt,
        String revokedBy,
        String workbookJson,
        Instant createdAt,
        Instant updatedAt) {

    /** {@code locked} = cả biểu đang khoá — màn thiết kế dùng để chặn Ban hành. */
    public record TemplateSummary(Long id, String code, String shortName, String name,
                                  TemplateKind kind, SetSummary set, boolean locked) {

        static TemplateSummary from(Template template) {
            return new TemplateSummary(
                    template.getId(),
                    template.getCode(),
                    template.getShortName(),
                    template.getName(),
                    template.getKind(),
                    new SetSummary(template.getTemplateSet().getId(), template.getTemplateSet().getName()),
                    template.isLocked());
        }
    }

    public record SetSummary(Long id, String name) {
    }

    /** Dạng gọn cho danh sách — không kèm workbook / script. */
    public static TemplateVersionResponse summary(TemplateVersion version) {
        return from(version, false);
    }

    /** Dạng gọn từ dòng đọc không kèm workbook / script (danh sách). */
    public static TemplateVersionResponse summary(TemplateVersionRow row) {
        return new TemplateVersionResponse(
                row.id(),
                TemplateSummary.from(row.template()),
                row.versionNo(),
                row.previousVersionId(),
                row.status(),
                row.effectiveFrom(),
                row.effectiveTo(),
                row.publishedAt(),
                row.publishedBy(),
                row.revokedAt(),
                row.revokedBy(),
                null,
                row.createdAt(),
                row.updatedAt());
    }

    /** Dạng đầy đủ cho {@code getOne} và các thao tác. */
    public static TemplateVersionResponse full(TemplateVersion version) {
        return from(version, true);
    }

    private static TemplateVersionResponse from(TemplateVersion version, boolean withContent) {
        // previousVersion là LAZY: lấy id từ proxy không cần mở phiên làm việc.
        TemplateVersion previous = version.getPreviousVersion();
        return new TemplateVersionResponse(
                version.getId(),
                TemplateSummary.from(version.getTemplate()),
                version.getVersionNo(),
                previous == null ? null : previous.getId(),
                version.getStatus(),
                version.getEffectiveFrom(),
                version.getEffectiveTo(),
                version.getPublishedAt(),
                version.getPublishedBy(),
                version.getRevokedAt(),
                version.getRevokedBy(),
                withContent ? version.getWorkbookJson() : null,
                version.getCreatedAt(),
                version.getUpdatedAt());
    }
}
