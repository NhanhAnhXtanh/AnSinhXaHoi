package com.dth.frw.module.asxh.annual.api.dto;

import com.dth.frw.domain.asxh.annual.AnnualReportSheet;

/**
 * Một biểu tổng hợp năm của phiếu, với phiên bản mẫu đã ghim. {@code templateCode} là mã nội bộ —
 * chỉ để script đọc, giao diện hiện {@code shortName} / {@code name}.
 */
public record AnnualSheetResponse(
        Long templateId,
        String templateCode,
        String shortName,
        String name,
        Long templateVersionId,
        int versionNo,
        int displayOrder) {

    public static AnnualSheetResponse from(AnnualReportSheet sheet) {
        return new AnnualSheetResponse(
                sheet.getTemplate().getId(),
                sheet.getTemplate().getCode(),
                sheet.getTemplate().getShortName(),
                sheet.getTemplate().getName(),
                sheet.getTemplateVersion().getId(),
                sheet.getTemplateVersion().getVersionNo(),
                sheet.getDisplayOrder());
    }
}
