package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerQuery;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerRow;
import com.dth.frw.module.asxh.ledger.query.IndicatorUsage;
import com.dth.frw.module.asxh.ledger.query.LedgerCriteria;
import com.dth.frw.module.asxh.ledger.query.LedgerTotal;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cài đặt {@link EffectiveLedgerQuery} bằng JPQL chiếu (constructor expression) — không nạp thực
 * thể nên không có N+1 khi đọc hàng nghìn dòng cho tổng hợp.
 *
 * <p>Mệnh đề WHERE dựng động: vế nào rỗng thì bỏ hẳn, không truyền danh sách rỗng vào {@code in}.
 */
@Service
@Transactional(readOnly = true)
public class EffectiveLedgerQueryService implements EffectiveLedgerQuery {

    /** Điều kiện "phiếu còn hiệu lực" trên bí danh phiếu {@code r}. */
    static final String EFFECTIVE = "(r.status = :approved or (r.status = :locked and r.approvedAt is not null))";

    private final EntityManager entityManager;

    public EffectiveLedgerQueryService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public List<EffectiveLedgerRow> find(LedgerCriteria criteria) {
        Map<String, Object> params = new HashMap<>();
        String jpql = "select new " + EffectiveLedgerRow.class.getName() + "("
                + "l.id, r.id, l.sheet.id, p.id, t.id, t.code, t.shortName, l.templateVersionId, "
                + "u.id, u.budgetCode, u.name, su.id, l.indicatorCode, l.indicatorName, "
                + "l.quantity, l.amount, l.note, l.orderNo, r.approvedAt) "
                + from()
                + where(criteria, params)
                + " order by p.fromDate, p.id, t.sortOrder, t.id, u.name, u.id, l.orderNo, l.indicatorCode";
        return query(jpql, EffectiveLedgerRow.class, params).getResultList();
    }

    @Override
    public List<LedgerTotal> sumByUnitAndIndicator(LedgerCriteria criteria) {
        Map<String, Object> params = new HashMap<>();
        String jpql = "select new " + LedgerTotal.class.getName() + "("
                + "t.id, u.id, l.indicatorCode, max(l.indicatorName), sum(l.quantity), sum(l.amount), "
                + "min(l.orderNo), count(l)) "
                + from()
                + where(criteria, params)
                + " group by t.id, u.id, l.indicatorCode"
                + " order by t.id, u.id, min(l.orderNo), l.indicatorCode";
        return query(jpql, LedgerTotal.class, params).getResultList();
    }

    @Override
    public List<LedgerTotal> sumByIndicator(LedgerCriteria criteria) {
        // Gộp từ kết quả theo đơn vị thay vì JPQL thứ hai: tránh hằng null trong constructor
        // expression (Hibernate không suy được kiểu) và giữ một nơi duy nhất định nghĩa phép cộng.
        Map<String, Accumulator> byKey = new LinkedHashMap<>();
        for (LedgerTotal total : sumByUnitAndIndicator(criteria)) {
            String key = total.templateId() + "\u001e" + total.indicatorCode();
            byKey.computeIfAbsent(key, k -> new Accumulator(total.templateId(), total.indicatorCode()))
                    .add(total);
        }
        List<LedgerTotal> result = new ArrayList<>(byKey.size());
        for (Accumulator acc : byKey.values()) {
            result.add(acc.toTotal());
        }
        result.sort((a, b) -> {
            int byTemplate = a.templateId().compareTo(b.templateId());
            if (byTemplate != 0) {
                return byTemplate;
            }
            int ao = a.orderNo() == null ? Integer.MAX_VALUE : a.orderNo();
            int bo = b.orderNo() == null ? Integer.MAX_VALUE : b.orderNo();
            if (ao != bo) {
                return Integer.compare(ao, bo);
            }
            return a.indicatorCode().compareTo(b.indicatorCode());
        });
        return result;
    }

    @Override
    public Set<Long> reportIdsWithData(LedgerCriteria criteria) {
        Map<String, Object> params = new HashMap<>();
        String jpql = "select distinct r.id " + from() + where(criteria, params);
        return new LinkedHashSet<>(query(jpql, Long.class, params).getResultList());
    }

    @Override
    public List<IndicatorUsage> indicatorUsages() {
        String jpql = "select new " + IndicatorUsage.class.getName() + "("
                + "l.indicatorCode, max(l.indicatorName), t.shortName, t.sortOrder, min(l.orderNo), count(l)) "
                + "from LedgerEntry l join l.report r join l.template t "
                + "where " + EFFECTIVE
                + " group by l.indicatorCode, t.id, t.shortName, t.sortOrder"
                + " order by t.sortOrder, t.id, min(l.orderNo), l.indicatorCode";
        return entityManager.createQuery(jpql, IndicatorUsage.class)
                .setParameter("approved", ReportStatus.APPROVED)
                .setParameter("locked", ReportStatus.LOCKED)
                .getResultList();
    }

    // ------------------------------------------------------------------ nội bộ

    private static String from() {
        // Mọi quan hệ bắt buộc (NOT NULL) nên nối trong là đúng nghĩa, không làm rơi dòng.
        return "from LedgerEntry l join l.report r join l.period p join l.template t "
                + "join l.unit u join l.submitterUnit su ";
    }

    private static String where(LedgerCriteria criteria, Map<String, Object> params) {
        StringBuilder where = new StringBuilder("where ").append(EFFECTIVE);
        params.put("approved", ReportStatus.APPROVED);
        params.put("locked", ReportStatus.LOCKED);

        where.append(" and p.id in :periodIds");
        params.put("periodIds", criteria.periodIds());

        if (!criteria.unitIds().isEmpty()) {
            switch (criteria.unitMatch()) {
                case SUBMITTER_UNIT -> where.append(" and su.id in :unitIds");
                case EITHER -> where.append(" and (u.id in :unitIds or su.id in :unitIds)");
                default -> where.append(" and u.id in :unitIds");
            }
            params.put("unitIds", criteria.unitIds());
        }
        if (!criteria.templateIds().isEmpty()) {
            where.append(" and t.id in :templateIds");
            params.put("templateIds", criteria.templateIds());
        }
        if (!criteria.indicatorCodes().isEmpty()) {
            where.append(" and l.indicatorCode in :indicatorCodes");
            params.put("indicatorCodes", criteria.indicatorCodes());
        }
        return where.toString();
    }

    private <T> TypedQuery<T> query(String jpql, Class<T> type, Map<String, Object> params) {
        TypedQuery<T> query = entityManager.createQuery(jpql, type);
        params.forEach(query::setParameter);
        return query;
    }

    /** Cộng dồn một (biểu, chỉ tiêu) qua các đơn vị; null + null giữ null (ô trống ≠ 0). */
    private static final class Accumulator {
        private final Long templateId;
        private final String indicatorCode;
        private String indicatorName;
        private BigDecimal quantity;
        private BigDecimal amount;
        private Integer orderNo;
        private long count;

        Accumulator(Long templateId, String indicatorCode) {
            this.templateId = templateId;
            this.indicatorCode = indicatorCode;
        }

        void add(LedgerTotal total) {
            if (indicatorName == null) {
                indicatorName = total.indicatorName();
            }
            quantity = plus(quantity, total.quantity());
            amount = plus(amount, total.amount());
            if (total.orderNo() != null && (orderNo == null || total.orderNo() < orderNo)) {
                orderNo = total.orderNo();
            }
            count += total.entryCount() == null ? 0 : total.entryCount();
        }

        LedgerTotal toTotal() {
            return new LedgerTotal(templateId, null, indicatorCode, indicatorName, quantity, amount, orderNo, count);
        }

        private static BigDecimal plus(BigDecimal a, BigDecimal b) {
            if (a == null) {
                return b;
            }
            return b == null ? a : a.add(b);
        }
    }
}
