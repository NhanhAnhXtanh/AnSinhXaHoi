package com.dth.frw.module.asxh.ledger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerEntryResponse;
import com.dth.frw.module.asxh.ledger.service.LedgerEntryService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.JwtService;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * {@code GET /api/ledger_entries} theo phạm vi đơn vị (UC-72): trước đây bảng số liệu đã lưu không
 * nằm dưới phạm vi dòng, cán bộ phường A lọc {@code unit.id} / {@code period.id} là đọc được số
 * liệu của phường B. Giờ tài khoản đơn vị chỉ thấy dòng có đơn vị số liệu HOẶC đơn vị nộp là đơn vị
 * mình (biểu nhập hộ: phường B nộp hộ dòng của phường A → A cũng xem được dòng đó).
 *
 * <p>Chạy trên CSDL thật, mỗi test một giao dịch rồi cuộn lại — cùng cách dựng người gọi với
 * {@code InputReportUnitScopeTest}.
 */
@SpringBootTest
@Transactional
class LedgerEntryUnitScopeTest {

    @Autowired
    private InputReportService reports;

    @Autowired
    private InputReportSheetRepository sheetRepository;

    @Autowired
    private LedgerEntryService ledgerEntries;

    @Autowired
    private EntityManager entityManager;

    private ReportPeriod period;
    private LedgerEntry entryOfA;
    private LedgerEntry entryOfB;
    private LedgerEntry entryOfAByB;
    private User officerOfA;
    private User provinceOfficer;

    @BeforeEach
    void issueAndRecord() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        int year = 2700 + ThreadLocalRandom.current().nextInt(0, 99);

        ReportUnit unitA = new ReportUnit("LA" + suffix, "UBND phường Số Liệu A", null,
                ReportUnitType.UBND_XA, ReportBlock.XA);
        ReportUnit unitB = new ReportUnit("LB" + suffix, "UBND phường Số Liệu B", null,
                ReportUnitType.UBND_XA, ReportBlock.XA);
        entityManager.persist(unitA);
        entityManager.persist(unitB);

        ReportCalendar calendar = new ReportCalendar(year, 15, List.of(PeriodKind.QUY));
        entityManager.persist(calendar);
        period = new ReportPeriod(calendar, PeriodKind.QUY, 1, "Q1-" + year, "Quý I/" + year,
                LocalDate.of(year, 1, 1), LocalDate.of(year, 3, 31), LocalDate.of(year, 4, 1),
                LocalDate.of(year, 4, 15));
        period.setStatus(PeriodStatus.OPEN);
        entityManager.persist(period);

        TemplateSet set = new TemplateSet("Bộ kiểm thử số liệu " + suffix, null);
        entityManager.persist(set);
        Template template = new Template(set, "L" + suffix, "1g", "Biểu 1g kiểm thử", TemplateKind.CHI_TIET, 1);
        entityManager.persist(template);
        TemplateVersion version = new TemplateVersion(template, 1, null);
        version.setStatus(TemplateStatus.PUBLISHED);
        version.setEffectiveFrom(LocalDate.of(year, 1, 1));
        entityManager.persist(version);

        Publication publication = new Publication(period, PublicationKind.LAN_DAU, 1, null);
        entityManager.persist(publication);
        reports.issue(publication, List.of(
                new InputReportService.IssueRequest(unitA, template, version),
                new InputReportService.IssueRequest(unitB, template, version)));

        InputReport reportOfA = reports.list(params("unit.id", unitA.getId())).getContent().getFirst();
        InputReport reportOfB = reports.list(params("unit.id", unitB.getId())).getContent().getFirst();
        InputReportSheet sheetOfA = sheetRepository.findByReportId(reportOfA.getId()).getFirst();
        InputReportSheet sheetOfB = sheetRepository.findByReportId(reportOfB.getId()).getFirst();

        entryOfA = entry(reportOfA, sheetOfA, template, version, unitA, unitA, "I.1");
        entryOfB = entry(reportOfB, sheetOfB, template, version, unitB, unitB, "I.1");
        // Nhập hộ: phiếu của B, dòng số liệu của A.
        entryOfAByB = entry(reportOfB, sheetOfB, template, version, unitA, unitB, "I.2");

        officerOfA = new User("kt.sl.a." + suffix, "kt.sl.a." + suffix + "@kiemthu.local", "x",
                "Cán bộ phường A", UserStatus.ACTIVE);
        officerOfA.setReportUnit(unitA);
        entityManager.persist(officerOfA);
        provinceOfficer = new User("kt.sl.so." + suffix, "kt.sl.so." + suffix + "@kiemthu.local", "x",
                "Cán bộ Sở", UserStatus.ACTIVE);
        entityManager.persist(provinceOfficer);
        entityManager.flush();
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Cán bộ đơn vị A chỉ thấy số liệu của đơn vị A (kể cả dòng đơn vị khác nộp hộ A)")
    void unitOfficerSeesOnlyOwnUnitLedger() {
        signInAs(officerOfA);

        assertEquals(Set.of(entryOfA.getId(), entryOfAByB.getId()), idsOf(ledgerEntries.list(
                params("period.id", period.getId())).getContent()));
        // Lọc thẳng theo đơn vị nộp B: chỉ còn dòng B nộp hộ A, không có dòng số liệu riêng của B.
        assertEquals(Set.of(entryOfAByB.getId()), idsOf(ledgerEntries.list(
                params("submitterUnit.id", entryOfB.getSubmitterUnit().getId())).getContent()));
        assertThrows(ResourceNotFoundException.class, () -> ledgerEntries.get(entryOfB.getId()),
                "dòng số liệu của đơn vị khác phải như không tồn tại");
        assertEquals(Set.of(entryOfA.getId()),
                idsOf(ledgerEntries.getMany(List.of(entryOfA.getId(), entryOfB.getId()))));
    }

    @Test
    @DisplayName("Tài khoản Sở (không gắn đơn vị) thấy số liệu của mọi đơn vị")
    void provinceOfficerSeesEverything() {
        signInAs(provinceOfficer);

        assertEquals(Set.of(entryOfA.getId(), entryOfB.getId(), entryOfAByB.getId()), idsOf(ledgerEntries.list(
                params("period.id", period.getId())).getContent()));
        assertEquals(entryOfB.getId(), ledgerEntries.get(entryOfB.getId()).id());
    }

    // ------------------------------------------------------------ hỗ trợ

    private LedgerEntry entry(InputReport report, InputReportSheet sheet, Template template, TemplateVersion version,
                              ReportUnit unit, ReportUnit submitter, String code) {
        LedgerEntry entry = new LedgerEntry(report, sheet, template, version.getId(), period, unit, submitter, code);
        entry.setIndicatorName("Chỉ tiêu " + code);
        entry.setQuantity(BigDecimal.ONE);
        entityManager.persist(entry);
        return entry;
    }

    private static Set<Long> idsOf(List<LedgerEntryResponse> rows) {
        return rows.stream().map(LedgerEntryResponse::id).collect(Collectors.toSet());
    }

    private static void signInAs(User user) {
        Jwt jwt = Jwt.withTokenValue("kiem-thu")
                .header("alg", "none")
                .subject(String.valueOf(user.getId()))
                .claim(JwtService.CLAIM_USERNAME, user.getUsername())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    private static ListParams params(String key, Object value) {
        LinkedMultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        query.add(key, String.valueOf(value));
        return new ListParams(query);
    }
}
