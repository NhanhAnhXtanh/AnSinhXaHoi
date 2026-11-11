package com.dth.frw.module.asxh.summary.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Báo biểu đổi phiên bản giữa các kỳ của năm")
class SummaryVersionDriftTest {

    private static final Map<Long, String> NAMES = Map.of(1L, "Quý I", 2L, "Quý II", 3L, "Quý III");

    private static Object[] row(long periodId, String template, int versionNo) {
        return new Object[] {periodId, template, versionNo};
    }

    @Test
    @DisplayName("Mọi kỳ dùng cùng một bản: không có câu báo nào")
    void sameVersionEverywhereSaysNothing() {
        assertTrue(SummaryReportService.describeVersionDrift(
                List.of(row(1, "1e", 3), row(2, "1e", 3), row(3, "1e", 3), row(1, "1a", 1)), NAMES).isEmpty());
    }

    @Test
    @DisplayName("Biểu đổi bản giữa năm: nêu bản nào dùng ở kỳ nào, theo tên biểu và số bản")
    void driftIsDescribedPerTemplate() {
        List<String> notes = SummaryReportService.describeVersionDrift(
                List.of(row(3, "1k", 2), row(1, "1k", 1), row(2, "1k", 1), row(1, "1e", 1), row(3, "1e", 3)), NAMES);

        assertEquals(List.of("1e: bản 1 (Quý I), bản 3 (Quý III)", "1k: bản 1 (Quý I, Quý II), bản 2 (Quý III)"), notes);
    }

    @Test
    @DisplayName("Kỳ không có tên trong danh sách thì ghi theo mã kỳ, không làm hỏng câu báo")
    void unknownPeriodIsStillNamed() {
        List<String> notes = SummaryReportService.describeVersionDrift(
                List.of(row(1, "1e", 1), row(9, "1e", 2)), NAMES);

        assertEquals(List.of("1e: bản 1 (Quý I), bản 2 (kỳ 9)"), notes);
    }
}
