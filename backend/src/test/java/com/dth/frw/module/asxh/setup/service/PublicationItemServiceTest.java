package com.dth.frw.module.asxh.setup.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

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
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.inputreport.service.InputReportSheetService;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.Delivery;
import com.dth.frw.module.asxh.setup.api.dto.PublicationItemsResponse.Item;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chi tiết đợt (UC-30) trên CSDL thật, qua đúng các đường sinh tờ biểu: phát đợt
 * ({@code InputReportService.issue}) và trả lại phiếu ({@code returnReport}).
 *
 * <p>Kịch bản: đợt 1 phát biểu 1a cho xã A và xã B. Xã A nộp, Sở trả lại (bản 2 chép tờ 1a).
 * Đợt bổ sung phát biểu 1b: xã A đang ở phiếu bị trả lại → 1b vào chính phiếu đó; xã B còn đang
 * nhập → 1b vào phiếu đang nhập của B.
 *
 * <p>Mỗi test một giao dịch rồi cuộn lại, năm xa và mã ngẫu nhiên như {@code InputReportStateMachineTest}.
 * Xác nhận Kho bạc tắt để nộp được phiếu chỉ có biểu "Không phát sinh".
 */
@SpringBootTest(properties = "asxh.attachments.treasury-required=false")
@Transactional
class PublicationItemServiceTest {

    @Autowired
    private PublicationItemService service;

    @Autowired
    private InputReportService reports;

    @Autowired
    private InputReportSheetService sheets;

    @Autowired
    private InputReportSheetRepository sheetRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    @DisplayName("Đợt bổ sung có dòng riêng cho biểu thêm vào phiếu đang nhập; bản sao khi trả lại ở lại đợt 1")
    void supplementalRowsAndReturnedCopies() throws InterruptedException {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        int year = 2900 + ThreadLocalRandom.current().nextInt(0, 99);

        ReportUnit xaA = new ReportUnit("PA" + suffix, "UBND xã An Kiểm Thử", null, ReportUnitType.UBND_XA,
                ReportBlock.XA);
        ReportUnit xaB = new ReportUnit("PB" + suffix, "UBND xã Bình Kiểm Thử", null, ReportUnitType.UBND_XA,
                ReportBlock.XA);
        entityManager.persist(xaA);
        entityManager.persist(xaB);

        ReportCalendar calendar = new ReportCalendar(year, 15, List.of(PeriodKind.QUY));
        entityManager.persist(calendar);
        ReportPeriod period = new ReportPeriod(calendar, PeriodKind.QUY, 1, "Q1-" + year, "Quý I/" + year,
                LocalDate.of(year, 1, 1), LocalDate.of(year, 3, 31), LocalDate.of(year, 4, 1),
                LocalDate.of(year, 4, 15));
        period.setStatus(PeriodStatus.OPEN);
        entityManager.persist(period);

        TemplateSet set = new TemplateSet("Bộ kiểm thử " + suffix, null);
        entityManager.persist(set);
        Template bieu1a = new Template(set, "A" + suffix, "1a", "Biểu 1a kiểm thử", TemplateKind.CHI_TIET, 1);
        Template bieu1b = new Template(set, "B" + suffix, "1b", "Biểu 1b kiểm thử", TemplateKind.CHI_TIET, 2);
        entityManager.persist(bieu1a);
        entityManager.persist(bieu1b);
        TemplateVersion v1a = publishedVersion(bieu1a, year);
        TemplateVersion v1b = publishedVersion(bieu1b, year);

        // Đợt 1: 1a cho A và B.
        Publication first = new Publication(period, PublicationKind.LAN_DAU, 1, null);
        entityManager.persist(first);
        entityManager.flush();
        reports.issue(first, List.of(
                new InputReportService.IssueRequest(xaA, bieu1a, v1a),
                new InputReportService.IssueRequest(xaB, bieu1a, v1a)));
        InputReport reportA = reportOf(xaA, period);

        // A nộp rồi bị trả lại: bản 2 chép tờ 1a với thời điểm tạo mới.
        tick();
        for (InputReportSheet sheet : sheetRepository.findByReportId(reportA.getId())) {
            sheets.markNoData(sheet.getId());
        }
        reports.submit(reportA.getId());
        InputReport returned = reports.returnReport(reportA.getId(), "Thiếu số liệu");
        entityManager.flush();

        // Đợt bổ sung: 1b cho A (vào phiếu bị trả lại) và B (vào phiếu đang nhập).
        tick();
        Publication second = new Publication(period, PublicationKind.BO_SUNG, 2, null);
        entityManager.persist(second);
        entityManager.flush();
        reports.issue(second, List.of(
                new InputReportService.IssueRequest(xaA, bieu1a, v1a),
                new InputReportService.IssueRequest(xaA, bieu1b, v1b),
                new InputReportService.IssueRequest(xaB, bieu1a, v1a),
                new InputReportService.IssueRequest(xaB, bieu1b, v1b)));
        entityManager.flush();
        entityManager.clear();

        // Đợt 1: đúng hai dòng 1a; dòng của A trỏ về bản 2 (bị trả lại), biểu vẫn "không phát sinh".
        List<Item> firstItems = service.items(first.getId(), false).items();
        assertEquals(2, firstItems.size());
        Item a1a = find(firstItems, xaA, bieu1a);
        assertEquals(Delivery.NEW_REPORT, a1a.delivery());
        assertEquals(returned.getId(), a1a.report().id());
        assertEquals(reportA.getId(), a1a.report().firstId());
        assertEquals(2, a1a.report().revisionNo());
        assertEquals(ReportStatus.RETURNED, a1a.report().status());
        assertEquals(SheetCompletion.NO_DATA, a1a.sheet().completion());
        assertEquals(1, a1a.templateVersion().versionNo());
        assertEquals("UBND xã An Kiểm Thử", a1a.unit().name());
        assertEquals(ReportBlock.XA, a1a.unit().block());
        assertFalse(a1a.derived());
        assertNull(a1a.ledger(), "không hỏi quyền số liệu thì không trả lần ghi");
        assertEquals(Delivery.NEW_REPORT, find(firstItems, xaB, bieu1a).delivery());

        // Đợt bổ sung: hai dòng 1b, cả hai thêm vào phiếu sẵn có của đợt 1; không có dòng 1a nào
        // (kể cả tờ 1a sao chép khi trả lại, dù được tạo sau đợt 1).
        PublicationItemsResponse secondResponse = service.items(second.getId(), true);
        List<Item> secondItems = secondResponse.items();
        assertEquals(2, secondItems.size());
        Item a1b = find(secondItems, xaA, bieu1b);
        assertEquals(Delivery.ADDED_TO_OPEN_REPORT, a1b.delivery());
        assertEquals(1, a1b.reportPublicationNo());
        assertEquals(returned.getId(), a1b.report().id());
        assertEquals(SheetCompletion.NOT_STARTED, a1b.sheet().completion());
        assertNotNull(a1b.ledger(), "có quyền số liệu thì luôn có khối ghi số liệu");
        assertNull(a1b.ledger().lastSuccess());
        Item b1b = find(secondItems, xaB, bieu1b);
        assertEquals(Delivery.ADDED_TO_OPEN_REPORT, b1b.delivery());
        assertEquals(ReportStatus.DRAFT, b1b.report().status());
    }

    // ------------------------------------------------------------ hỗ trợ

    /** Tách mốc thời gian giữa các bước (đồng hồ máy có thể thô). */
    private static void tick() throws InterruptedException {
        Thread.sleep(5);
    }

    private InputReport reportOf(ReportUnit unit, ReportPeriod period) {
        return entityManager.createQuery(
                        "select r from InputReport r where r.unit.id = :unitId and r.period.id = :periodId "
                                + "order by r.revisionNo desc", InputReport.class)
                .setParameter("unitId", unit.getId())
                .setParameter("periodId", period.getId())
                .setMaxResults(1)
                .getSingleResult();
    }

    private static Item find(List<Item> items, ReportUnit unit, Template template) {
        return items.stream()
                .filter(i -> i.unit().id().equals(unit.getId()) && i.template().id().equals(template.getId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("thiếu dòng " + unit.getName() + " × " + template.getShortName()));
    }

    private TemplateVersion publishedVersion(Template template, int year) {
        TemplateVersion version = new TemplateVersion(template, 1, null);
        version.setStatus(TemplateStatus.PUBLISHED);
        version.setEffectiveFrom(LocalDate.of(year, 1, 1));
        entityManager.persist(version);
        return version;
    }
}
