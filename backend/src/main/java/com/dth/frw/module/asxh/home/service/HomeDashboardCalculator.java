package com.dth.frw.module.asxh.home.service;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Capabilities;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.CellState;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Counts;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Kpi;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.PeriodCard;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Todo;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.TodoItem;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.TodoKind;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.TypeShare;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitBoard;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitPeriod;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitReport;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitRow;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitState;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitSummary;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phép tính của trang chủ — hàm thuần trên các dòng đã nạp, không chạm cơ sở dữ liệu, để
 * kiểm bằng JUnit thường. Port phần đếm/xếp của {@code HomeDashboardService} bản Jmix.
 *
 * <p>Quy ước (giữ như bản Jmix, chỉnh theo máy trạng thái phiếu của bản mới):
 * <ul>
 *   <li>Phiếu {@code SUPERSEDED} và {@code CANCELLED} không tính (BR-75.1).</li>
 *   <li>{@code LOCKED} ở bản mới là phiếu ĐANG NHẬP bị khoá khi chốt đợt — không phải "đã duyệt
 *       rồi khoá" như bản Jmix — nên đếm riêng, và ở chế độ đơn vị tính như chưa nộp.</li>
 *   <li>"Quá hạn" = phiếu đang nhập ({@code DRAFT}) trong kỳ đã quá hạn nộp. Phiếu bị trả lại
 *       vẫn là "bị trả lại" — lý do trả lại có ích cho người xem hơn.</li>
 *   <li>Kỳ quá hạn = trạng thái {@code OVERDUE}, hoặc còn nhận số liệu mà hạn nộp đã qua
 *       (việc chuyển trạng thái chạy theo lịch, có thể chưa tới lượt).</li>
 * </ul>
 */
public final class HomeDashboardCalculator {

    /** Kỳ đang nhận số liệu. */
    public static final Set<PeriodStatus> RECEIVING_PERIOD_STATUSES =
            EnumSet.of(PeriodStatus.OPEN, PeriodStatus.OVERDUE);

    /** Phiếu "còn sống" — được đếm. */
    public static final Set<ReportStatus> LIVE_REPORT_STATUSES = EnumSet.of(
            ReportStatus.DRAFT, ReportStatus.SUBMITTED, ReportStatus.RETURNED,
            ReportStatus.APPROVED, ReportStatus.LOCKED);

    /** Thứ tự loại đơn vị ở khối phân bố. */
    private static final List<ReportUnitType> TYPE_ORDER = List.of(
            ReportUnitType.UBND_XA, ReportUnitType.UBND_HUYEN, ReportUnitType.TRUONG,
            ReportUnitType.SO, ReportUnitType.TINH, ReportUnitType.KHAC);

    private HomeDashboardCalculator() {
    }

    // ------------------------------------------------------------------ dòng vào

    /** Một kỳ báo cáo. */
    public record PeriodRow(
            Long id,
            String name,
            PeriodKind kind,
            LocalDate fromDate,
            LocalDate toDate,
            LocalDate openFrom,
            LocalDate deadline,
            PeriodStatus status) {
    }

    /** Một phiếu nhập của năm (mọi kỳ). */
    public record ReportRow(
            Long id,
            Long unitId,
            String unitName,
            ReportUnitType unitType,
            Long periodId,
            int publicationNo,
            ReportStatus status,
            Instant submittedAt,
            Instant approvedAt,
            Instant returnedAt,
            String returnReason) {
    }

    /** Một tờ biểu của phiếu: tên ngắn ("1a"), tên đầy đủ, thứ tự trên phiếu, tình trạng nhập. */
    public record SheetRow(Long reportId, String shortName, String name, int sortOrder, SheetCompletion completion) {
    }

    /**
     * Toàn bộ đầu vào.
     *
     * @param receivingPeriods kỳ của năm đang nhận số liệu (kỳ khác bị bỏ qua nếu lọt vào)
     * @param reports          phiếu của năm trong phạm vi dữ liệu người gọi
     * @param sheets           tờ biểu của các phiếu đó (tờ của phiếu lạ bị bỏ qua)
     * @param includeUnits     có tính chế độ "Theo đơn vị" không
     * @param todoLimit        số việc tối đa trả về ở "Cần xử lý"
     */
    public record Input(
            int year,
            LocalDate today,
            boolean hasPeriods,
            Capabilities capabilities,
            List<PeriodRow> receivingPeriods,
            List<ReportRow> reports,
            List<SheetRow> sheets,
            boolean includeUnits,
            int todoLimit) {
    }

    // ------------------------------------------------------------------ tính

    public static HomeDashboardResponse compute(Input in) {
        List<ReportRow> live = in.reports().stream()
                .filter(report -> report.status() != null && LIVE_REPORT_STATUSES.contains(report.status()))
                .toList();

        List<PeriodRow> receiving = in.receivingPeriods().stream()
                .filter(period -> period.status() != null && RECEIVING_PERIOD_STATUSES.contains(period.status()))
                .toList();
        Map<Long, PeriodRow> receivingById = new LinkedHashMap<>();
        receiving.forEach(period -> receivingById.put(period.id(), period));

        Kpi kpi = kpi(live, receivingById, in.today());
        List<PeriodCard> periods = periodCards(receiving, live, in.today());
        Todo todo = todo(live, receivingById, in.today(), in.todoLimit());
        UnitBoard units = in.includeUnits()
                ? unitBoard(receiving, live, in.sheets(), in.today())
                : null;

        return new HomeDashboardResponse(in.year(), in.today(), in.hasPeriods(), in.capabilities(),
                kpi, periods, todo, units);
    }

    /** Kỳ đã quá hạn nộp tại ngày {@code today}. */
    public static boolean isOverdue(PeriodRow period, LocalDate today) {
        if (period.status() == PeriodStatus.OVERDUE) {
            return true;
        }
        return period.deadline() != null && period.deadline().isBefore(today);
    }

    /** Số ngày tới hạn nộp: dương = còn, 0 = hôm nay, âm = đã quá; {@code null} khi chưa đặt hạn. */
    public static Integer daysLeft(LocalDate deadline, LocalDate today) {
        return deadline == null ? null : (int) ChronoUnit.DAYS.between(today, deadline);
    }

    /** Đếm phiếu theo tình trạng; phiếu không còn sống bị bỏ qua. */
    public static Counts count(List<ReportRow> reports) {
        int entering = 0;
        int pending = 0;
        int returned = 0;
        int approved = 0;
        int locked = 0;
        for (ReportRow report : reports) {
            if (report.status() == null) {
                continue;
            }
            switch (report.status()) {
                case DRAFT -> entering++;
                case SUBMITTED -> pending++;
                case RETURNED -> returned++;
                case APPROVED -> approved++;
                case LOCKED -> locked++;
                default -> {
                    // SUPERSEDED, CANCELLED: không tính.
                }
            }
        }
        return new Counts(entering + pending + returned + approved + locked,
                entering, pending, returned, approved, locked);
    }

    private static Kpi kpi(List<ReportRow> live, Map<Long, PeriodRow> receivingById, LocalDate today) {
        Counts counts = count(live);
        int overdue = 0;
        for (ReportRow report : live) {
            PeriodRow period = receivingById.get(report.periodId());
            if (report.status() == ReportStatus.DRAFT && period != null && isOverdue(period, today)) {
                overdue++;
            }
        }
        return new Kpi(counts,
                counts.entering() + counts.returned(),
                counts.pending() + counts.approved(),
                overdue,
                receivingById.size());
    }

    private static List<PeriodCard> periodCards(List<PeriodRow> receiving, List<ReportRow> live, LocalDate today) {
        Map<Long, List<ReportRow>> byPeriod = new HashMap<>();
        for (ReportRow report : live) {
            byPeriod.computeIfAbsent(report.periodId(), id -> new ArrayList<>()).add(report);
        }
        return receiving.stream()
                // Hạn nộp gần nhất lên đầu; kỳ chưa đặt hạn xuống cuối.
                .sorted(Comparator.comparing(PeriodRow::deadline, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(PeriodRow::fromDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(PeriodRow::id, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(period -> new PeriodCard(
                        period.id(), period.name(), period.kind(),
                        period.fromDate(), period.toDate(), period.openFrom(), period.deadline(),
                        period.status(),
                        isOverdue(period, today),
                        daysLeft(period.deadline(), today),
                        count(byPeriod.getOrDefault(period.id(), List.of()))))
                .toList();
    }

    private static Todo todo(List<ReportRow> live, Map<Long, PeriodRow> receivingById, LocalDate today, int limit) {
        List<TodoItem> items = new ArrayList<>();
        for (ReportRow report : live) {
            PeriodRow period = receivingById.get(report.periodId());
            if (period == null) {
                continue;
            }
            TodoKind kind = switch (report.status()) {
                case DRAFT -> isOverdue(period, today) ? TodoKind.OVERDUE : TodoKind.ENTERING;
                case SUBMITTED -> TodoKind.PENDING;
                case RETURNED -> TodoKind.RETURNED;
                default -> null;
            };
            if (kind == null) {
                continue;
            }
            items.add(new TodoItem(report.id(), kind, report.unitId(), report.unitName(),
                    period.id(), period.name(), period.deadline(), daysLeft(period.deadline(), today),
                    report.submittedAt(), report.returnedAt(), report.returnReason()));
        }
        items.sort(Comparator.comparing(TodoItem::kind)
                .thenComparingLong(HomeDashboardCalculator::urgencyKey)
                .thenComparing(TodoItem::unitName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(TodoItem::reportId, Comparator.nullsLast(Comparator.naturalOrder())));
        int total = items.size();
        List<TodoItem> head = limit >= 0 && items.size() > limit ? List.copyOf(items.subList(0, limit)) : List.copyOf(items);
        return new Todo(total, head);
    }

    /**
     * Khoá xếp trong cùng loại việc — nhỏ hơn là gấp hơn: quá hạn / đang nhập theo hạn nộp sớm
     * nhất, chờ duyệt theo lần nộp lâu nhất, bị trả lại theo lần trả lâu nhất. Thiếu mốc xuống cuối.
     */
    private static long urgencyKey(TodoItem item) {
        return switch (item.kind()) {
            case OVERDUE, ENTERING -> item.deadline() == null
                    ? Long.MAX_VALUE
                    : item.deadline().toEpochDay() * 86_400L;
            case PENDING -> item.submittedAt() == null ? Long.MAX_VALUE : item.submittedAt().getEpochSecond();
            case RETURNED -> item.returnedAt() == null ? Long.MAX_VALUE : item.returnedAt().getEpochSecond();
        };
    }

    // ------------------------------------------------------------ theo đơn vị

    private record SheetStat(int total, int done, List<String> pending) {
        static final SheetStat EMPTY = new SheetStat(0, 0, List.of());
    }

    private static Map<Long, SheetStat> sheetStats(List<SheetRow> sheets) {
        Map<Long, List<SheetRow>> byReport = new HashMap<>();
        for (SheetRow sheet : sheets) {
            byReport.computeIfAbsent(sheet.reportId(), id -> new ArrayList<>()).add(sheet);
        }
        Map<Long, SheetStat> result = new HashMap<>();
        byReport.forEach((reportId, rows) -> {
            rows.sort(Comparator.comparingInt(SheetRow::sortOrder)
                    .thenComparing(SheetRow::shortName, Comparator.nullsLast(Comparator.naturalOrder())));
            int done = 0;
            List<String> pending = new ArrayList<>();
            for (SheetRow row : rows) {
                if (row.completion() != null && row.completion().isDone()) {
                    done++;
                } else {
                    pending.add(sheetLabel(row));
                }
            }
            result.put(reportId, new SheetStat(rows.size(), done, List.copyOf(pending)));
        });
        return result;
    }

    private static String sheetLabel(SheetRow row) {
        if (row.shortName() != null && !row.shortName().isBlank()) {
            return row.shortName();
        }
        return row.name() == null ? "" : row.name();
    }

    /** Tình trạng chung của một đơn vị từ số phiếu theo nhóm. */
    public static UnitState unitState(int draft, int returned, int pending, int approved) {
        if (returned > 0) {
            return UnitState.RETURNED;
        }
        if (pending + approved == 0) {
            return UnitState.NOT_SUBMITTED;
        }
        return draft > 0 ? UnitState.PARTIAL : UnitState.COMPLETE;
    }

    /**
     * Tình trạng một ô (đơn vị × kỳ) từ số phiếu theo nhóm; {@code draftSheetsDone} = số biểu đã
     * xong trong các phiếu chưa nộp — phân biệt "chưa nộp" với "đang nhập".
     */
    public static CellState cellState(int draft, int returned, int pending, int approved, int draftSheetsDone) {
        if (returned > 0) {
            return CellState.RETURNED;
        }
        if (draft > 0) {
            if (pending + approved > 0) {
                return CellState.PARTIAL;
            }
            return draftSheetsDone > 0 ? CellState.ENTERING : CellState.NOT_STARTED;
        }
        return pending > 0 ? CellState.PENDING : CellState.APPROVED;
    }

    /** Đếm theo nhóm của một ô hoặc cả đơn vị: [chưa nộp (gồm đã chốt), trả lại, chờ duyệt, đã duyệt]. */
    private static final class Bucket {
        int draft;
        int returned;
        int pending;
        int approved;
        int draftSheetsDone;

        void add(ReportStatus status, SheetStat sheets) {
            switch (status) {
                case DRAFT, LOCKED -> {
                    draft++;
                    draftSheetsDone += sheets.done();
                }
                case RETURNED -> returned++;
                case SUBMITTED -> pending++;
                case APPROVED -> approved++;
                default -> {
                }
            }
        }

        int total() {
            return draft + returned + pending + approved;
        }
    }

    private static final class UnitAcc {
        final Long id;
        final String name;
        final ReportUnitType type;
        final Bucket all = new Bucket();
        final Map<Long, Bucket> byPeriod = new LinkedHashMap<>();
        final List<UnitReport> reports = new ArrayList<>();
        int sheetsTotal;
        int sheetsDone;
        Instant lastSubmittedAt;

        UnitAcc(Long id, String name, ReportUnitType type) {
            this.id = id;
            this.name = name == null ? "" : name;
            this.type = type == null ? ReportUnitType.KHAC : type;
        }

        void add(ReportRow report, SheetStat sheets) {
            all.add(report.status(), sheets);
            byPeriod.computeIfAbsent(report.periodId(), id -> new Bucket()).add(report.status(), sheets);
            sheetsTotal += sheets.total();
            sheetsDone += sheets.done();
            if (report.submittedAt() != null
                    && (lastSubmittedAt == null || report.submittedAt().isAfter(lastSubmittedAt))) {
                lastSubmittedAt = report.submittedAt();
            }
            reports.add(new UnitReport(report.id(), report.periodId(), report.publicationNo(), report.status(),
                    sheets.total(), sheets.done(), sheets.pending(),
                    report.submittedAt(), report.approvedAt(), report.returnedAt(), report.returnReason()));
        }

        UnitState state() {
            return unitState(all.draft, all.returned, all.pending, all.approved);
        }

        int pct() {
            return sheetsTotal > 0 ? (int) Math.round(sheetsDone * 100.0 / sheetsTotal) : 0;
        }
    }

    private static UnitBoard unitBoard(List<PeriodRow> receiving, List<ReportRow> live, List<SheetRow> sheets,
                                       LocalDate today) {
        List<PeriodRow> ordered = receiving.stream()
                .sorted(Comparator.comparing(PeriodRow::fromDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(PeriodRow::kind, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(PeriodRow::id, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        Map<Long, Integer> periodOrder = new HashMap<>();
        for (int i = 0; i < ordered.size(); i++) {
            periodOrder.put(ordered.get(i).id(), i);
        }

        Map<Long, SheetStat> stats = sheetStats(sheets);
        Map<Long, UnitAcc> byUnit = new LinkedHashMap<>();
        for (ReportRow report : live) {
            if (!periodOrder.containsKey(report.periodId())) {
                continue;
            }
            byUnit.computeIfAbsent(report.unitId(), id -> new UnitAcc(id, report.unitName(), report.unitType()))
                    .add(report, stats.getOrDefault(report.id(), SheetStat.EMPTY));
        }

        Comparator<UnitAcc> slowestFirst = Comparator
                .comparing(UnitAcc::state)
                .thenComparingInt(UnitAcc::pct)
                .thenComparing(acc -> acc.name, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(acc -> acc.id, Comparator.nullsLast(Comparator.<Long>naturalOrder()));
        Comparator<UnitReport> reportOrder = Comparator
                .comparing((UnitReport r) -> periodOrder.getOrDefault(r.periodId(), Integer.MAX_VALUE))
                .thenComparingInt(UnitReport::publicationNo)
                .thenComparing(UnitReport::id, Comparator.nullsLast(Comparator.naturalOrder()));

        List<UnitAcc> accs = byUnit.values().stream().sorted(slowestFirst).toList();

        List<UnitRow> items = new ArrayList<>();
        Map<UnitState, Integer> byState = new EnumMap<>(UnitState.class);
        Map<ReportUnitType, int[]> byType = new EnumMap<>(ReportUnitType.class);
        int reportCount = 0;
        int returnedReports = 0;
        for (UnitAcc acc : accs) {
            UnitState state = acc.state();
            Map<Long, CellState> cells = new LinkedHashMap<>();
            acc.byPeriod.forEach((periodId, b) ->
                    cells.put(periodId, cellState(b.draft, b.returned, b.pending, b.approved, b.draftSheetsDone)));
            List<UnitReport> reports = acc.reports.stream().sorted(reportOrder).toList();
            items.add(new UnitRow(acc.id, acc.name, acc.type, state, acc.sheetsTotal, acc.sheetsDone,
                    acc.lastSubmittedAt, cells, reports));

            byState.merge(state, 1, Integer::sum);
            reportCount += acc.all.total();
            returnedReports += acc.all.returned;
            int[] share = byType.computeIfAbsent(acc.type, type -> new int[2]);
            share[0]++;
            if (state == UnitState.COMPLETE) {
                share[1]++;
            }
        }

        UnitSummary summary = new UnitSummary(
                items.size(),
                reportCount,
                byState.getOrDefault(UnitState.COMPLETE, 0),
                byState.getOrDefault(UnitState.NOT_SUBMITTED, 0),
                byState.getOrDefault(UnitState.PARTIAL, 0),
                byState.getOrDefault(UnitState.RETURNED, 0),
                returnedReports);
        List<TypeShare> typeShares = TYPE_ORDER.stream()
                .filter(byType::containsKey)
                .map(type -> new TypeShare(type, byType.get(type)[0], byType.get(type)[1]))
                .toList();
        List<UnitPeriod> periods = ordered.stream()
                .map(period -> new UnitPeriod(period.id(), period.name(), period.deadline(), isOverdue(period, today)))
                .toList();
        return new UnitBoard(periods, summary, typeShares, List.copyOf(items));
    }
}
