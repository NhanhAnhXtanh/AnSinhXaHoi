package com.dth.frw.module.asxh.home.service;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Capabilities;
import com.dth.frw.module.asxh.home.repo.HomeDashboardQueries;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.PeriodRow;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.ReportRow;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.SheetRow;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.rowlevel.Action;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Số liệu trang chủ theo năm báo cáo (UC-75, UC-76) — port {@code HomeDashboardService} của
 * bản Jmix. Service này chỉ nạp dữ liệu; mọi phép đếm, xếp và quy tắc tình trạng nằm ở
 * {@link HomeDashboardCalculator} (hàm thuần, có test riêng).
 *
 * <p><b>Phạm vi dữ liệu theo người dùng.</b> Phiếu đi qua {@code rowLevel.scope(InputReport,
 * READ)} giống {@code InputReportService.list}: tài khoản cấp Đơn vị ({@code users.report_unit_id})
 * chỉ thấy số của đơn vị mình (UC-72, {@code InputReportRowLevelPolicies}); tài khoản Sở / UBND
 * thấy mọi đơn vị. Tờ biểu ở chế độ "Theo đơn vị" chỉ giữ những tờ của phiếu đã qua phạm vi đó.
 *
 * <p>Chế độ "Theo đơn vị" chỉ tính khi được yêu cầu VÀ người gọi có quyền màn Thiết lập &amp;
 * điều hành (BR-76.1: chỉ chế độ đang hiện được nạp).
 */
@Service
@Transactional(readOnly = true)
public class HomeDashboardService {

    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Số việc tối đa ở khối "Cần xử lý"; tổng thật trả kèm. */
    static final int TODO_LIMIT = 50;

    private final HomeDashboardQueries queries;
    private final RowLevelSecurity rowLevel;

    public HomeDashboardService(HomeDashboardQueries queries, RowLevelSecurity rowLevel) {
        this.queries = queries;
        this.rowLevel = rowLevel;
    }

    /** Năm mặc định khi màn không gửi năm: năm nay theo giờ Việt Nam. */
    public int currentYear() {
        return LocalDate.now(VIETNAM).getYear();
    }

    /**
     * @param year         năm báo cáo
     * @param includeUnits có tính chế độ "Theo đơn vị" không (đã xét quyền ở controller)
     * @param capabilities quyền của người gọi, trả nguyên cho màn
     */
    public HomeDashboardResponse load(int year, boolean includeUnits, Capabilities capabilities) {
        LocalDate today = LocalDate.now(VIETNAM);

        List<PeriodRow> receiving = queries
                .periodsByStatus(year, HomeDashboardCalculator.RECEIVING_PERIOD_STATUSES)
                .stream()
                .map(HomeDashboardService::toRow)
                .toList();

        List<InputReport> reports = queries.reportsOfYear(year, HomeDashboardCalculator.LIVE_REPORT_STATUSES,
                rowLevel.scope(InputReport.class, Action.READ));
        List<ReportRow> reportRows = reports.stream().map(HomeDashboardService::toRow).toList();

        List<SheetRow> sheetRows = List.of();
        if (includeUnits && !reportRows.isEmpty()) {
            Set<Long> visible = new HashSet<>();
            reportRows.forEach(row -> visible.add(row.id()));
            sheetRows = queries.sheetRowsOfYear(year, HomeDashboardCalculator.LIVE_REPORT_STATUSES)
                    .stream()
                    .filter(row -> visible.contains((Long) row[0]))
                    .map(HomeDashboardService::toSheetRow)
                    .toList();
        }

        boolean hasPeriods = !receiving.isEmpty() || queries.hasPeriods(year);

        return HomeDashboardCalculator.compute(new HomeDashboardCalculator.Input(
                year, today, hasPeriods, capabilities, receiving, reportRows, sheetRows,
                includeUnits, TODO_LIMIT));
    }

    private static PeriodRow toRow(ReportPeriod period) {
        return new PeriodRow(period.getId(), period.getName(), period.getKind(),
                period.getFromDate(), period.getToDate(), period.getOpenFrom(), period.getDeadline(),
                period.getStatus());
    }

    private static ReportRow toRow(InputReport report) {
        Publication publication = report.getPublication();
        return new ReportRow(
                report.getId(),
                report.getUnit().getId(),
                report.getUnit().getName(),
                report.getUnit().getUnitType(),
                report.getPeriod().getId(),
                publication == null ? 0 : publication.getPublicationNo(),
                report.getStatus(),
                report.getSubmittedAt(),
                report.getApprovedAt(),
                report.getReturnedAt(),
                report.getReturnReason());
    }

    private static SheetRow toSheetRow(Object[] row) {
        return new SheetRow(
                (Long) row[0],
                (String) row[1],
                (String) row[2],
                row[3] == null ? 0 : ((Number) row[3]).intValue(),
                (SheetCompletion) row[4]);
    }
}
