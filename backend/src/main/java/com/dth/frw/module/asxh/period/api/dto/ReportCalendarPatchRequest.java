package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import java.util.List;

/**
 * {@code PATCH /report_calendars/{id}} — đổi loại kỳ và/hoặc hạn nộp (UC-21);
 * trường {@code null} = giữ nguyên.
 *
 * <p>{@code year} chỉ được nhận để từ chối có thông báo khi khác năm đã lưu
 * (BR-06.3); form gửi lại nguyên bản ghi nên năm trùng năm cũ là bình thường.
 */
public record ReportCalendarPatchRequest(
        Integer year,

        Integer deadlineDays,

        List<PeriodKind> kinds) {
}
