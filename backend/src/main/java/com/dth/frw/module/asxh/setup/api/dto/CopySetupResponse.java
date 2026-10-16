package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import java.util.List;

/**
 * Kết quả áp dụng thiết lập cho kỳ khác. {@code message} là câu báo cho người dùng
 * ("Đã áp dụng N ô cho M kỳ."); {@code periods} là các kỳ đích với trạng thái sau khi ghi.
 */
public record CopySetupResponse(
        Long fromPeriodId,
        int added,
        int unchanged,
        int skipped,
        List<PeriodSummary> periods,
        String message) {

    public record PeriodSummary(Long id, String name, PeriodStatus status) {
        public static PeriodSummary from(ReportPeriod period) {
            return new PeriodSummary(period.getId(), period.getName(), period.getStatus());
        }
    }
}
