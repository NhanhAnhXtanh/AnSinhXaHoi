package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerQuery;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerRow;
import com.dth.frw.module.asxh.ledger.query.LedgerCriteria;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.summary.query.PeriodCell;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.query.YearRollupRow;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tổng hợp số liệu ĐÃ DUYỆT (UC-50, UC-51, UC-52) — port {@code SummaryAggregationService} +
 * {@code PeriodResolutionService} + {@code SummaryOrganizationScopeService} của bản Jmix.
 *
 * <p>Đọc số liệu chỉ qua {@link EffectiveLedgerQuery} (phiếu đã duyệt, hoặc khoá sau khi duyệt —
 * BR-50.1). Phép gộp nằm ở {@link SummaryAggregator} (hàm thuần).
 *
 * <p><b>Kỳ lá</b> (BR-50.2): kỳ tháng là chính nó; kỳ tổng (quý, 6 tháng, năm) = chính kỳ đó
 * (phiếu nhập thẳng ở quý) ∪ mọi kỳ nằm gọn trong khoảng của nó. An toàn cộng đôi nhờ chốt chặn
 * trùng kỳ khi duyệt ({@code LedgerWriteService.assertNoOverlappingApproved}).
 */
@Service
@Transactional(readOnly = true)
public class SummaryAggregationService {

    private final EffectiveLedgerQuery ledgerQuery;
    private final SummaryQueries queries;
    private final MeasureKindService measureKinds;
    private final ReportPeriodService periodService;

    public SummaryAggregationService(EffectiveLedgerQuery ledgerQuery,
                                     SummaryQueries queries,
                                     MeasureKindService measureKinds,
                                     ReportPeriodService periodService) {
        this.ledgerQuery = ledgerQuery;
        this.queries = queries;
        this.measureKinds = measureKinds;
        this.periodService = periodService;
    }

    // ------------------------------------------------------------------ kỳ

    /** Kỳ lá của một kỳ (xem javadoc lớp). Kỳ không tồn tại → 404. */
    public List<Long> resolveLeafPeriodIds(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        if (period.getKind() == PeriodKind.THANG) {
            return List.of(period.getId());
        }
        if (period.getFromDate() == null || period.getToDate() == null) {
            throw new IllegalArgumentException("Kỳ " + period.getName()
                    + " chưa khai khoảng thời gian (từ ngày / đến ngày) nên không xác định được gồm những kỳ nào.");
        }
        Set<Long> leaves = new LinkedHashSet<>();
        leaves.add(period.getId());
        leaves.addAll(queries.periodIdsInRange(period.getFromDate(), period.getToDate()));
        return List.copyOf(leaves);
    }

    /** Mọi kỳ (mọi loại, mỗi kỳ là một lá) nằm gọn trong {@code [from, to]}. */
    public List<Long> resolvePeriodIdsInRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("Khoảng thời gian cần đủ ngày bắt đầu và ngày kết thúc.");
        }
        return queries.periodIdsInRange(from, to);
    }

    /**
     * Tập kỳ lá của yêu cầu: cặp {@code from}/{@code to} (ưu tiên khi đủ) hoặc một kỳ.
     *
     * @throws IllegalArgumentException thiếu cả hai
     */
    public List<Long> resolvePeriodIds(Long periodId, LocalDate from, LocalDate to) {
        if (from != null && to != null) {
            return resolvePeriodIdsInRange(from, to);
        }
        if (periodId == null) {
            throw new IllegalArgumentException("Cần chọn kỳ báo cáo hoặc khoảng thời gian để tổng hợp.");
        }
        return resolveLeafPeriodIds(periodId);
    }

    // ------------------------------------------------------------------ phạm vi đơn vị

    /** {@code null} = mọi đơn vị; tập (có thể rỗng) cho phạm vi cụ thể. Xem {@link UnitScope}. */
    public Set<Long> resolveScope(ScopeKind kind, Long organizationId, String orgType, String block) {
        if (kind == ScopeKind.ALL || (kind == null && organizationId == null)) {
            return null;
        }
        return UnitScope.resolve(kind, organizationId, orgType, block, queries.units());
    }

    /**
     * Biểu nguồn theo mã nội bộ (tham số {@code sourceSheetCode} của script cũ). Rỗng = mọi biểu
     * ({@code Optional.empty()} trong {@code Optional}); mã lạ = không biểu nào ({@code null}).
     */
    public Optional<Long> resolveTemplateCode(String sourceSheetCode) {
        if (sourceSheetCode == null || sourceSheetCode.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(queries.templateByCode(sourceSheetCode).map(Template::getId).orElse(-1L));
    }

    // ------------------------------------------------------------------ gộp

    /**
     * Số liệu theo (đơn vị, chỉ tiêu), đã gộp qua các kỳ theo bản chất chỉ tiêu.
     *
     * @param unitIds    {@code null} = mọi đơn vị; rỗng = không có số
     * @param templateId {@code null} = mọi biểu
     * @param reportIds  {@code null} = mọi phiếu còn hiệu lực; rỗng = không có số. Dùng khi lưu số liệu
     *                   Sở: chỉ tính tập phiếu đã đóng băng lúc lưu
     */
    public List<SummaryRow> aggregateRows(Collection<Long> periodIds, Set<Long> unitIds, Long templateId,
                                          Collection<Long> reportIds) {
        if (periodIds == null || periodIds.isEmpty()
                || (unitIds != null && unitIds.isEmpty())
                || (reportIds != null && reportIds.isEmpty())
                || (templateId != null && templateId < 0)) {
            return List.of();
        }
        LedgerCriteria criteria = LedgerCriteria.ofPeriods(periodIds);
        if (unitIds != null) {
            criteria = criteria.withUnits(unitIds);
        }
        if (templateId != null) {
            criteria = criteria.withTemplates(List.of(templateId));
        }
        Set<Long> reports = reportIds == null ? null : new HashSet<>(reportIds);
        List<EffectiveLedgerRow> rows = new ArrayList<>(ledgerQuery.find(criteria));
        if (reports != null) {
            rows.removeIf(row -> !reports.contains(row.reportId()));
        }
        // Giữ thứ tự VỊ TRÍ người nhập: thứ tự dòng trước, rồi mã đơn vị (dòng cũ thiếu thứ tự xếp cuối).
        rows.sort(Comparator
                .comparing((EffectiveLedgerRow row) -> row.orderNo() == null ? Integer.MAX_VALUE : row.orderNo())
                .thenComparing(row -> row.unitBudgetCode() == null ? "" : row.unitBudgetCode()));
        Map<Long, LocalDate> starts = queries.periodStarts(rows.stream()
                .map(EffectiveLedgerRow::periodId).collect(Collectors.toSet()));
        List<PeriodCell> cells = new ArrayList<>(rows.size());
        for (EffectiveLedgerRow row : rows) {
            cells.add(new PeriodCell(row.periodId(), starts.get(row.periodId()), row.unitBudgetCode(), row.unitName(),
                    row.unitId(), row.indicatorCode(), row.indicatorName(), row.quantity(), row.amount(),
                    row.orderNo()));
        }
        return aggregateCells(cells, unitKey -> false);
    }

    /** Một dòng mỗi chỉ tiêu, đã cộng qua đơn vị (bảng tổng thường). */
    public List<SummaryRow> aggregateForSheet(Collection<Long> periodIds, Set<Long> unitIds, Long templateId,
                                              Collection<Long> reportIds) {
        return mergeByIndicator(aggregateRows(periodIds, unitIds, templateId, reportIds));
    }

    /** Dữ liệu của {@code /summary/data}: theo đơn vị ({@code groupByOrg}) hoặc một dòng mỗi chỉ tiêu. */
    public List<SummaryRow> data(Collection<Long> periodIds, Set<Long> unitIds, Long templateId, boolean groupByOrg) {
        return groupByOrg
                ? aggregateRows(periodIds, unitIds, templateId, null)
                : aggregateForSheet(periodIds, unitIds, templateId, null);
    }

    /**
     * Tổng hợp theo NĂM DƯƠNG LỊCH (UC-52): nửa đầu T1–T6 và nửa cuối T7–T12, mỗi nửa đã gộp qua đơn
     * vị và qua kỳ. Cột "Cả năm" là công thức của mẫu.
     */
    public List<YearRollupRow> yearRollup(int year, Set<Long> unitIds, Long templateId) {
        List<Long> first = queries.periodIdsInRange(LocalDate.of(year, 1, 1), LocalDate.of(year, 6, 30));
        List<Long> second = queries.periodIdsInRange(LocalDate.of(year, 7, 1), LocalDate.of(year, 12, 31));
        return SummaryAggregator.rollup(
                aggregateForSheet(first, unitIds, templateId, null),
                aggregateForSheet(second, unitIds, templateId, null));
    }

    /** {@link SummaryAggregator#aggregateCells} với bản chất chỉ tiêu đọc từ CSDL. */
    public List<SummaryRow> aggregateCells(List<PeriodCell> cells, Predicate<String> deltaUnit) {
        Map<String, MeasureKind> kinds = measureKinds.kindsOf(cells.stream()
                .map(PeriodCell::indicatorCode).collect(Collectors.toSet()));
        return SummaryAggregator.aggregateCells(cells, kinds::get, deltaUnit);
    }

    /** {@link SummaryAggregator#mergeByIndicator} với bản chất chỉ tiêu đọc từ CSDL. */
    public List<SummaryRow> mergeByIndicator(List<SummaryRow> perUnit) {
        Map<String, MeasureKind> kinds = measureKinds.kindsOf(perUnit.stream()
                .map(SummaryRow::indicatorCode).collect(Collectors.toSet()));
        return SummaryAggregator.mergeByIndicator(perUnit, kinds::get);
    }
}
