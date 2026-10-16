package com.dth.frw.module.asxh.template.api.dto;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Phiên bản mẫu trên dây.
 *
 * <p>{@code workbookJson} và {@code scriptText} chỉ có ở {@code getOne} (và các
 * thao tác trả về một phiên bản); trong danh sách để {@code null} cho nhẹ.
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
        String scriptText,
        Instant createdAt,
        Instant updatedAt) {

    public record TemplateSummary(Long id, String code, String shortName, String name,
                                  TemplateKind kind, SetSummary set) {

        static TemplateSummary from(Template template) {
            return new TemplateSummary(
                    template.getId(),
                    template.getCode(),
                    template.getShortName(),
                    template.getName(),
                    template.getKind(),
                    new SetSummary(template.getTemplateSet().getId(), template.getTemplateSet().getName()));
        }
    }

    public record SetSummary(Long id, String name) {
    }

    /** Dạng gọn cho danh sách — không kèm workbook / script. */
    public static TemplateVersionResponse summary(TemplateVersion version) {
        return from(version, false);
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
                withContent ? version.getScriptText() : null,
                version.getCreatedAt(),
                version.getUpdatedAt());
    }
}
