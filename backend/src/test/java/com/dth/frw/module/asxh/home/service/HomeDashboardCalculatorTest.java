package com.dth.frw.module.asxh.home.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Capabilities;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.CellState;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Counts;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.PeriodCard;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.TodoItem;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.TodoKind;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitBoard;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitRow;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.UnitState;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.Input;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.PeriodRow;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.ReportRow;
import com.dth.frw.module.asxh.home.service.HomeDashboardCalculator.SheetRow;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Phép tính trang chủ trên dữ liệu dựng tay — không Spring, không cơ sở dữ liệu.
 *
 * <p>Bối cảnh chung: hôm nay 16/10/2026; hai kỳ đang nhận số liệu — Tháng 9 (đã quá hạn, hạn
 * 05/10) và Tháng 10 (còn hạn tới 05/11) — cộng một kỳ đã đóng (Quý II) có phiếu cũ.
 */
class HomeDashboardCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 16);
    private static final Capabilities ALL = new Capabilities(true, true);

    private static final PeriodRow T9 = new PeriodRow(9L, "Tháng 9/2026", PeriodKind.THANG,
            LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), LocalDate.of(2026, 9, 1),
            LocalDate.of(2026, 10, 5), PeriodStatus.OVERDUE);
    private static final PeriodRow T10 = new PeriodRow(10L, "Tháng 10/2026", PeriodKind.THANG,
            LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 1),
            LocalDate.of(2026, 11, 5), PeriodStatus.OPEN);
    /** Kỳ đã đóng — không nằm trong danh sách kỳ đang nhận, phiếu của nó chỉ vào KPI năm. */
    private static final long Q2_ID = 2L;

    private static final long XA_A = 101L;
    private static final long XA_B = 102L;
    private static final long TRUONG_C = 103L;
    private static final long SO_D = 104L;

    private long nextId = 1;

    private ReportRow report(long unitId, long periodId, ReportStatus status) {
        return report(unitId, periodId, 1, status, null, null);
    }

    private ReportRow report(long unitId, long periodId, int publicationNo, ReportStatus status,
                             Instant submittedAt, Instant returnedAt) {
        String name;
        ReportUnitType type;
        if (unitId == XA_A) {
            name = "UBND xã An Phước";
            type = ReportUnitType.UBND_XA;
        } else if (unitId == XA_B) {
            name = "UBND xã Bình An";
            type = ReportUnitType.UBND_XA;
        } else if (unitId == TRUONG_C) {
            name = "Trường THPT Chu Văn An";
            type = ReportUnitType.TRUONG;
        } else {
            name = "Sở Dân tộc";
            type = ReportUnitType.SO;
        }
        return new ReportRow(nextId++, unitId, name, type, periodId, publicationNo, status,
                submittedAt, null, returnedAt, returnedAt == null ? null : "Thiếu số liệu biểu 1b");
    }

    private static SheetRow sheet(long reportId, String shortName, int order, SheetCompletion completion) {
        return new SheetRow(reportId, shortName, "Biểu " + shortName, order, completion);
    }

    private static HomeDashboardResponse compute(List<ReportRow> reports, List<SheetRow> sheets, boolean units) {
        return HomeDashboardCalculator.compute(new Input(2026, TODAY, true, ALL, List.of(T9, T10),
                reports, sheets, units, 50));
    }

    @Test
    @DisplayName("KPI đếm mọi phiếu còn sống của năm, bỏ bản cũ và phiếu huỷ")
    void kpiCountsLiveReportsOnly() {
        List<ReportRow> reports = new ArrayList<>();
        reports.add(report(XA_A, T9.id(), ReportStatus.DRAFT));        // quá hạn
        reports.add(report(XA_B, T9.id(), ReportStatus.SUBMITTED));
        reports.add(report(XA_A, T10.id(), ReportStatus.DRAFT));       // còn hạn
        reports.add(report(XA_B, T10.id(), ReportStatus.RETURNED));
        reports.add(report(TRUONG_C, T10.id(), ReportStatus.APPROVED));
        reports.add(report(SO_D, Q2_ID, ReportStatus.APPROVED));       // kỳ đã đóng: vẫn vào KPI năm
        reports.add(report(SO_D, Q2_ID, ReportStatus.LOCKED));
        reports.add(report(XA_B, T10.id(), ReportStatus.SUPERSEDED));  // bản cũ: không tính
        reports.add(report(TRUONG_C, T9.id(), ReportStatus.CANCELLED)); // huỷ: không tính

        HomeDashboardResponse result = compute(reports, List.of(), false);

        Counts counts = result.kpi().counts();
        assertEquals(7, counts.total());
        assertEquals(2, counts.entering());
        assertEquals(1, counts.pending());
        assertEquals(1, counts.returned());
        assertEquals(2, counts.approved());
        assertEquals(1, counts.locked());

        assertEquals(3, result.kpi().needAction(), "đang nhập + bị trả lại");
        assertEquals(3, result.kpi().submitted(), "chờ duyệt + đã duyệt");
        assertEquals(1, result.kpi().overdue(), "chỉ phiếu đang nhập của kỳ quá hạn");
        assertEquals(2, result.kpi().receivingPeriodCount());
        assertNull(result.units(), "không yêu cầu chế độ đơn vị thì không tính");
    }

    @Test
    @DisplayName("Kỳ còn mở nhưng hạn đã qua vẫn tính là quá hạn")
    void openPeriodPastDeadlineIsOverdue() {
        PeriodRow late = new PeriodRow(11L, "Quý III/2026", PeriodKind.QUY,
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 9, 30), LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 12), PeriodStatus.OPEN);
        assertTrue(HomeDashboardCalculator.isOverdue(late, TODAY));
        assertFalse(HomeDashboardCalculator.isOverdue(T10, TODAY));
        assertTrue(HomeDashboardCalculator.isOverdue(T9, TODAY));

        assertEquals(-4, HomeDashboardCalculator.daysLeft(late.deadline(), TODAY));
        assertEquals(20, HomeDashboardCalculator.daysLeft(T10.deadline(), TODAY));
        assertEquals(0, HomeDashboardCalculator.daysLeft(TODAY, TODAY));
        assertNull(HomeDashboardCalculator.daysLeft(null, TODAY));
    }

    @Test
    @DisplayName("Phân bố theo kỳ: hạn gần nhất trước, mỗi kỳ đếm phiếu của chính nó")
    void periodCardsSortedByDeadline() {
        List<ReportRow> reports = List.of(
                report(XA_A, T10.id(), ReportStatus.DRAFT),
                report(XA_B, T10.id(), ReportStatus.APPROVED),
                report(XA_A, T9.id(), ReportStatus.SUBMITTED));

        // Đưa T10 vào trước để chắc thứ tự là do phép tính xếp.
        HomeDashboardResponse result = HomeDashboardCalculator.compute(new Input(2026, TODAY, true, ALL,
                List.of(T10, T9), reports, List.of(), false, 50));

        List<PeriodCard> periods = result.periods();
        assertEquals(List.of(9L, 10L), periods.stream().map(PeriodCard::id).toList());
        assertTrue(periods.get(0).overdue());
        assertEquals(-11, periods.get(0).daysLeft());
        assertEquals(1, periods.get(0).counts().total());
        assertEquals(1, periods.get(0).counts().pending());
        assertFalse(periods.get(1).overdue());
        assertEquals(2, periods.get(1).counts().total());
        assertEquals(1, periods.get(1).counts().approved());
    }

    @Test
    @DisplayName("Cần xử lý: quá hạn, chờ duyệt, trả lại, đang nhập — chỉ trong kỳ đang nhận")
    void todoOrderAndScope() {
        Instant earlySubmit = Instant.parse("2026-10-10T02:00:00Z");
        Instant lateSubmit = Instant.parse("2026-10-14T07:10:00Z");
        List<ReportRow> reports = List.of(
                report(XA_A, T10.id(), 1, ReportStatus.DRAFT, null, null),
                report(XA_B, T10.id(), 1, ReportStatus.SUBMITTED, lateSubmit, null),
                report(TRUONG_C, T10.id(), 1, ReportStatus.SUBMITTED, earlySubmit, null),
                report(SO_D, T10.id(), 2, ReportStatus.RETURNED, null, Instant.parse("2026-10-12T03:00:00Z")),
                report(XA_B, T9.id(), 1, ReportStatus.DRAFT, null, null),
                report(SO_D, T9.id(), 1, ReportStatus.APPROVED, null, null),  // đã xong: không phải việc
                report(XA_A, Q2_ID, 1, ReportStatus.DRAFT, null, null));      // kỳ không nhận: bỏ

        HomeDashboardResponse result = compute(reports, List.of(), false);

        List<TodoItem> items = result.todo().items();
        assertEquals(5, result.todo().total());
        assertEquals(List.of(TodoKind.OVERDUE, TodoKind.PENDING, TodoKind.PENDING, TodoKind.RETURNED,
                TodoKind.ENTERING), items.stream().map(TodoItem::kind).toList());
        assertEquals(XA_B, items.get(0).unitId());
        assertEquals(TRUONG_C, items.get(1).unitId(), "chờ duyệt lâu nhất lên trước");
        assertEquals(XA_B, items.get(2).unitId());
        assertEquals("Thiếu số liệu biểu 1b", items.get(3).returnReason());
        assertEquals(20, items.get(4).daysLeft());
    }

    @Test
    @DisplayName("Cần xử lý cắt theo giới hạn nhưng vẫn trả tổng thật")
    void todoLimit() {
        List<ReportRow> reports = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            reports.add(report(XA_A, T10.id(), ReportStatus.DRAFT));
        }
        HomeDashboardResponse result = HomeDashboardCalculator.compute(new Input(2026, TODAY, true, ALL,
                List.of(T9, T10), reports, List.of(), false, 3));
        assertEquals(5, result.todo().total());
        assertEquals(3, result.todo().items().size());
    }

    @Test
    @DisplayName("Tình trạng ô và tình trạng chung của đơn vị")
    void stateRules() {
        // ô: draft, returned, pending, approved, draftSheetsDone
        assertEquals(CellState.RETURNED, HomeDashboardCalculator.cellState(1, 1, 0, 0, 0));
        assertEquals(CellState.NOT_STARTED, HomeDashboardCalculator.cellState(1, 0, 0, 0, 0));
        assertEquals(CellState.ENTERING, HomeDashboardCalculator.cellState(1, 0, 0, 0, 3));
        assertEquals(CellState.PARTIAL, HomeDashboardCalculator.cellState(1, 0, 1, 0, 0));
        assertEquals(CellState.PENDING, HomeDashboardCalculator.cellState(0, 0, 1, 1, 0));
        assertEquals(CellState.APPROVED, HomeDashboardCalculator.cellState(0, 0, 0, 2, 0));

        // đơn vị: draft, returned, pending, approved
        assertEquals(UnitState.RETURNED, HomeDashboardCalculator.unitState(0, 1, 3, 3));
        assertEquals(UnitState.NOT_SUBMITTED, HomeDashboardCalculator.unitState(2, 0, 0, 0));
        assertEquals(UnitState.PARTIAL, HomeDashboardCalculator.unitState(1, 0, 1, 0));
        assertEquals(UnitState.COMPLETE, HomeDashboardCalculator.unitState(0, 0, 1, 1));
    }

    @Test
    @DisplayName("Theo đơn vị: tóm tắt, xếp chậm nhất trước, tiến độ biểu và biểu chưa xong")
    void unitBoard() {
        ReportRow aT9 = report(XA_A, T9.id(), ReportStatus.DRAFT);
        ReportRow aT10 = report(XA_A, T10.id(), ReportStatus.DRAFT);
        ReportRow bT9 = report(XA_B, T9.id(), ReportStatus.APPROVED);
        ReportRow bT10 = report(XA_B, T10.id(), ReportStatus.SUBMITTED);
        ReportRow cT9 = report(TRUONG_C, T9.id(), ReportStatus.RETURNED);
        ReportRow dT9 = report(SO_D, T9.id(), ReportStatus.APPROVED);
        ReportRow dT9b = report(SO_D, T9.id(), 2, ReportStatus.DRAFT, null, null); // đợt bổ sung chưa nộp
        ReportRow oldQ2 = report(SO_D, Q2_ID, ReportStatus.APPROVED);              // ngoài kỳ đang nhận

        List<SheetRow> sheets = List.of(
                sheet(aT9.id(), "1b", 2, SheetCompletion.COMPLETED),
                sheet(aT9.id(), "1a", 1, SheetCompletion.IN_PROGRESS),
                sheet(aT9.id(), "1c", 3, SheetCompletion.NOT_STARTED),
                sheet(aT10.id(), "1a", 1, SheetCompletion.NOT_STARTED),
                sheet(bT9.id(), "1a", 1, SheetCompletion.COMPLETED),
                sheet(bT10.id(), "1a", 1, SheetCompletion.NO_DATA),
                sheet(cT9.id(), "1a", 1, SheetCompletion.COMPLETED),
                sheet(dT9.id(), "1a", 1, SheetCompletion.COMPLETED),
                sheet(dT9b.id(), "1a", 1, SheetCompletion.IN_PROGRESS),
                sheet(oldQ2.id(), "1a", 1, SheetCompletion.COMPLETED));

        HomeDashboardResponse result = compute(List.of(aT9, aT10, bT9, bT10, cT9, dT9, dT9b, oldQ2), sheets, true);
        UnitBoard board = result.units();
        assertNotNull(board);

        assertEquals(List.of(9L, 10L), board.periods().stream().map(p -> p.id()).toList(), "kỳ cũ trước");
        assertEquals(4, board.summary().unitCount());
        assertEquals(7, board.summary().reportCount(), "phiếu kỳ đã đóng không tính");
        assertEquals(1, board.summary().complete());
        assertEquals(1, board.summary().notSubmitted());
        assertEquals(1, board.summary().partial());
        assertEquals(1, board.summary().returned());
        assertEquals(1, board.summary().returnedReports());

        // Chậm nhất trước: chưa nộp, có trả lại, nộp thiếu, đã nộp đủ.
        assertEquals(List.of(XA_A, TRUONG_C, SO_D, XA_B), board.items().stream().map(UnitRow::id).toList());

        UnitRow a = board.items().get(0);
        assertEquals(UnitState.NOT_SUBMITTED, a.state());
        assertEquals(4, a.sheetsTotal());
        assertEquals(1, a.sheetsDone());
        assertEquals(CellState.ENTERING, a.periodStates().get(9L));
        assertEquals(CellState.NOT_STARTED, a.periodStates().get(10L));
        assertEquals(List.of("1a", "1c"), a.reports().get(0).pendingSheets(), "theo thứ tự trên phiếu");

        UnitRow d = board.items().get(2);
        assertEquals(UnitState.PARTIAL, d.state());
        assertEquals(CellState.PARTIAL, d.periodStates().get(9L));
        assertFalse(d.periodStates().containsKey(Q2_ID));
        assertEquals(List.of(1, 2), d.reports().stream().map(r -> r.publicationNo()).toList());

        UnitRow b = board.items().get(3);
        assertEquals(UnitState.COMPLETE, b.state());
        assertEquals(CellState.APPROVED, b.periodStates().get(9L));
        assertEquals(CellState.PENDING, b.periodStates().get(10L));
        assertEquals(2, b.sheetsDone(), "không phát sinh cũng là xong");

        // Phân bố theo loại: xã trước, rồi trường, rồi sở.
        assertEquals(List.of(ReportUnitType.UBND_XA, ReportUnitType.TRUONG, ReportUnitType.SO),
                board.typeShares().stream().map(s -> s.type()).toList());
        assertEquals(2, board.typeShares().get(0).total());
        assertEquals(1, board.typeShares().get(0).complete());
    }

    @Test
    @DisplayName("Phiếu khoá SAU khi duyệt (có ngày duyệt) vẫn là đã duyệt; khoá khi chốt đợt là chưa nộp")
    void lockedAfterApprovalCountsAsApproved() {
        Instant approvedAt = Instant.parse("2026-10-08T03:00:00Z");
        ReportRow lockedApproved = new ReportRow(nextId++, XA_A, "UBND xã An Phước", ReportUnitType.UBND_XA,
                T9.id(), 1, ReportStatus.LOCKED, Instant.parse("2026-10-03T03:00:00Z"), approvedAt, null, null);
        ReportRow lockedUnsubmitted = new ReportRow(nextId++, XA_B, "UBND xã Bình An", ReportUnitType.UBND_XA,
                T9.id(), 1, ReportStatus.LOCKED, null, null, null, null);

        HomeDashboardResponse result = compute(List.of(lockedApproved, lockedUnsubmitted), List.of(), true);

        Counts counts = result.kpi().counts();
        assertEquals(2, counts.total());
        assertEquals(1, counts.approved(), "khoá sau duyệt tính vào đã duyệt");
        assertEquals(1, counts.locked(), "chỉ phiếu chốt mà chưa nộp mới là 'đã chốt'");
        assertEquals(1, result.kpi().submitted());

        UnitBoard board = result.units();
        UnitRow a = board.items().stream().filter(row -> row.id() == XA_A).findFirst().orElseThrow();
        UnitRow b = board.items().stream().filter(row -> row.id() == XA_B).findFirst().orElseThrow();
        assertEquals(UnitState.COMPLETE, a.state());
        assertEquals(CellState.APPROVED, a.periodStates().get(9L));
        assertEquals(UnitState.NOT_SUBMITTED, b.state());
        assertEquals(1, board.summary().complete());
        assertEquals(1, board.summary().notSubmitted());
    }

    @Test
    @DisplayName("Năm không có phiếu: mọi số bằng 0, danh sách rỗng")
    void emptyYear() {
        HomeDashboardResponse result = HomeDashboardCalculator.compute(new Input(2027, TODAY, false, ALL,
                List.of(), List.of(), List.of(), true, 50));
        assertFalse(result.hasPeriods());
        assertEquals(Counts.EMPTY, result.kpi().counts());
        assertEquals(0, result.kpi().overdue());
        assertTrue(result.periods().isEmpty());
        assertEquals(0, result.todo().total());
        assertNotNull(result.units());
        assertEquals(0, result.units().summary().unitCount());
        assertTrue(result.units().items().isEmpty());
    }
}
