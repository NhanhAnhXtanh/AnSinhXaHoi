package com.dth.frw.module.asxh.inputreport.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Wire shape của một phiếu nhập.
 *
 * <p>Đơn vị, kỳ và đợt lồng thành đối tượng nhỏ khai ngay tại đây (không dùng DTO của slice
 * khác) để nới payload của một endpoint không lặng lẽ nới endpoint kia.
 *
 * <p>{@code progress} là "đã nhập xong {done}/{total} biểu".
 */
public record InputReportResponse(
        Long id,
        UnitSummary unit,
        PeriodSummary period,
        PublicationSummary publication,
        int revisionNo,
        Long previousRevisionId,
        ReportStatus status,
        Instant submittedAt,
        String submittedBy,
        Instant approvedAt,
        String approvedBy,
        Instant returnedAt,
        String returnedBy,
        String returnReason,
        ProgressSummary progress,
        Instant createdAt,
        Instant updatedAt) {

    /**
     * @param block      khối của đơn vị (tỉnh / huyện / xã) — cột "Đơn vị" của màn duyệt
     * @param parentName tên đơn vị cha (huyện / thành phố); {@code null} với đơn vị gốc
     */
    public record UnitSummary(Long id, String budgetCode, String name, ReportBlock block, String parentName) {
        static UnitSummary from(ReportUnit unit, String parentName) {
            return new UnitSummary(unit.getId(), unit.getBudgetCode(), unit.getName(), unit.getBlock(), parentName);
        }
    }

    /**
     * {@code status} quyết định phiếu còn nhập được không: chỉ kỳ {@code open} mới nhập / nộp;
     * phiếu chưa nộp của kỳ {@code overdue} hiện là "Quá hạn" và bị khoá nhập hẳn.
     * {@code year} là năm của lịch báo cáo (ô Năm dùng chung).
     */
    public record PeriodSummary(
            Long id, String name, Integer year, PeriodKind kind,
            LocalDate fromDate, LocalDate toDate, LocalDate deadline, PeriodStatus status) {
        static PeriodSummary from(ReportPeriod period) {
            return new PeriodSummary(
                    period.getId(),
                    period.getName(),
                    period.getYear(),
                    period.getKind(),
                    period.getFromDate(),
                    period.getToDate(),
                    period.getDeadline(),
                    period.getStatus());
        }
    }

    public record PublicationSummary(Long id, PublicationKind kind, int publicationNo) {
        static PublicationSummary from(Publication publication) {
            return new PublicationSummary(publication.getId(), publication.getKind(), publication.getPublicationNo());
        }
    }

    public record ProgressSummary(int done, int total) {
    }

    public static InputReportResponse from(InputReport report, InputReportService.Progress progress) {
        return from(report, progress, null);
    }

    /** @param parentName tên đơn vị cha của đơn vị trên phiếu (hỏi trước cho cả trang) */
    public static InputReportResponse from(InputReport report, InputReportService.Progress progress,
                                           String parentName) {
        InputReportService.Progress p = progress == null ? InputReportService.Progress.EMPTY : progress;
        return new InputReportResponse(
                report.getId(),
                UnitSummary.from(report.getUnit(), parentName),
                PeriodSummary.from(report.getPeriod()),
                PublicationSummary.from(report.getPublication()),
                report.getRevisionNo(),
                report.getPreviousRevisionId(),
                report.getStatus(),
                report.getSubmittedAt(),
                report.getSubmittedBy(),
                report.getApprovedAt(),
                report.getApprovedBy(),
                report.getReturnedAt(),
                report.getReturnedBy(),
                report.getReturnReason(),
                new ProgressSummary(p.done(), p.total()),
                report.getCreatedAt(),
                report.getUpdatedAt());
    }
}
