package com.dth.frw.module.asxh.ledger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerQuery;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerRow;
import com.dth.frw.module.asxh.ledger.query.LedgerCriteria;
import com.dth.frw.module.asxh.ledger.query.LedgerTotal;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Duyệt phiếu ghi số liệu đã lưu (UC-41) trên CSDL thật: lấy một phiếu chờ duyệt có sẵn trong
 * seed, gắn workbook + script mẫu cho mọi tờ biểu, duyệt, rồi đọc lại qua
 * {@link EffectiveLedgerQuery}.
 *
 * <p>{@code @Transactional}: mọi thay đổi (workbook, script, trạng thái, số liệu) quay lui khi
 * test xong. Đường lỗi (script hỏng → 409) được phủ ở {@code ServerScriptRunnerTest} để khỏi để
 * lại dòng nhật ký FAILED (ghi trong giao dịch riêng nên không quay lui).
 */
@SpringBootTest
@Transactional
class LedgerApproveTest {

    private static final String WORKBOOK = """
            {"version":"16.0","sheets":{"Biểu":{"name":"Biểu","data":{"dataTable":{
              "2":{"0":{"value":"I.1"},"1":{"value":"Trợ cấp hằng tháng"},"2":{"value":10},"3":{"value":376.46399999999994}},
              "3":{"0":{"value":"I.2"},"1":{"value":"Mai táng phí"},"2":{"value":2},"3":{"value":9000000}}
            }}}}}
            """;

    private static final String SCRIPT = """
            return defineScript({
              getInputData(ctx) {
                const rows = [];
                for (let r = 2; r <= 3; r++) {
                  rows.push({
                    indicatorCode: ctx.cell.get('Biểu', r, 0),
                    indicatorName: ctx.cell.get('Biểu', r, 1),
                    quantity: ctx.cell.get('Biểu', r, 2),
                    amount: ctx.cell.get('Biểu', r, 3),
                    orderNo: r,
                  });
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
    private EffectiveLedgerQuery ledgerQuery;

    @Test
    @DisplayName("Duyệt phiếu: chạy getInputData từng biểu và lưu số liệu, đọc lại được qua EffectiveLedgerQuery")
    void approveWritesLedger() {
        List<InputReport> submitted = entityManager
                .createQuery("select r from InputReport r where r.status = :status order by r.id", InputReport.class)
                .setParameter("status", ReportStatus.SUBMITTED)
                .setMaxResults(1)
                .getResultList();
        assumeTrue(!submitted.isEmpty(), "seed không có phiếu chờ duyệt");
        InputReport report = submitted.getFirst();

        List<InputReportSheet> sheets = entityManager
                .createQuery("select s from InputReportSheet s where s.report.id = :id", InputReportSheet.class)
                .setParameter("id", report.getId())
                .getResultList();
        assumeTrue(!sheets.isEmpty(), "phiếu chờ duyệt không có tờ biểu");
        for (InputReportSheet sheet : sheets) {
            sheet.setDataJson(WORKBOOK);
            sheet.setCompletion(SheetCompletion.COMPLETED);
            sheet.getTemplateVersion().setScriptText(SCRIPT);
        }
        entityManager.flush();

        InputReport approved = reportService.approve(report.getId());
        assertEquals(ReportStatus.APPROVED, approved.getStatus());

        LedgerCriteria criteria = LedgerCriteria.ofPeriod(report.getPeriod().getId())
                .withUnits(List.of(report.getUnit().getId()));
        List<EffectiveLedgerRow> rows = ledgerQuery.find(criteria).stream()
                .filter(row -> row.reportId().equals(report.getId()))
                .toList();
        assertEquals(sheets.size() * 2, rows.size(), "mỗi tờ biểu hai dòng");

        EffectiveLedgerRow first = rows.stream().filter(r -> "I.1".equals(r.indicatorCode())).findFirst().orElseThrow();
        assertEquals(report.getUnit().getId(), first.unitId());
        assertEquals(report.getUnit().getId(), first.submitterUnitId(), "biểu thường: đơn vị số liệu = đơn vị nộp");
        assertEquals(0, new BigDecimal("10").compareTo(first.quantity()));
        // Rác số thực nhị phân bị cắt, số thật giữ nguyên.
        assertEquals(0, new BigDecimal("376.464").compareTo(first.amount()));

        List<LedgerTotal> totals = ledgerQuery.sumByIndicator(criteria);
        assertFalse(totals.isEmpty());
        assertTrue(ledgerQuery.reportIdsWithData(criteria).contains(report.getId()));
    }
}
