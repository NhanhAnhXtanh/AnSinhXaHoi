package com.dth.frw.module.asxh.annual.api.dto;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.ReportView;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Wire shape của một phiếu năm ("Phiếu n").
 *
 * <p>{@code sheets} / {@code attachments} chỉ có ở {@code GET /api/annual_reports/{id}} và kết quả
 * nộp / quyết định; ở danh sách là {@code null} (đủ {@code sheetCount} / {@code attachmentCount}).
 *
 * @param status    {@code submitted | approved | returned}
 * @param latest    phiếu mới nhất của năm — chỉ phiếu này được quyết định
 * @param reopened  bị mở lại sau khi đã duyệt (UC-65), khác trả lại thường
 * @param actions   thao tác người đang đăng nhập làm được ({@code approve}, {@code return}, {@code reopen})
 *                  — gợi ý bật nút; máy chủ vẫn kiểm lại
 */
public record AnnualReportResponse(
        Long id,
        int year,
        int revisionNo,
        AnnualReportStatus status,
        String statusLabel,
        int ledgerVersion,
        String docNo,
        LocalDate docDate,
        Instant submittedAt,
        String submittedBy,
        Instant decidedAt,
        String decidedBy,
        String returnReason,
        boolean reopened,
        boolean latest,
        int sheetCount,
        int attachmentCount,
        List<String> actions,
        List<AnnualSheetResponse> sheets,
        List<AnnualAttachmentResponse> attachments) {

    public static AnnualReportResponse from(ReportView view) {
        return from(view, null, null);
    }

    public static AnnualReportResponse from(ReportView view, List<AnnualSheetResponse> sheets,
                                            List<AnnualAttachmentResponse> attachments) {
        AnnualReport report = view.report();
        return new AnnualReportResponse(
                report.getId(),
                report.getReportYear(),
                report.getRevisionNo(),
                report.getStatus(),
                report.getStatus() == null ? null : report.getStatus().label(),
                report.getLedgerVersion(),
                report.getDocNo(),
                report.getDocDate(),
                report.getSubmittedAt(),
                report.getSubmittedBy(),
                report.getDecidedAt(),
                report.getDecidedBy(),
                report.getReturnReason(),
                report.isReopened(),
                view.latest(),
                view.sheetCount(),
                view.attachmentCount(),
                view.actions(),
                sheets,
                attachments);
    }
}
