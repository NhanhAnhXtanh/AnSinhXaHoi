package com.dth.frw.module.asxh.home.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * {@code GET /api/asxh_dashboard} — số liệu trang chủ của một năm báo cáo (UC-75, UC-76).
 *
 * <p>Mọi con số đếm trên phiếu "còn sống": bản cũ đã thay ({@code SUPERSEDED}) và phiếu huỷ
 * ({@code CANCELLED}) không tính (BR-75.1). Phiếu đi qua phạm vi dữ liệu của người gọi, nên
 * tài khoản bị giới hạn chỉ thấy số của phạm vi mình.
 *
 * <p>Giá trị enum giữ nguyên quy ước dây của từng enum: {@link ReportStatus} chữ hoa
 * ({@code "DRAFT"}) như {@code /api/input_reports}; {@link PeriodStatus}, {@link PeriodKind},
 * {@link ReportUnitType} chữ thường; các enum riêng của trang chủ chữ hoa.
 *
 * @param year         năm đang xem
 * @param today        ngày hôm nay theo giờ Việt Nam — mốc tính "còn N ngày" / "quá N ngày"
 * @param hasPeriods   năm có ít nhất một kỳ báo cáo (UC-75 1a: không có thì màn ghi "Chưa có
 *                     kỳ báo cáo nào")
 * @param capabilities người gọi được xem chế độ "Theo đơn vị" không, được duyệt phiếu không
 * @param kpi          bốn thẻ chỉ số chế độ "Theo phiếu", đếm trên mọi phiếu của năm
 * @param periods      các kỳ đang nhận số liệu (Đang mở / Quá hạn), hạn gần nhất trước
 * @param todo         việc cần xử lý trong các kỳ đang nhận số liệu
 * @param units        chế độ "Theo đơn vị"; {@code null} khi không yêu cầu ({@code units=true})
 *                     hoặc người gọi không được xem
 */
public record HomeDashboardResponse(
        int year,
        LocalDate today,
        boolean hasPeriods,
        Capabilities capabilities,
        Kpi kpi,
        List<PeriodCard> periods,
        Todo todo,
        UnitBoard units) {

    /**
     * @param viewUnits có quyền màn Thiết lập &amp; điều hành — mới thấy chế độ "Theo đơn vị"
     *                  (UC-76: tài khoản đơn vị không thấy chế độ này)
     * @param approve   có quyền duyệt phiếu — việc "chờ duyệt" mở sang màn Duyệt phiếu
     */
    public record Capabilities(boolean viewUnits, boolean approve) {
    }

    /**
     * Số phiếu theo tình trạng. {@code entering} = đang nhập ({@code DRAFT}), {@code pending} =
     * chờ Sở duyệt, {@code returned} = bị trả lại, {@code approved} = đã duyệt, {@code locked} =
     * đã chốt đợt mà chưa nộp. {@code total} là tổng năm nhóm.
     */
    public record Counts(int total, int entering, int pending, int returned, int approved, int locked) {

        public static final Counts EMPTY = new Counts(0, 0, 0, 0, 0, 0);
    }

    /**
     * Thẻ chỉ số "Theo phiếu".
     *
     * @param counts               số phiếu của cả năm theo tình trạng
     * @param needAction           phiếu đơn vị còn phải làm: đang nhập + bị trả lại
     * @param submitted            phiếu đã lên Sở: chờ duyệt + đã duyệt
     * @param overdue              phiếu đang nhập thuộc kỳ đã quá hạn nộp
     * @param receivingPeriodCount số kỳ đang nhận số liệu
     */
    public record Kpi(Counts counts, int needAction, int submitted, int overdue, int receivingPeriodCount) {
    }

    /**
     * Một kỳ đang nhận số liệu ở khối "Phân bố theo kỳ".
     *
     * @param overdue   kỳ đã quá hạn nộp (trạng thái Quá hạn, hoặc Đang mở mà hạn đã qua)
     * @param daysLeft  số ngày tới hạn nộp: dương = còn, 0 = hôm nay, âm = đã quá; {@code null}
     *                  khi kỳ chưa đặt hạn
     * @param counts    phiếu của kỳ theo tình trạng
     */
    public record PeriodCard(
            Long id,
            String name,
            PeriodKind kind,
            LocalDate fromDate,
            LocalDate toDate,
            LocalDate openFrom,
            LocalDate deadline,
            PeriodStatus status,
            boolean overdue,
            Integer daysLeft,
            Counts counts) {
    }

    /** Danh sách "Cần xử lý": {@code total} việc, {@code items} là phần đầu đã cắt theo giới hạn. */
    public record Todo(int total, List<TodoItem> items) {
    }

    /**
     * Một việc cần xử lý — đúng một phiếu.
     *
     * @param reportId id phiếu, để mở {@code /input-reports/:id} hoặc {@code /report-review/:id}
     * @param daysLeft như {@link PeriodCard#daysLeft()}
     */
    public record TodoItem(
            Long reportId,
            TodoKind kind,
            Long unitId,
            String unitName,
            Long periodId,
            String periodName,
            LocalDate deadline,
            Integer daysLeft,
            Instant submittedAt,
            Instant returnedAt,
            String returnReason) {
    }

    /** Loại việc; thứ tự khai báo = thứ tự trên danh sách (gấp trước). */
    public enum TodoKind {
        /** Đang nhập trong kỳ đã quá hạn nộp. */
        OVERDUE,
        /** Đã nộp, chờ Sở duyệt. */
        PENDING,
        /** Sở trả lại, đơn vị phải sửa và nộp lại. */
        RETURNED,
        /** Đang nhập, còn hạn. */
        ENTERING
    }

    /**
     * Chế độ "Theo đơn vị" trên các kỳ đang nhận số liệu.
     *
     * @param periods    các kỳ, cũ trước (mỗi kỳ một cột của bảng)
     * @param summary    bốn thẻ chỉ số — tính trên mọi kỳ, không theo bộ lọc của màn
     * @param typeShares khối "Phân bố theo loại đơn vị"
     * @param items      đơn vị có phiếu trong các kỳ đó, chậm nhất lên đầu
     */
    public record UnitBoard(
            List<UnitPeriod> periods,
            UnitSummary summary,
            List<TypeShare> typeShares,
            List<UnitRow> items) {
    }

    public record UnitPeriod(Long id, String name, LocalDate deadline, boolean overdue) {
    }

    /**
     * @param unitCount       đơn vị phải nộp (có ít nhất một phiếu trong các kỳ)
     * @param reportCount     số phiếu của các đơn vị đó
     * @param returnedReports số phiếu đang bị trả lại
     */
    public record UnitSummary(
            int unitCount,
            int reportCount,
            int complete,
            int notSubmitted,
            int partial,
            int returned,
            int returnedReports) {
    }

    /** Số đơn vị của một loại, và số đã nộp đủ. */
    public record TypeShare(ReportUnitType type, int total, int complete) {
    }

    /**
     * Một dòng bảng đơn vị.
     *
     * @param state        tình trạng chung qua mọi kỳ đang xem
     * @param sheetsTotal  tổng số biểu trong các phiếu của đơn vị
     * @param sheetsDone   số biểu đã nhập xong hoặc đánh dấu không phát sinh
     * @param periodStates tình trạng từng kỳ, khoá là id kỳ (kỳ đơn vị không có phiếu thì không
     *                     có khoá)
     * @param reports      từng phiếu, theo kỳ rồi theo đợt — khối "Chi tiết đơn vị"
     */
    public record UnitRow(
            Long id,
            String name,
            ReportUnitType type,
            UnitState state,
            int sheetsTotal,
            int sheetsDone,
            Instant lastSubmittedAt,
            Map<Long, CellState> periodStates,
            List<UnitReport> reports) {
    }

    /**
     * Một phiếu của đơn vị.
     *
     * @param publicationNo số thứ tự đợt phát hành trong kỳ ("Đợt 1")
     * @param pendingSheets tên ngắn các biểu chưa xong ("1a", "1b"…), theo thứ tự trên phiếu
     */
    public record UnitReport(
            Long id,
            Long periodId,
            int publicationNo,
            ReportStatus status,
            int sheetsTotal,
            int sheetsDone,
            List<String> pendingSheets,
            Instant submittedAt,
            Instant approvedAt,
            Instant returnedAt,
            String returnReason) {
    }

    /** Tình trạng chung của một đơn vị; thứ tự khai báo = thứ tự xếp lên đầu bảng. */
    public enum UnitState {
        /** Chưa nộp phiếu nào. */
        NOT_SUBMITTED,
        /** Có phiếu bị trả lại. */
        RETURNED,
        /** Đã nộp một phần, còn phiếu đang nhập. */
        PARTIAL,
        /** Đã nộp đủ (chờ duyệt hoặc đã duyệt). */
        COMPLETE
    }

    /** Tình trạng phiếu của một đơn vị trong MỘT kỳ — ô theo kỳ của bảng đơn vị. */
    public enum CellState {
        /** Chưa nộp, chưa biểu nào xong. */
        NOT_STARTED,
        /** Chưa nộp, đã có biểu xong. */
        ENTERING,
        /** Có phiếu bị trả lại. */
        RETURNED,
        /** Nộp thiếu: có phiếu đã nộp, còn phiếu (đợt bổ sung) chưa nộp. */
        PARTIAL,
        /** Đã nộp hết, còn phiếu chờ duyệt. */
        PENDING,
        /** Mọi phiếu đã duyệt. */
        APPROVED
    }
}
