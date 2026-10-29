package com.dth.frw.module.asxh.ledger.query;

import java.util.Collection;
import java.util.List;

/**
 * Điều kiện đọc số liệu đã duyệt cho {@link EffectiveLedgerQuery}.
 *
 * <p>Danh sách rỗng hoặc {@code null} nghĩa là KHÔNG lọc theo vế đó — riêng {@code periodIds}
 * là bắt buộc (đọc số liệu không theo kỳ là câu hỏi không có nghĩa và quét cả bảng).
 *
 * <pre>{@code
 * // Số liệu biểu 1a của mọi đơn vị trong ba kỳ quý của năm:
 * LedgerCriteria.ofPeriods(List.of(q1, q2, q3)).withTemplates(List.of(template1a));
 * // Chỉ của các đơn vị con, lọc theo đơn vị NỘP (biểu nhập hộ):
 * LedgerCriteria.ofPeriods(periodIds).withUnits(childIds).matching(LedgerCriteria.UnitMatch.SUBMITTER_UNIT);
 * }</pre>
 *
 * @param periodIds      các kỳ cần đọc (bắt buộc, không rỗng)
 * @param unitIds        các đơn vị cần đọc; rỗng = mọi đơn vị
 * @param templateIds    các biểu cần đọc; rỗng = mọi biểu
 * @param indicatorCodes các mã chỉ tiêu cần đọc; rỗng = mọi chỉ tiêu
 * @param unitMatch      {@code unitIds} so với đơn vị nào của dòng (mặc định đơn vị SỐ LIỆU)
 */
public record LedgerCriteria(
        Collection<Long> periodIds,
        Collection<Long> unitIds,
        Collection<Long> templateIds,
        Collection<String> indicatorCodes,
        UnitMatch unitMatch) {

    /** {@code unitIds} lọc theo đơn vị nào của dòng số liệu. */
    public enum UnitMatch {
        /** Đơn vị số liệu (của ai) — mặc định, đúng cho tổng hợp. */
        DATA_UNIT,
        /** Đơn vị nộp (phiếu của ai). */
        SUBMITTER_UNIT,
        /** Một trong hai. */
        EITHER
    }

    public LedgerCriteria {
        if (periodIds == null || periodIds.isEmpty()) {
            throw new IllegalArgumentException("Cần ít nhất một kỳ để đọc số liệu đã duyệt.");
        }
        periodIds = List.copyOf(periodIds);
        unitIds = unitIds == null ? List.of() : List.copyOf(unitIds);
        templateIds = templateIds == null ? List.of() : List.copyOf(templateIds);
        indicatorCodes = indicatorCodes == null ? List.of() : List.copyOf(indicatorCodes);
        unitMatch = unitMatch == null ? UnitMatch.DATA_UNIT : unitMatch;
    }

    public static LedgerCriteria ofPeriods(Collection<Long> periodIds) {
        return new LedgerCriteria(periodIds, null, null, null, UnitMatch.DATA_UNIT);
    }

    public static LedgerCriteria ofPeriod(Long periodId) {
        return ofPeriods(List.of(periodId));
    }

    public LedgerCriteria withUnits(Collection<Long> units) {
        return new LedgerCriteria(periodIds, units, templateIds, indicatorCodes, unitMatch);
    }

    public LedgerCriteria withTemplates(Collection<Long> templates) {
        return new LedgerCriteria(periodIds, unitIds, templates, indicatorCodes, unitMatch);
    }

    public LedgerCriteria withIndicators(Collection<String> indicators) {
        return new LedgerCriteria(periodIds, unitIds, templateIds, indicators, unitMatch);
    }

    public LedgerCriteria matching(UnitMatch match) {
        return new LedgerCriteria(periodIds, unitIds, templateIds, indicatorCodes, match);
    }
}
