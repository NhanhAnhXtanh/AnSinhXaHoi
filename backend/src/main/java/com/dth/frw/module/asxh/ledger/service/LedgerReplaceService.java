package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.ledger.repo.LedgerEntryRepository;
import com.dth.frw.module.asxh.script.ScriptRow;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.shared.web.ListParams;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Thay toàn bộ số liệu đã lưu của MỘT tờ biểu bằng các dòng mới (port
 * {@code ReportLedgerService.replace} của bản Jmix — giữ nguyên các luật kiểm).
 *
 * <p>Ném {@link IllegalArgumentException} với câu tiếng Việt nêu đúng dòng / chỉ tiêu sai; người
 * gọi bọc lại thành lỗi duyệt.
 */
@Service
public class LedgerReplaceService {

    /** Kết quả một lần thay: số dòng thêm / sửa / xoá. */
    public record UpsertResult(int added, int updated, int removed) {
    }

    private static final String SEP = "\u001e";
    /** Chặn số vô lý (công thức chạy lố, gõ nhầm 1E+25) trước khi ghi. */
    private static final int MAX_INTEGER_DIGITS = 20;
    private static final int INDICATOR_CODE_MAX_LENGTH = 100;
    private static final int INDICATOR_NAME_MAX_LENGTH = 4000;
    private static final int NOTE_MAX_LENGTH = 4000;

    private final LedgerEntryRepository repository;
    private final ReportUnitService unitService;

    public LedgerReplaceService(LedgerEntryRepository repository, ReportUnitService unitService) {
        this.repository = repository;
        this.unitService = unitService;
    }

    /**
     * Ghi số liệu cho một tờ biểu (thay toàn bộ dòng của tờ biểu đó).
     *
     * @param perRowUnit biểu nhập hộ (1g): đơn vị số liệu lấy theo TỪNG DÒNG
     *                   ({@link ScriptRow#organizationCode()} = mã quan hệ ngân sách); biểu thường
     *                   ({@code false}): mọi dòng thuộc đơn vị của phiếu, mã đơn vị trong workbook
     *                   (kể cả mã cứng của file Excel gốc) bị bỏ qua.
     */
    @Transactional
    public UpsertResult replace(InputReport report, InputReportSheet sheet, List<ScriptRow> rows,
                                boolean perRowUnit, LedgerSource source) {
        List<ScriptRow> safeRows = rows == null ? List.of() : rows;
        ReportUnit reportUnit = report.getUnit();
        if (reportUnit == null) {
            throw new IllegalArgumentException("Phiếu không có đơn vị.");
        }

        Map<String, LedgerEntry> existingByKey = new HashMap<>();
        for (LedgerEntry line : repository.findBySheetId(sheet.getId())) {
            existingByKey.put(key(line.getUnit().getId(), line.getIndicatorCode()), line);
        }
        Map<String, ReportUnit> unitByCode = perRowUnit ? loadUnitsByCode(safeRows) : Map.of();
        Long versionId = sheet.getTemplateVersionId();

        Set<String> incomingKeys = new HashSet<>();
        int added = 0;
        int updated = 0;
        int rowNo = 0;
        for (ScriptRow row : safeRows) {
            rowNo++;
            // Dòng trống hẳn bị bỏ — ghi chú đứng một mình vẫn là dữ liệu của dòng chỉ tiêu.
            if (row.quantity() == null && row.amount() == null && isBlank(row.note())) {
                continue;
            }
            // Có số liệu mà thiếu mã / tên chỉ tiêu: DỪNG và báo, không bỏ qua im lặng — mất dòng
            // âm thầm nguy hiểm hơn nhiều so với không duyệt được.
            if (isBlank(row.indicatorCode())) {
                throw new IllegalArgumentException("Dòng " + rowNo + " có số liệu nhưng thiếu mã chỉ tiêu.");
            }
            String indicatorCode = row.indicatorCode().trim();
            if (isBlank(row.indicatorName())) {
                throw new IllegalArgumentException("Dòng " + rowNo + " (chỉ tiêu " + indicatorCode
                        + ") có số liệu nhưng thiếu tên chỉ tiêu.");
            }
            String indicatorName = row.indicatorName().trim();
            if (indicatorCode.length() > INDICATOR_CODE_MAX_LENGTH) {
                throw new IllegalArgumentException("Dòng " + rowNo + ": mã chỉ tiêu dài quá "
                        + INDICATOR_CODE_MAX_LENGTH + " ký tự.");
            }
            if (indicatorName.length() > INDICATOR_NAME_MAX_LENGTH) {
                throw new IllegalArgumentException("Dòng " + rowNo + " (chỉ tiêu " + indicatorCode
                        + "): tên chỉ tiêu dài quá " + INDICATOR_NAME_MAX_LENGTH + " ký tự.");
            }
            String note = row.note() == null ? null : row.note();
            if (note != null && note.length() > NOTE_MAX_LENGTH) {
                throw new IllegalArgumentException("Dòng " + rowNo + " (chỉ tiêu " + indicatorCode
                        + "): ghi chú dài quá " + NOTE_MAX_LENGTH + " ký tự.");
            }
            // Số âm đi thẳng vào tổng hợp sẽ TRỪ khỏi tổng toàn tỉnh — chặn ở cửa.
            requireNonNegative(rowNo, indicatorCode, "Số đối tượng", row.quantity());
            requireNonNegative(rowNo, indicatorCode, "Kinh phí", row.amount());
            requireStorable(rowNo, indicatorCode, "số đối tượng", row.quantity());
            requireStorable(rowNo, indicatorCode, "kinh phí", row.amount());

            ReportUnit lineUnit = resolveLineUnit(perRowUnit, reportUnit, unitByCode, row, indicatorCode);
            String key = key(lineUnit.getId(), indicatorCode);
            // Hai dòng cùng (đơn vị, chỉ tiêu) trong CÙNG lần ghi sẽ vấp ràng buộc duy nhất lúc lưu —
            // báo bằng chữ trước khi tới đó.
            if (!incomingKeys.add(key)) {
                throw new IllegalArgumentException("Chỉ tiêu \"" + indicatorCode + "\" của đơn vị "
                        + lineUnit.getName() + " xuất hiện nhiều lần (dòng " + rowNo
                        + ") — mỗi chỉ tiêu chỉ được một dòng.");
            }

            BigDecimal quantity = exactValue(row.quantity());
            BigDecimal amount = exactValue(row.amount());
            LedgerEntry line = existingByKey.get(key);
            if (line == null) {
                line = new LedgerEntry(report, sheet, sheet.getTemplate(), versionId,
                        report.getPeriod(), lineUnit, reportUnit, indicatorCode);
                added++;
            } else if (!Objects.equals(line.getIndicatorName(), indicatorName)
                    || !sameNumber(line.getQuantity(), quantity)
                    || !sameNumber(line.getAmount(), amount)
                    || !Objects.equals(line.getNote(), note)
                    || !Objects.equals(line.getOrderNo(), row.orderNo())) {
                updated++;
            }
            line.setTemplateVersionId(versionId);
            line.setIndicatorName(indicatorName);
            line.setQuantity(quantity);
            line.setAmount(amount);
            line.setNote(note);
            line.setOrderNo(row.orderNo());
            line.setSource(source);
            repository.persist(line);
        }

        int removed = 0;
        for (Map.Entry<String, LedgerEntry> entry : existingByKey.entrySet()) {
            if (!incomingKeys.contains(entry.getKey())) {
                repository.remove(entry.getValue());
                removed++;
            }
        }
        repository.flush();
        return new UpsertResult(added, updated, removed);
    }

    /**
     * Số ghi vào: GIỮ NGUYÊN giá trị, chỉ cắt phần rác của số thực nhị phân (496 × 0,16 ra
     * 376.46399999999994 thay vì 376.464). Làm tròn về 15 chữ số CÓ NGHĨA cắt đúng phần rác mà
     * không đụng số thật; bỏ số 0 thừa nhưng không để 500 thành 5E+2.
     */
    public static BigDecimal exactValue(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal rounded = value.round(new MathContext(15, RoundingMode.HALF_UP)).stripTrailingZeros();
        return rounded.setScale(Math.max(rounded.scale(), 0), RoundingMode.UNNECESSARY);
    }

    private Map<String, ReportUnit> loadUnitsByCode(List<ScriptRow> rows) {
        Set<String> codes = new HashSet<>();
        for (ScriptRow row : rows) {
            if (!isBlank(row.organizationCode())) {
                codes.add(row.organizationCode().trim());
            }
        }
        Map<String, ReportUnit> byCode = new HashMap<>();
        for (String code : codes) {
            // Qua service của slice đơn vị (không đọc thẳng bảng của slice khác); mã quan hệ ngân
            // sách là duy nhất nên mỗi mã nhiều nhất một đơn vị.
            LinkedMultiValueMap<String, String> query = new LinkedMultiValueMap<>();
            query.add("budgetCode", code);
            query.add("_start", "0");
            query.add("_end", "1");
            unitService.list(new ListParams(query)).getContent().stream()
                    .findFirst()
                    .ifPresent(unit -> byCode.put(code, unit));
        }
        return byCode;
    }

    private static ReportUnit resolveLineUnit(boolean perRowUnit, ReportUnit reportUnit,
                                              Map<String, ReportUnit> unitByCode, ScriptRow row,
                                              String indicatorCode) {
        if (!perRowUnit) {
            return reportUnit;
        }
        String code = row.organizationCode();
        if (isBlank(code)) {
            throw new IllegalArgumentException("Biểu nhập hộ: dòng chỉ tiêu \"" + indicatorCode
                    + "\" chưa chọn đơn vị.");
        }
        ReportUnit unit = unitByCode.get(code.trim());
        if (unit == null) {
            throw new IllegalArgumentException("Biểu nhập hộ: mã đơn vị \"" + code.trim()
                    + "\" không có trong danh mục đơn vị.");
        }
        return unit;
    }

    private static void requireNonNegative(int rowNo, String indicatorCode, String label, BigDecimal value) {
        if (value != null && value.signum() < 0) {
            throw new IllegalArgumentException("Dòng " + rowNo + " (chỉ tiêu " + indicatorCode + "): "
                    + label + " không được âm (" + value.toPlainString() + ").");
        }
    }

    private static void requireStorable(int rowNo, String indicatorCode, String label, BigDecimal value) {
        if (value != null && value.precision() - value.scale() > MAX_INTEGER_DIGITS) {
            throw new IllegalArgumentException("Dòng " + rowNo + " (chỉ tiêu " + indicatorCode + "): giá trị "
                    + label + " quá lớn (tối đa " + MAX_INTEGER_DIGITS + " chữ số phần nguyên).");
        }
    }

    /** So số theo giá trị (1.50 = 1.5) — {@code equals} của BigDecimal so cả số lẻ. */
    private static boolean sameNumber(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return a == b;
        }
        return a.compareTo(b) == 0;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String key(Long unitId, String indicatorCode) {
        return unitId + SEP + indicatorCode;
    }
}
