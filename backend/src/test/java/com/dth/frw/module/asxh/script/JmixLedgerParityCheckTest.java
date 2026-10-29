package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.module.asxh.ledger.service.LedgerReplaceService;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Đối chiếu tay (không chạy trong bộ test thường): chạy {@code getInputData} của máy chủ bản mới trên
 * tờ biểu THẬT đã duyệt và so từng dòng với số liệu bản Jmix đã ghi lúc duyệt (ASX-65, biểu 1g nhập hộ).
 *
 * <p>Chỉ ĐỌC hai database (phiên đặt {@code READ ONLY}):
 * <ul>
 *   <li>{@code ASXH_PARITY_REACT_DB} — DB bản mới đã chuyển dữ liệu (vd {@code asxh-react-dn}): workbook
 *       tờ biểu ({@code data_json}, trùng md5 nguồn), script của phiên bản đã ghim, số liệu đã chuyển.</li>
 *   <li>{@code ASXH_PARITY_JMIX_DB} — DB bản Jmix (vd {@code report-stc-dn-27-20261017}): {@code qt_report_ledger}
 *       mà Jmix ghi khi Sở duyệt.</li>
 * </ul>
 * Tuỳ chọn: {@code ASXH_PARITY_SHEET} (tên ngắn biểu, mặc định {@code 1g}), {@code ASXH_PARITY_HOST}
 * ({@code localhost:5432}), {@code ASXH_PARITY_USER} ({@code postgres}), {@code ASXH_PARITY_PASSWORD}.
 *
 * <p>Ghi số liệu mô phỏng đúng {@code LedgerWriteService.runSheet} + {@code LedgerReplaceService.replace}:
 * bỏ dòng trống hẳn, biểu nhập hộ lấy đơn vị theo dòng khi script trả mã đơn vị, số qua
 * {@link LedgerReplaceService#exactValue}.
 */
@EnabledIfEnvironmentVariable(named = "ASXH_PARITY_REACT_DB", matches = ".+")
class JmixLedgerParityCheckTest {

    private record Line(String name, BigDecimal quantity, BigDecimal amount, Integer orderNo) {
    }

    private record SheetCase(long sheetId, String jmixSheetId, String unitCode, String unitName, String periodName,
                             String workbookJson, String scriptText, String status) {
    }

    @Test
    @DisplayName("getInputData máy chủ bản mới trên tờ biểu thật đã duyệt = số liệu bản Jmix đã ghi")
    void serverGetInputDataMatchesJmixLedger() throws Exception {
        String sheet = env("ASXH_PARITY_SHEET", "1g");
        String reactDb = System.getenv("ASXH_PARITY_REACT_DB");
        String jmixDb = env("ASXH_PARITY_JMIX_DB", "report-stc-dn-27-20261017");

        ServerScriptRunner runner = new ServerScriptRunner(30_000, 50_000_000);
        int sheets = 0;
        int lines = 0;
        int mismatches = 0;
        try (Connection react = open(reactDb); Connection jmix = open(jmixDb)) {
            for (SheetCase c : cases(react, sheet, EFFECTIVE)) {
                sheets++;
                Map<String, Line> computed = run(runner, react, c, sheet);
                Map<String, Line> jmixLedger = jmixLedger(jmix, c.jmixSheetId());
                Map<String, Line> migrated = reactLedger(react, c.sheetId());
                lines += jmixLedger.size();
                List<String> diffs = new ArrayList<>(diff("máy chủ mới ↔ Jmix", computed, jmixLedger));
                diffs.addAll(diff("số đã chuyển ↔ Jmix", migrated, jmixLedger));
                System.out.printf("[%s] tờ biểu %d (%s · %s · %s): Jmix %d dòng, máy chủ mới %d dòng, đã chuyển %d dòng,"
                                + " tổng SL %s/%s, tổng KP %s/%s%s%n",
                        sheet, c.sheetId(), c.unitName(), c.periodName(), c.status(), jmixLedger.size(), computed.size(),
                        migrated.size(), sumQ(jmixLedger), sumQ(computed), sumA(jmixLedger), sumA(computed),
                        diffs.isEmpty() ? " — KHỚP" : " — LỆCH " + diffs.size());
                diffs.forEach(d -> System.out.println("    " + d));
                mismatches += diffs.size();
            }
        } finally {
            runner.shutdown();
        }
        System.out.printf("[%s] tổng: %d tờ biểu, %d dòng Jmix, %d chỗ lệch%n", sheet, sheets, lines, mismatches);
        assertTrue(sheets > 0, "Không có tờ biểu " + sheet + " đã duyệt để đối chiếu.");
        assertEquals(0, mismatches, "Có dòng lệch — xem nhật ký ở trên.");
    }

    @Test
    @DisplayName("Tờ biểu đang chờ duyệt: máy chủ bản mới đọc được số liệu (duyệt sẽ không vấp lỗi script / trùng dòng)")
    void pendingSheetsReadable() throws Exception {
        String sheet = env("ASXH_PARITY_SHEET", "1g");
        ServerScriptRunner runner = new ServerScriptRunner(30_000, 50_000_000);
        int sheets = 0;
        try (Connection react = open(System.getenv("ASXH_PARITY_REACT_DB"))) {
            for (SheetCase c : cases(react, sheet, PENDING)) {
                sheets++;
                Map<String, Line> computed = run(runner, react, c, sheet);
                System.out.printf("[%s chờ duyệt] tờ biểu %d (%s · %s): %d dòng, tổng SL %s, tổng KP %s%n", sheet,
                        c.sheetId(), c.unitName(), c.periodName(), computed.size(), sumQ(computed), sumA(computed));
            }
        } finally {
            runner.shutdown();
        }
        System.out.printf("[%s chờ duyệt] %d tờ biểu đọc được%n", sheet, sheets);
    }

    // ------------------------------------------------------------------ chạy script

    private static Map<String, Line> run(ServerScriptRunner runner, Connection react, SheetCase c, String sheet)
            throws SQLException {
        ServerScriptRunner.GetInputDataResult result = runner.runGetInputData(c.workbookJson(),
                List.of(new ServerScriptRunner.ScriptSource("biểu " + sheet, c.scriptText())),
                new ServerScriptRunner.ReportInfo(String.valueOf(c.sheetId()), null, "APPROVED", c.unitCode(),
                        c.unitName(), sheet, c.periodName(), null));
        assertTrue(result.executedHookCount() > 0, "Mẫu không có getInputData: tờ biểu " + c.sheetId());
        boolean perRowUnit = "1g".equalsIgnoreCase(sheet) && result.rows().stream()
                .anyMatch(row -> row.organizationCode() != null && !row.organizationCode().isBlank());
        Map<String, Line> out = new TreeMap<>();
        for (ScriptRow row : result.rows()) {
            if (row.quantity() == null && row.amount() == null && (row.note() == null || row.note().isBlank())) {
                continue;
            }
            String unit = perRowUnit ? row.organizationCode().trim() : c.unitCode();
            String key = unit + " | " + row.indicatorCode().trim();
            Line previous = out.put(key, new Line(row.indicatorName() == null ? null : row.indicatorName().trim(),
                    LedgerReplaceService.exactValue(row.quantity()), LedgerReplaceService.exactValue(row.amount()),
                    row.orderNo()));
            if (previous != null) {
                throw new AssertionError("Trùng (đơn vị, chỉ tiêu) — máy chủ mới sẽ từ chối duyệt: " + key);
            }
        }
        if (perRowUnit) {
            System.out.println("    (nhập hộ: đơn vị lấy theo từng dòng)");
        }
        return out;
    }

    // ------------------------------------------------------------------ đọc DB

    private static final String EFFECTIVE = "(r.status = 'APPROVED' or (r.status = 'LOCKED' and r.approved_at is not null))";
    private static final String PENDING = "r.status = 'SUBMITTED'";

    private static List<SheetCase> cases(Connection react, String sheet, String statusFilter) throws SQLException {
        String sql = """
                select s.id, m.source_uuid::text, u.budget_code, u.name, p.name, s.data_json, v.script_text, r.status
                from asxh_input_report_sheets s
                join asxh_input_reports r on r.id = s.report_id
                join asxh_templates t on t.id = s.template_id
                join asxh_template_versions v on v.id = s.template_version_id
                join asxh_report_units u on u.id = r.unit_id
                join asxh_report_periods p on p.id = r.period_id
                join migration_id_map m on m.target_table = 'asxh_input_report_sheets' and m.target_id = s.id
                where lower(t.short_name) = lower(?)
                  and %s
                order by p.from_date, u.budget_code, s.id""".formatted(statusFilter);
        List<SheetCase> result = new ArrayList<>();
        try (PreparedStatement ps = react.prepareStatement(sql)) {
            ps.setString(1, sheet);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new SheetCase(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                            rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8)));
                }
            }
        }
        return result;
    }

    private static Map<String, Line> jmixLedger(Connection jmix, String jmixSheetId) throws SQLException {
        String sql = """
                select o.code, l.indicator_code, l.indicator_name, l.quantity, l.amount, l.order_no
                from qt_input_report_sheet s
                join qt_report_ledger l on l.report_id = s.report_id and l.sheet_code = s.sheet_code
                join qt_organization o on o.id = l.org_id
                where s.id = ?::uuid""";
        return ledger(jmix, sql, jmixSheetId);
    }

    private static Map<String, Line> reactLedger(Connection react, long sheetId) throws SQLException {
        String sql = """
                select u.budget_code, l.indicator_code, l.indicator_name, l.quantity, l.amount, l.order_no
                from asxh_ledger_entries l join asxh_report_units u on u.id = l.unit_id
                where l.sheet_id = ?""";
        return ledger(react, sql, sheetId);
    }

    private static Map<String, Line> ledger(Connection connection, String sql, Object key) throws SQLException {
        Map<String, Line> out = new TreeMap<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setObject(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.put(rs.getString(1) + " | " + rs.getString(2), new Line(rs.getString(3),
                            LedgerReplaceService.exactValue(rs.getBigDecimal(4)),
                            LedgerReplaceService.exactValue(rs.getBigDecimal(5)),
                            (Integer) rs.getObject(6)));
                }
            }
        }
        return out;
    }

    private static Connection open(String database) throws SQLException {
        String url = "jdbc:postgresql://" + env("ASXH_PARITY_HOST", "localhost:5432") + "/" + database;
        Connection connection = DriverManager.getConnection(url, env("ASXH_PARITY_USER", "postgres"),
                env("ASXH_PARITY_PASSWORD", "123456"));
        connection.setReadOnly(true);
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
        }
        return connection;
    }

    // ------------------------------------------------------------------ so sánh

    private static List<String> diff(String label, Map<String, Line> actual, Map<String, Line> expected) {
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Line> e : expected.entrySet()) {
            Line a = actual.get(e.getKey());
            Line x = e.getValue();
            if (a == null) {
                out.add(label + ": thiếu dòng " + e.getKey());
            } else if (!same(a.quantity(), x.quantity()) || !same(a.amount(), x.amount())
                    || !Objects.equals(a.name(), x.name()) || !Objects.equals(a.orderNo(), x.orderNo())) {
                out.add(label + ": " + e.getKey() + " SL " + a.quantity() + "/" + x.quantity() + ", KP " + a.amount()
                        + "/" + x.amount() + ", thứ tự " + a.orderNo() + "/" + x.orderNo()
                        + (Objects.equals(a.name(), x.name()) ? "" : ", tên \"" + a.name() + "\"/\"" + x.name() + "\""));
            }
        }
        for (String key : actual.keySet()) {
            if (!expected.containsKey(key)) {
                out.add(label + ": thừa dòng " + key + " " + actual.get(key));
            }
        }
        return out;
    }

    private static boolean same(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static String sumQ(Map<String, Line> lines) {
        return lines.values().stream().map(Line::quantity).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add).stripTrailingZeros().toPlainString();
    }

    private static String sumA(Map<String, Line> lines) {
        return lines.values().stream().map(Line::amount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add).stripTrailingZeros().toPlainString();
    }

    private static String env(String name, String fallback) {
        return Optional.ofNullable(System.getenv(name)).filter(v -> !v.isBlank()).orElse(fallback);
    }
}
