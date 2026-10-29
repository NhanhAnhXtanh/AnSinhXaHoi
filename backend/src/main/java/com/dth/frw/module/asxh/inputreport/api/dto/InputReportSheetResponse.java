package com.dth.frw.module.asxh.inputreport.api.dto;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.module.asxh.inputreport.service.InputReportSheetService;
import java.time.Instant;

/**
 * Wire shape của một tờ biểu.
 *
 * <p>{@code dataJson} chỉ có ở {@code GET /{id}} — danh sách bỏ trống vì mỗi tờ có thể vài MB.
 * {@code version} là số hiệu bản lưu, frontend gửi lại khi lưu để phát hiện ghi đè.
 *
 * <p>{@code GET /{id}} còn kèm nội dung của phiên bản mẫu đã ghim, để màn nhập liệu không
 * phải gọi {@code /api/template_versions} (cán bộ đơn vị không có quyền đọc danh mục mẫu):
 * <ul>
 *   <li>{@code templateWorkbookJson} — workbook khung của biểu, CHỈ khi tờ biểu chưa có
 *       số liệu ({@code dataJson} trống) — có số liệu rồi thì khung đã nằm trong số liệu;</li>
 *   <li>{@code scriptText} — script của phiên bản mẫu (hook onLoad, validate…) chạy ở
 *       trình duyệt.</li>
 * </ul>
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
        String dataJson,
        String templateWorkbookJson,
        String scriptText) {

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
                includeData ? sheet.getDataJson() : null,
                null,
                null);
    }

    /** Dạng đầy đủ cho {@code GET /{id}}: số liệu + khung và script của phiên bản mẫu. */
    public static InputReportSheetResponse full(InputReportSheetService.SheetContent content) {
        InputReportSheet sheet = content.sheet();
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
                sheet.getDataJson(),
                content.templateWorkbookJson(),
                content.scriptText());
    }
}
