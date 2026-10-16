package com.dth.frw.module.asxh.inputreport.api.dto;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import java.time.Instant;

/**
 * Wire shape của một tờ biểu.
 *
 * <p>{@code dataJson} chỉ có ở {@code GET /{id}} — danh sách bỏ trống vì mỗi tờ có thể vài MB.
 * {@code version} là số hiệu bản lưu, frontend gửi lại khi lưu để phát hiện ghi đè.
 * Workbook khung của biểu lấy ở {@code /api/template_versions/{templateVersionId}}.
 */
public record InputReportSheetResponse(
        Long id,
        Long reportId,
        TemplateSummary template,
        Long templateVersionId,
        SheetCompletion completion,
        Instant completedAt,
        String completedBy,
        Instant dataUpdatedAt,
        String dataUpdatedBy,
        long version,
        String dataJson) {

    public record TemplateSummary(Long id, String shortName, String name) {
        static TemplateSummary from(Template template) {
            return new TemplateSummary(template.getId(), template.getShortName(), template.getName());
        }
    }

    public static InputReportSheetResponse from(InputReportSheet sheet, boolean includeData) {
        return new InputReportSheetResponse(
                sheet.getId(),
                sheet.getReport().getId(),
                TemplateSummary.from(sheet.getTemplate()),
                sheet.getTemplateVersionId(),
                sheet.getCompletion(),
                sheet.getCompletedAt(),
                sheet.getCompletedBy(),
                sheet.getDataUpdatedAt(),
                sheet.getDataUpdatedBy(),
                sheet.getVersion(),
                includeData ? sheet.getDataJson() : null);
    }
}
