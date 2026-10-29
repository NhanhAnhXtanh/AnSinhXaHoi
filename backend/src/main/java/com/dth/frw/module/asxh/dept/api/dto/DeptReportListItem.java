package com.dth.frw.module.asxh.dept.api.dto;

import com.dth.frw.domain.asxh.dept.DeptReport;
import java.time.Instant;
import java.time.LocalDate;

/** Một kỳ đã lưu số liệu tổng hợp — dòng của {@code GET /api/dept_reports?year=}. */
public record DeptReportListItem(Long id, Long periodId, String periodName, LocalDate fromDate, LocalDate toDate,
                                 int reportYear, int ledgerVersion, int sourceCount, Instant createdAt,
                                 String createdBy) {

    /** Gọi khi kỳ đã nạp sẵn (repository {@code join fetch}). */
    public static DeptReportListItem from(DeptReport report) {
        return new DeptReportListItem(report.getId(), report.getPeriod().getId(), report.getPeriod().getName(),
                report.getPeriod().getFromDate(), report.getPeriod().getToDate(), report.getReportYear(),
                report.getLedgerVersion(), report.getSourceCount(), report.getCreatedAt(), report.getCreatedBy());
    }
}
