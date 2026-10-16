package com.dth.frw.module.asxh.inputreport.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportHistoryResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportSummaryResponse;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Máy trạng thái phiếu nhập (UC-33..43): nhập → hoàn tất biểu → nộp → duyệt / trả lại → nộp
 * lại, và khoá nhập khi kỳ Quá hạn.
 *
 * <p>Chạy trên CSDL thật như các test khác của dự án ({@code contextLoads} cần PostgreSQL), mỗi
 * test một giao dịch rồi cuộn lại — dữ liệu thử (lịch năm xa, mã đơn vị / mã biểu ngẫu nhiên)
 * không đụng dữ liệu mẫu.
 *
 * <p>Các phiếu duyệt trong test chỉ có biểu "Không phát sinh số liệu", để phần ghi số liệu khi
 * duyệt (bỏ qua biểu không phát sinh — UC-41) không cần script của mẫu. Xác nhận Kho bạc
 * (BR-38.1) tắt bằng {@code asxh.attachments.treasury-required=false}: test này kiểm máy trạng
 * thái phiếu, phần đính kèm có test riêng của slice đính kèm.
 */
@SpringBootTest(properties = "asxh.attachments.treasury-required=false")
@Transactional
class InputReportStateMachineTest {

    @Autowired
    private InputReportService reports;

    @Autowired
    private InputReportSheetService sheets;

    @Autowired
    private InputReportQueryService queries;

    @Autowired
    private InputReportSheetRepository sheetRepository;

    @Autowired
    private EntityManager entityManager;

    private ReportPeriod period;
    private InputReport report;
    private List<InputReportSheet> reportSheets;
    private int year;

    @BeforeEach
    void issueOneReport() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        // Năm xa để không va lịch thật (năm là khoá duy nhất).
        year = 2900 + ThreadLocalRandom.current().nextInt(0, 99);

        ReportUnit unit = new ReportUnit("KT" + suffix, "UBND xã Kiểm Thử", null, ReportUnitType.UBND_XA, ReportBlock.XA);
        entityManager.persist(unit);

        ReportCalendar calendar = new ReportCalendar(year, 15, List.of(PeriodKind.QUY));
        entityManager.persist(calendar);
        period = new ReportPeriod(calendar, PeriodKind.QUY, 1, "Q1-" + year, "Quý I/" + year,
                LocalDate.of(year, 1, 1), LocalDate.of(year, 3, 31), LocalDate.of(year, 4, 1),
                LocalDate.of(year, 4, 15));
        period.setStatus(PeriodStatus.OPEN);
        entityManager.persist(period);

        TemplateSet set = new TemplateSet("Bộ kiểm thử " + suffix, null);
        entityManager.persist(set);
        Template first = new Template(set, "A" + suffix, "1a", "Biểu 1a kiểm thử", TemplateKind.CHI_TIET, 1);
        Template second = new Template(set, "B" + suffix, "1b", "Biểu 1b kiểm thử", TemplateKind.CHI_TIET, 2);
        entityManager.persist(first);
        entityManager.persist(second);
        TemplateVersion firstVersion = publishedVersion(first);
        TemplateVersion secondVersion = publishedVersion(second);

        Publication publication = new Publication(period, PublicationKind.LAN_DAU, 1, null);
        entityManager.persist(publication);

        InputReportService.IssueResult result = reports.issue(publication, List.of(
                new InputReportService.IssueRequest(unit, first, firstVersion),
                new InputReportService.IssueRequest(unit, second, secondVersion)));
        assertEquals(1, result.reportCount());
        assertEquals(2, result.sheetCount());

        report = reports.list(listParams("unit.id", String.valueOf(unit.getId()))).getContent().getFirst();
        reportSheets = sheetRepository.findByReportId(report.getId());
        assertEquals(2, reportSheets.size());
    }

    // ------------------------------------------------------------ tờ biểu

    @Test
    @DisplayName("Hoàn tất biểu cần có số liệu; biểu đã xong thì chỉ xem tới khi Sửa lại")
    void sheetCompletionCycle() {
        InputReportSheet sheet = reportSheets.getFirst();
        assertEquals(SheetCompletion.NOT_STARTED, sheet.getCompletion());

        assertThrows(ConflictException.class, () -> sheets.complete(sheet.getId()),
                "biểu chưa có số liệu thì không đánh dấu xong được");

        sheets.saveData(sheet.getId(), "{\"sheets\":{}}", null);
        assertEquals(SheetCompletion.IN_PROGRESS, sheet.getCompletion());

        sheets.complete(sheet.getId());
        assertEquals(SheetCompletion.COMPLETED, sheet.getCompletion());
        assertNotNull(sheet.getCompletedAt());

        assertThrows(ConflictException.class, () -> sheets.saveData(sheet.getId(), "{}", null),
                "biểu đã xong là chỉ xem");

        sheets.reopen(sheet.getId());
        assertEquals(SheetCompletion.IN_PROGRESS, sheet.getCompletion());
        assertNull(sheet.getCompletedAt());
    }

    @Test
    @DisplayName("Lưu với số hiệu bản lưu cũ bị từ chối (đã lưu ở phiên khác)")
    void staleVersionIsRejected() {
        InputReportSheet sheet = reportSheets.getFirst();
        long before = sheet.getVersion();
        sheets.saveData(sheet.getId(), "{\"a\":1}", before);
        assertThrows(ConflictException.class, () -> sheets.saveData(sheet.getId(), "{\"a\":2}", before));
    }

    // ------------------------------------------------------------ nộp

    @Test
    @DisplayName("Chưa xong mọi biểu thì không nộp được phiếu")
    void cannotSubmitWithPendingSheets() {
        sheets.markNoData(reportSheets.getFirst().getId());
        ConflictException error = assertThrows(ConflictException.class, () -> reports.submit(report.getId()));
        assertTrue(error.getMessage().contains("1/2"), error.getMessage());
        assertEquals(ReportStatus.DRAFT, report.getStatus());
    }

    @Test
    @DisplayName("Nộp → Chờ duyệt: khoá sửa số liệu và đánh dấu biểu; phê duyệt → bất biến")
    void submitThenApprove() {
        markAllNoData();

        reports.submit(report.getId());
        assertEquals(ReportStatus.SUBMITTED, report.getStatus());
        assertNotNull(report.getSubmittedAt());

        Long sheetId = reportSheets.getFirst().getId();
        assertThrows(ConflictException.class, () -> sheets.reopen(sheetId), "phiếu đã nộp thì không sửa được");
        assertThrows(ConflictException.class, () -> sheets.saveData(sheetId, "{}", null));
        assertThrows(ConflictException.class, () -> reports.submit(report.getId()), "không nộp hai lần");

        reports.approve(report.getId());
        assertEquals(ReportStatus.APPROVED, report.getStatus());
        assertNotNull(report.getApprovedAt());

        assertThrows(ConflictException.class, () -> reports.approve(report.getId()));
        assertThrows(ConflictException.class, () -> reports.returnReport(report.getId(), "Sai số"),
                "phiếu đã duyệt không trả lại được");
    }

    @Test
    @DisplayName("Chỉ phiếu đang chờ duyệt mới phê duyệt / trả lại được")
    void reviewNeedsSubmitted() {
        assertThrows(ConflictException.class, () -> reports.approve(report.getId()));
        assertThrows(ConflictException.class, () -> reports.returnReport(report.getId(), "Sai số"));
    }

    // ------------------------------------------------------------ trả lại

    @Test
    @DisplayName("Trả lại sinh phiên bản n+1 (Bị trả lại), bản cũ thành Bản cũ; nộp lại được")
    void returnCreatesNextRevisionAndResubmit() {
        markAllNoData();
        reports.submit(report.getId());

        assertThrows(IllegalArgumentException.class, () -> reports.returnReport(report.getId(), "   "),
                "lý do trả lại là bắt buộc");

        InputReport next = reports.returnReport(report.getId(), "Biểu 1a dòng 6 sai số");
        assertNotEquals(report.getId(), next.getId(), "trả lại KHÔNG sửa đè phiếu đã nộp (BR-42.1)");
        assertEquals(ReportStatus.SUPERSEDED, report.getStatus());
        assertEquals(ReportStatus.RETURNED, next.getStatus());
        assertEquals(report.getRevisionNo() + 1, next.getRevisionNo());
        assertEquals(report.getId(), next.getPreviousRevisionId());
        assertEquals("Biểu 1a dòng 6 sai số", next.getReturnReason());

        List<InputReportSheet> copies = sheetRepository.findByReportId(next.getId());
        assertEquals(2, copies.size(), "mọi tờ biểu được chép sang phiên bản mới");
        assertTrue(copies.stream().allMatch(s -> s.getCompletion() == SheetCompletion.NO_DATA),
                "giữ dấu đã nhập xong của từng biểu");

        // Đơn vị sửa lại một biểu rồi nộp lại.
        InputReportSheet copy = copies.getFirst();
        sheets.reopen(copy.getId());
        sheets.saveData(copy.getId(), "{\"sheets\":{}}", null);
        sheets.complete(copy.getId());
        reports.submit(next.getId());
        assertEquals(ReportStatus.SUBMITTED, next.getStatus());
        assertNull(next.getReturnReason(), "nộp lại xoá lý do trả lại cũ (BR-38.4)");

        // Bản cũ không còn trong danh sách mặc định, nhưng vẫn có trong lịch sử phiên bản.
        InputReportHistoryResponse history = queries.history(next.getId());
        assertEquals(2, history.revisions().size());
        assertEquals(2, history.revisions().getFirst().revisionNo(), "mới trước");
        assertTrue(history.events().stream().anyMatch(e -> "RETURNED".equals(e.action())
                && "Biểu 1a dòng 6 sai số".equals(e.note())));
        assertEquals(2, queries.history(report.getId()).revisions().size(),
                "mở từ bản cũ cũng ra đủ chuỗi");
    }

    // ------------------------------------------------------------ kỳ quá hạn

    @Test
    @DisplayName("Kỳ Quá hạn khoá nhập hẳn: không lưu, không đánh dấu, không nộp")
    void overduePeriodBlocksInput() {
        InputReportSheet sheet = reportSheets.getFirst();
        sheets.saveData(sheet.getId(), "{\"sheets\":{}}", null);

        period.setStatus(PeriodStatus.OVERDUE);
        entityManager.flush();

        assertThrows(ConflictException.class, () -> sheets.saveData(sheet.getId(), "{}", null));
        assertThrows(ConflictException.class, () -> sheets.complete(sheet.getId()));
        assertThrows(ConflictException.class, () -> sheets.markNoData(sheet.getId()));
        assertThrows(ConflictException.class, () -> reports.submit(report.getId()));

        InputReportSummaryResponse summary = queries.summary(query("year", String.valueOf(year)));
        assertEquals(1L, summary.counts().get("overdue"), "phiếu chưa nộp của kỳ quá hạn đếm là Quá hạn");
        assertEquals(0L, summary.counts().get("draft"), "và không còn là Cần nhập");
    }

    @Test
    @DisplayName("Phiếu bị trả lại cũng chỉ nhập được khi kỳ Đang mở (BR-43.1)")
    void returnedReportFollowsPeriodToo() {
        markAllNoData();
        reports.submit(report.getId());
        InputReport next = reports.returnReport(report.getId(), "Thiếu số liệu");

        period.setStatus(PeriodStatus.OVERDUE);
        entityManager.flush();

        Long copyId = sheetRepository.findByReportId(next.getId()).getFirst().getId();
        assertThrows(ConflictException.class, () -> sheets.reopen(copyId));
        assertThrows(ConflictException.class, () -> reports.submit(next.getId()));
    }

    @Test
    @DisplayName("Số đếm thẻ lọc nhanh theo trạng thái hiển thị")
    void summaryCounts() {
        InputReportSummaryResponse before = queries.summary(query("year", String.valueOf(year)));
        assertEquals(1L, before.total());
        assertEquals(1L, before.counts().get("draft"));
        assertEquals(1, before.periods().size());
        assertEquals(1, before.templateSets().size());

        markAllNoData();
        reports.submit(report.getId());
        InputReportSummaryResponse after = queries.summary(query("year", String.valueOf(year)));
        assertEquals(0L, after.counts().get("draft"));
        assertEquals(1L, after.counts().get("submitted"));
    }

    // ------------------------------------------------------------ hỗ trợ

    private void markAllNoData() {
        for (InputReportSheet sheet : reportSheets) {
            sheets.markNoData(sheet.getId());
        }
    }

    private TemplateVersion publishedVersion(Template template) {
        TemplateVersion version = new TemplateVersion(template, 1, null);
        version.setStatus(TemplateStatus.PUBLISHED);
        version.setEffectiveFrom(LocalDate.of(year, 1, 1));
        entityManager.persist(version);
        return version;
    }

    private static LinkedMultiValueMap<String, String> query(String key, String value) {
        LinkedMultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        query.add(key, value);
        return query;
    }

    private static com.dth.frw.shared.web.ListParams listParams(String key, String value) {
        return new com.dth.frw.shared.web.ListParams(query(key, value));
    }
}
