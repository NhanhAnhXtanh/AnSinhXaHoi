package com.dth.frw.module.asxh.inputreport.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.JwtService;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
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
 * Phạm vi dữ liệu theo đơn vị (UC-72): tài khoản cấp Đơn vị chỉ thấy và chỉ ghi được phiếu /
 * tờ biểu của đơn vị mình; tài khoản Sở (không gắn đơn vị) thấy tất cả.
 *
 * <p>Chạy trên CSDL thật như các test khác của slice, mỗi test một giao dịch rồi cuộn lại. Người
 * gọi được dựng bằng một {@link JwtAuthenticationToken} có {@code sub} = id tài khoản — đúng thứ
 * {@code CurrentUser} đọc trên request thật — nên phạm vi đi qua đủ chuỗi: bộ nhớ đệm quyền →
 * {@code ReportUnitAccountScope} → FILTER của {@code InputReportRowLevelPolicies}.
 */
@SpringBootTest
@Transactional
class InputReportUnitScopeTest {

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
    private InputReport reportOfA;
    private InputReport reportOfB;
    private InputReportSheet sheetOfA;
    private InputReportSheet sheetOfB;
    private User officerOfA;
    private User provinceOfficer;

    @BeforeEach
    void issueReportsForTwoUnits() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        int year = 2800 + ThreadLocalRandom.current().nextInt(0, 99);

        ReportUnit unitA = new ReportUnit("PA" + suffix, "UBND phường Kiểm Thử A", null,
                ReportUnitType.UBND_XA, ReportBlock.XA);
        ReportUnit unitB = new ReportUnit("PB" + suffix, "UBND phường Kiểm Thử B", null,
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

        TemplateSet set = new TemplateSet("Bộ kiểm thử phạm vi " + suffix, null);
        entityManager.persist(set);
        Template template = new Template(set, "S" + suffix, "1a", "Biểu 1a kiểm thử", TemplateKind.CHI_TIET, 1);
        entityManager.persist(template);
        TemplateVersion version = new TemplateVersion(template, 1, null);
        version.setStatus(TemplateStatus.PUBLISHED);
        version.setEffectiveFrom(LocalDate.of(year, 1, 1));
        entityManager.persist(version);

        Publication publication = new Publication(period, PublicationKind.LAN_DAU, 1, null);
        entityManager.persist(publication);

        // Phát đợt chạy không có người gọi (như việc của hệ thống) nên thấy cả hai đơn vị.
        reports.issue(publication, List.of(
                new InputReportService.IssueRequest(unitA, template, version),
                new InputReportService.IssueRequest(unitB, template, version)));

        reportOfA = reports.list(params("unit.id", unitA.getId())).getContent().getFirst();
        reportOfB = reports.list(params("unit.id", unitB.getId())).getContent().getFirst();
        sheetOfA = sheetRepository.findByReportId(reportOfA.getId()).getFirst();
        sheetOfB = sheetRepository.findByReportId(reportOfB.getId()).getFirst();

        officerOfA = new User("kt.a." + suffix, "kt.a." + suffix + "@kiemthu.local", "x",
                "Cán bộ phường A", UserStatus.ACTIVE);
        officerOfA.setReportUnit(unitA);
        entityManager.persist(officerOfA);

        provinceOfficer = new User("kt.so." + suffix, "kt.so." + suffix + "@kiemthu.local", "x",
                "Cán bộ Sở", UserStatus.ACTIVE);
        entityManager.persist(provinceOfficer);
        entityManager.flush();
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Cán bộ đơn vị A chỉ thấy phiếu và tờ biểu của đơn vị A")
    void unitOfficerSeesOnlyOwnUnit() {
        signInAs(officerOfA);

        List<InputReport> visible = reports.list(params("period.id", period.getId())).getContent();
        assertEquals(1, visible.size(), "chỉ phiếu của đơn vị A trong kỳ");
        assertEquals(reportOfA.getId(), visible.getFirst().getId());

        assertEquals(reportOfA.getId(), reports.get(reportOfA.getId()).getId());
        assertThrows(ResourceNotFoundException.class, () -> reports.get(reportOfB.getId()),
                "phiếu đơn vị khác phải như không tồn tại");
        assertThrows(ResourceNotFoundException.class, () -> sheets.get(sheetOfB.getId()));
        assertTrue(reports.getMany(List.of(reportOfA.getId(), reportOfB.getId())).stream()
                .allMatch(report -> report.getId().equals(reportOfA.getId())));

        LinkedMultiValueMap<String, String> summaryQuery = new LinkedMultiValueMap<>();
        summaryQuery.add("period.id", String.valueOf(period.getId()));
        assertEquals(1, queries.summary(summaryQuery).total(), "số đếm thẻ lọc cũng theo phạm vi");
    }

    @Test
    @DisplayName("Cán bộ đơn vị A không lưu số liệu, không nộp được phiếu của đơn vị B")
    void unitOfficerCannotWriteOtherUnit() {
        signInAs(officerOfA);

        assertThrows(ResourceNotFoundException.class,
                () -> sheets.saveData(sheetOfB.getId(), "{\"sheets\":{\"x\":1}}", null));
        assertThrows(ResourceNotFoundException.class, () -> sheets.markNoData(sheetOfB.getId()));
        assertThrows(ResourceNotFoundException.class, () -> reports.submit(reportOfB.getId()));

        SecurityContextHolder.clearContext();
        InputReportSheet untouched = sheets.get(sheetOfB.getId());
        assertNull(untouched.getDataJson(), "số liệu biểu của đơn vị B không bị ghi");

        // Còn biểu của chính mình thì lưu bình thường.
        signInAs(officerOfA);
        InputReportSheet saved = sheets.saveData(sheetOfA.getId(), "{\"sheets\":{}}", null);
        assertNotNull(saved.getDataJson());
    }

    @Test
    @DisplayName("Tài khoản Sở (không gắn đơn vị) thấy phiếu của mọi đơn vị")
    void provinceOfficerSeesEverything() {
        signInAs(provinceOfficer);

        List<InputReport> visible = reports.list(params("period.id", period.getId())).getContent();
        assertEquals(2, visible.size());
        assertEquals(reportOfB.getId(), reports.get(reportOfB.getId()).getId());
        assertEquals(sheetOfB.getId(), sheets.get(sheetOfB.getId()).getId());
    }

    // ------------------------------------------------------------ hỗ trợ

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
