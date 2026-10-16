package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import java.time.Instant;

/** Wire shape của một đợt phát hành (lịch sử mở đợt, UC-30). */
public record PublicationResponse(
        Long id,
        PeriodSummary period,
        PublicationKind kind,
        PublicationStatus status,
        int publicationNo,
        int unitCount,
        int reportCount,
        int sheetCount,
        String createdBy,
        Instant createdAt,
        Instant cancelledAt) {

    public record PeriodSummary(Long id, String name, PeriodStatus status) {
        static PeriodSummary from(ReportPeriod period) {
            return new PeriodSummary(period.getId(), period.getName(), period.getStatus());
        }
    }

    /** {@code null} vào thì {@code null} ra — tiện cho các phản hồi mà đợt là tuỳ chọn. */
    public static PublicationResponse from(Publication publication) {
        if (publication == null) {
            return null;
        }
        return new PublicationResponse(
                publication.getId(),
                PeriodSummary.from(publication.getPeriod()),
                publication.getKind(),
                publication.getStatus(),
                publication.getPublicationNo(),
                publication.getUnitCount(),
                publication.getReportCount(),
                publication.getSheetCount(),
                publication.getCreatedBy(),
                publication.getCreatedAt(),
                publication.getCancelledAt());
    }
}
