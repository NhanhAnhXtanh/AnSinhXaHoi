package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import java.time.LocalDate;

/**
 * Kết quả một thao tác điều hành kỳ (mở đợt, chốt, gia hạn, thu hồi): trạng thái kỳ sau thao
 * tác, câu báo cho người dùng, và đợt vừa phát (chỉ khi mở đợt).
 */
public record PeriodActionResponse(
        Long periodId,
        String periodName,
        PeriodStatus periodStatus,
        LocalDate deadline,
        PublicationResponse publication,
        String message) {

    public static PeriodActionResponse of(ReportPeriod period, PublicationResponse publication, String message) {
        return new PeriodActionResponse(
                period.getId(), period.getName(), period.getStatus(), period.getDeadline(), publication, message);
    }
}
