package com.dth.frw.module.asxh.ledger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.ledger.service.InputReportLedgerService;
import com.dth.frw.module.asxh.ledger.service.LedgerWriteService.DataUnit;
import com.dth.frw.module.asxh.ledger.service.LedgerWriteService.DataUnitsResult;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Biểu nhập hộ 1g (UC-46) trên CSDL thật: một phiếu mang số liệu của NHIỀU đơn vị, mỗi dòng biểu
 * chọn một đơn vị (ô lưu mã quan hệ ngân sách).
 *
 * <p>Lấy một phiếu chờ duyệt có sẵn trong seed, đổi tên ngắn mẫu của tờ biểu đầu thành "1g", gắn
 * workbook + script nhập hộ; các tờ biểu khác khai "không phát sinh". {@code @Transactional}: mọi
 * thay đổi quay lui khi test xong. Không thử đường duyệt thất bại vì nhật ký lỗi ghi ở giao dịch
 * riêng nên sẽ để lại dòng.
 */
@SpringBootTest
@Transactional
class LedgerOnBehalfApproveTest {

    /** Cột A = mã đơn vị (như ô chọn đơn vị lưu), B = số đối tượng, C = kinh phí. */
    private static final String SCRIPT = """
            return defineScript({
              getInputData(ctx) {
                const rows = [];
                for (let r = 2; r < 20; r++) {
                  const code = ctx.cell.get('1g', r, 0);
                  if (code === null || code === undefined || String(code).trim() === '') break;
                  rows.push({ organizationCode: String(code), organizationName: '',
                    indicatorCode: '1G.HOC_BONG.DOI_TUONG', indicatorName: 'Đối tượng học bổng',
                    quantity: ctx.cell.get('1g', r, 1), amount: null, orderNo: r });
                  rows.push({ organizationCode: String(code), organizationName: '',
                    indicatorCode: '1G.HOC_BONG.KINH_PHI', indicatorName: 'Kinh phí học bổng',
                    quantity: null, amount: ctx.cell.get('1g', r, 2), orderNo: r });
                }
                return rows;
              },
            });
            """;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private InputReportService reportService;

    @Autowired
    private InputReportLedgerService ledgerService;

    @Test
    @DisplayName("Nhập hộ 1g: trước duyệt báo đúng đơn vị theo dòng; duyệt ghi số liệu cho từng đơn vị, đơn vị nộp là đơn vị của phiếu")
    void onBehalfApproveWritesPerRowUnits() {
        Fixture f = prepare();
        String workbook = workbook(f.unitA.getBudgetCode(), f.unitB.getBudgetCode());
        f.target.setDataJson(workbook);
        entityManager.flush();

        // Trước duyệt: đọc từ số trên biểu, theo thứ tự dòng.
        DataUnitsResult before = ledgerService.dataUnits(f.report.getId());
        assertFalse(before.recorded());
        assertNull(before.errorMessage());
        assertEquals(1, before.sheets().size(), "chỉ biểu 1g là biểu nhập hộ");
        assertEquals(f.target.getId(), before.sheets().getFirst().sheetId());
        assertEquals(List.of(f.unitA.getId(), f.unitB.getId()),
                before.sheets().getFirst().units().stream().map(DataUnit::id).toList());
        assertTrue(before.sheets().getFirst().units().stream().allMatch(DataUnit::known));

        InputReport approved = reportService.approve(f.report.getId());
        assertEquals(ReportStatus.APPROVED, approved.getStatus());

        List<LedgerEntry> entries = entityManager
                .createQuery("select l from LedgerEntry l where l.sheet.id = :id", LedgerEntry.class)
                .setParameter("id", f.target.getId())
                .getResultList();
        assertEquals(4, entries.size(), "hai đơn vị × hai chỉ tiêu");
        Set<Long> dataUnits = entries.stream().map(e -> e.getUnit().getId()).collect(Collectors.toSet());
        assertEquals(Set.of(f.unitA.getId(), f.unitB.getId()), dataUnits, "đơn vị số liệu = đơn vị của dòng");
        assertTrue(entries.stream().allMatch(e -> e.getSubmitterUnit().getId().equals(f.report.getUnit().getId())),
                "đơn vị nộp = đơn vị đứng tên phiếu");
        LedgerEntry amountA = entries.stream()
                .filter(e -> e.getUnit().getId().equals(f.unitA.getId()))
                .filter(e -> "1G.HOC_BONG.KINH_PHI".equals(e.getIndicatorCode()))
                .findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("300").compareTo(amountA.getAmount()));

        // Sau duyệt: đọc từ số liệu đã lưu.
        DataUnitsResult after = ledgerService.dataUnits(f.report.getId());
        assertTrue(after.recorded());
        assertEquals(List.of(f.unitA.getId(), f.unitB.getId()),
                after.sheets().getFirst().units().stream().map(DataUnit::id).toList());
    }

    @Test
    @DisplayName("Nhập hộ 1g: mã đơn vị không có trong danh mục được báo trước khi duyệt")
    void unknownUnitCodeIsFlaggedBeforeApproval() {
        Fixture f = prepare();
        f.target.setDataJson(workbook(f.unitA.getBudgetCode(), "KHONG-CO-MA-NAY"));
        entityManager.flush();

        DataUnitsResult result = ledgerService.dataUnits(f.report.getId());
        List<DataUnit> units = result.sheets().getFirst().units();
        assertEquals(2, units.size());
        assertTrue(units.get(0).known());
        assertFalse(units.get(1).known());
        assertEquals("KHONG-CO-MA-NAY", units.get(1).budgetCode());
        assertNull(units.get(1).id());
    }

    @Test
    @DisplayName("Biểu 1g không trả mã đơn vị theo dòng thì không phải nhập hộ (BR-46.1)")
    void sheetWithoutUnitCodesIsNotOnBehalf() {
        Fixture f = prepare();
        f.target.setDataJson(workbook("", ""));
        entityManager.flush();

        DataUnitsResult result = ledgerService.dataUnits(f.report.getId());
        assertTrue(result.sheets().isEmpty());
        assertNull(result.errorMessage());
    }

    // ------------------------------------------------------------------ dựng dữ liệu

    private record Fixture(InputReport report, InputReportSheet target, ReportUnit unitA, ReportUnit unitB) {
    }

    private Fixture prepare() {
        List<InputReport> submitted = entityManager
                .createQuery("select r from InputReport r where r.status = :status order by r.id", InputReport.class)
                .setParameter("status", ReportStatus.SUBMITTED)
                .setMaxResults(1)
                .getResultList();
        assumeTrue(!submitted.isEmpty(), "seed không có phiếu chờ duyệt");
        InputReport report = submitted.getFirst();

        List<InputReportSheet> sheets = entityManager
                .createQuery("select s from InputReportSheet s where s.report.id = :id order by s.id",
                        InputReportSheet.class)
                .setParameter("id", report.getId())
                .getResultList();
        assumeTrue(!sheets.isEmpty(), "phiếu chờ duyệt không có tờ biểu");

        List<ReportUnit> others = entityManager
                .createQuery("select u from ReportUnit u where u.id <> :self and u.budgetCode is not null order by u.id",
                        ReportUnit.class)
                .setParameter("self", report.getUnit().getId())
                .setMaxResults(2)
                .getResultList();
        assumeTrue(others.size() == 2, "seed cần ít nhất hai đơn vị khác đơn vị của phiếu");

        InputReportSheet target = sheets.getFirst();
        target.getTemplate().setShortName("1g");
        target.setCompletion(SheetCompletion.COMPLETED);
        target.getTemplateVersion().setScriptText(SCRIPT);
        for (InputReportSheet other : sheets.subList(1, sheets.size())) {
            other.setCompletion(SheetCompletion.NO_DATA);
        }
        entityManager.flush();
        return new Fixture(report, target, others.get(0), others.get(1));
    }

    /** Hai dòng nhập hộ ở dòng 3–4 (0-based 2–3); mã rỗng = dòng chưa chọn đơn vị. */
    private static String workbook(String codeA, String codeB) {
        return """
                {"version":"16.0","sheets":{"1g":{"name":"1g","data":{"dataTable":{
                  "2":{"0":{"value":"%s"},"1":{"value":20},"2":{"value":300}},
                  "3":{"0":{"value":"%s"},"1":{"value":15},"2":{"value":250}}
                }}}}}
                """.formatted(codeA, codeB);
    }
}
