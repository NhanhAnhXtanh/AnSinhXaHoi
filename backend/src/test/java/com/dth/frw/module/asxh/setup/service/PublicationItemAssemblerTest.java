package com.dth.frw.module.asxh.setup.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.Delivery;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.AuditRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.PublicationRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.ReportRow;
import com.dth.frw.module.asxh.setup.repo.PublicationItemQueries.SheetRow;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Gán biểu về đợt (UC-30) theo thời điểm tạo của tờ biểu GỐC — phần thuần, không CSDL.
 *
 * <p>Mốc thời gian theo phút của một ngày giả định: đợt 1 lúc 08:00, trả lại lúc 09:00, đợt bổ
 * sung lúc 10:00.
 */
class PublicationItemAssemblerTest {

    private static final long PUB_1 = 1;
    private static final long PUB_2 = 2;
    private static final long UNIT_A = 100;
    private static final long UNIT_B = 200;
    private static final long BIEU_1A = 11;
    private static final long BIEU_1B = 12;

    private static final List<PublicationRow> PUBLICATIONS = List.of(
            new PublicationRow(PUB_1, 1, PublicationKind.LAN_DAU, PublicationStatus.PUBLISHED, at(8, 0)),
            new PublicationRow(PUB_2, 2, PublicationKind.BO_SUNG, PublicationStatus.PUBLISHED, at(10, 0)));

    @Test
    @DisplayName("Đợt bổ sung thêm biểu vào phiếu đang nhập: biểu mới thuộc đợt bổ sung, biểu cũ ở lại đợt 1")
    void supplementalAddsSheetToOpenReport() {
        ReportRow report = report(1000, UNIT_A, PUB_1, 1, null, ReportStatus.DRAFT, at(8, 0));
        List<SheetRow> sheets = List.of(
                sheet(1, 1000, BIEU_1A, at(8, 0)),
                sheet(2, 1000, BIEU_1B, at(10, 0)));

        List<PublicationItemAssembler.Assigned> first =
                PublicationItemAssembler.assign(PUB_1, PUBLICATIONS, List.of(report), sheets);
        assertEquals(1, first.size());
        assertEquals(BIEU_1A, first.getFirst().templateId());
        assertEquals(Delivery.NEW_REPORT, first.getFirst().delivery());
        assertFalse(first.getFirst().derived());

        List<PublicationItemAssembler.Assigned> second =
                PublicationItemAssembler.assign(PUB_2, PUBLICATIONS, List.of(report), sheets);
        assertEquals(1, second.size());
        assertEquals(BIEU_1B, second.getFirst().templateId());
        assertEquals(Delivery.ADDED_TO_OPEN_REPORT, second.getFirst().delivery());
        assertEquals(1000L, second.getFirst().first().id());
        assertFalse(second.getFirst().derived());
    }

    @Test
    @DisplayName("Phiếu bị trả lại sau đợt bổ sung: tờ biểu sao chép không bị gán sang đợt bổ sung")
    void returnedCopiesStayWithOriginalPublication() {
        // Đợt 1 phát 1a lúc 08:00; Sở trả lại lúc 10:30 (SAU đợt bổ sung) → bản 2 chép 1a lúc 10:30.
        ReportRow rev1 = report(1000, UNIT_A, PUB_1, 1, null, ReportStatus.SUPERSEDED, at(8, 0));
        ReportRow rev2 = report(1001, UNIT_A, PUB_1, 2, 1000L, ReportStatus.RETURNED, at(10, 30));
        List<SheetRow> sheets = List.of(
                sheet(1, 1000, BIEU_1A, at(8, 0)),
                sheet(2, 1001, BIEU_1A, at(10, 30)));

        List<PublicationItemAssembler.Assigned> first =
                PublicationItemAssembler.assign(PUB_1, PUBLICATIONS, List.of(rev1, rev2), sheets);
        assertEquals(1, first.size(), "một dòng cho cả chuỗi phiên bản");
        PublicationItemAssembler.Assigned item = first.getFirst();
        assertEquals(1001L, item.latest().id(), "phiếu hiện tại là bản mới nhất");
        assertEquals(2L, item.current().id(), "tờ biểu hiện tại nằm ở bản mới nhất");
        assertEquals(1L, item.original().id(), "tờ gốc là tờ do đợt 1 phát");
        assertEquals(List.of(1000L, 1001L), item.chainReportIds());

        assertTrue(PublicationItemAssembler.assign(PUB_2, PUBLICATIONS, List.of(rev1, rev2), sheets).isEmpty(),
                "đợt bổ sung không có dòng nào chỉ vì bản sao được tạo sau nó");
    }

    @Test
    @DisplayName("Đợt bổ sung lập phiếu mới khi phiếu cũ đã nộp: dòng của phiếu mới thuộc đợt bổ sung")
    void supplementalCreatesNewReport() {
        ReportRow old = report(1000, UNIT_B, PUB_1, 1, null, ReportStatus.SUBMITTED, at(8, 0));
        ReportRow fresh = report(1002, UNIT_B, PUB_2, 1, null, ReportStatus.DRAFT, at(10, 0));
        List<SheetRow> sheets = List.of(
                sheet(1, 1000, BIEU_1A, at(8, 0)),
                sheet(3, 1002, BIEU_1B, at(10, 0)));

        List<PublicationItemAssembler.Assigned> second =
                PublicationItemAssembler.assign(PUB_2, PUBLICATIONS, List.of(old, fresh), sheets);
        assertEquals(1, second.size());
        assertEquals(Delivery.NEW_REPORT, second.getFirst().delivery());
        assertEquals(1002L, second.getFirst().latest().id());
    }

    @Test
    @DisplayName("Tờ biểu có thời điểm trước mọi đợt: gán về đợt của phiếu và đánh dấu suy ra")
    void sheetOlderThanEveryPublicationIsDerived() {
        ReportRow report = report(1000, UNIT_A, PUB_1, 1, null, ReportStatus.APPROVED, at(7, 0));
        List<SheetRow> sheets = List.of(sheet(1, 1000, BIEU_1A, at(7, 0)));

        List<PublicationItemAssembler.Assigned> first =
                PublicationItemAssembler.assign(PUB_1, PUBLICATIONS, List.of(report), sheets);
        assertEquals(1, first.size());
        assertTrue(first.getFirst().derived());
        assertEquals(Delivery.NEW_REPORT, first.getFirst().delivery());
    }

    @Test
    @DisplayName("Ghi số liệu: lấy lần thành công và lần thất bại gần nhất của đúng biểu trong chuỗi phiếu")
    void ledgerPicksLatestWritesOfTheSheet() {
        ReportRow rev1 = report(1000, UNIT_A, PUB_1, 1, null, ReportStatus.SUPERSEDED, at(8, 0));
        ReportRow rev2 = report(1001, UNIT_A, PUB_1, 2, 1000L, ReportStatus.APPROVED, at(9, 0));
        List<SheetRow> sheets = List.of(sheet(1, 1000, BIEU_1A, at(8, 0)), sheet(2, 1001, BIEU_1A, at(9, 0)));
        PublicationItemAssembler.Assigned item =
                PublicationItemAssembler.assign(PUB_1, PUBLICATIONS, List.of(rev1, rev2), sheets).getFirst();

        List<AuditRow> audits = List.of(
                audit(1000, BIEU_1A, LedgerWriteAudit.Result.FAILED, at(8, 30)),
                audit(1001, BIEU_1A, LedgerWriteAudit.Result.SUCCESS, at(9, 30)),
                audit(1001, BIEU_1B, LedgerWriteAudit.Result.SUCCESS, at(9, 40)),
                audit(5555, BIEU_1A, LedgerWriteAudit.Result.SUCCESS, at(9, 50)));
        PublicationItemAssembler.LedgerSummary ledger = PublicationItemAssembler.ledger(item, audits);
        assertEquals(at(9, 30), ledger.lastSuccess().operatedAt());
        assertEquals(at(8, 30), ledger.lastFailure().operatedAt());

        PublicationItemAssembler.LedgerSummary none = PublicationItemAssembler.ledger(item, List.of());
        assertNull(none.lastSuccess());
        assertNull(none.lastFailure());
    }

    // ------------------------------------------------------------ hỗ trợ

    private static Instant at(int hour, int minute) {
        return Instant.parse("2026-10-01T00:00:00Z").plusSeconds(hour * 3600L + minute * 60L);
    }

    private static ReportRow report(long id, long unitId, long publicationId, int revisionNo, Long previous,
                                    ReportStatus status, Instant createdAt) {
        return new ReportRow(id, unitId, publicationId, revisionNo, previous, status, null, createdAt);
    }

    private static SheetRow sheet(long id, long reportId, long templateId, Instant createdAt) {
        return new SheetRow(id, reportId, templateId, 900L, SheetCompletion.NOT_STARTED, null, null, null, null,
                createdAt);
    }

    private static AuditRow audit(long reportId, long templateId, LedgerWriteAudit.Result result, Instant at) {
        return new AuditRow(reportId, templateId, result, 1, 0, 0,
                result == LedgerWriteAudit.Result.FAILED ? "Lỗi" : null, at, "canbo");
    }
}
