package com.dth.frw.module.asxh.ledger.repo;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.shared.data.TextFold;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/ledger_entries}.
 *
 * <p>Trường lọc: {@code report.id}, {@code sheet.id}, {@code period.id}, {@code template.id},
 * {@code unit.id}, {@code submitterUnit.id}, {@code indicatorCode} (hỗ trợ {@code _like}). {@code q}
 * tìm theo mã / tên chỉ tiêu. Trường lạ bị bỏ qua.
 *
 * <p>Danh sách này trả MỌI dòng đã ghi của phiếu được hỏi, không lọc hiệu lực — dùng để xem số
 * liệu của một phiếu. Tổng hợp phải đọc qua {@code EffectiveLedgerQuery}.
 */
public final class LedgerEntrySpecifications {

    private LedgerEntrySpecifications() {
    }

    public static Specification<LedgerEntry> from(ListParams params) {
        List<Specification<LedgerEntry>> specs = new ArrayList<>();
        for (ListParams.Criterion criterion : params.filters()) {
            Specification<LedgerEntry> spec = switch (criterion.field()) {
                case "id" -> longSpec(criterion, "id");
                case "report.id", "reportId" -> longSpec(criterion, "report", "id");
                case "sheet.id", "sheetId" -> longSpec(criterion, "sheet", "id");
                case "period.id", "periodId" -> longSpec(criterion, "period", "id");
                case "template.id", "templateId" -> longSpec(criterion, "template", "id");
                case "unit.id", "unitId" -> longSpec(criterion, "unit", "id");
                case "submitterUnit.id", "submitterUnitId" -> longSpec(criterion, "submitterUnit", "id");
                case "indicatorCode" -> indicatorSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = TextFold.likePattern(term);
            return cb.or(
                    cb.like(TextFold.fold(cb, root.get("indicatorCode")), pattern),
                    cb.like(TextFold.fold(cb, root.get("indicatorName")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }
        return Specification.allOf(specs);
    }

    private static Specification<LedgerEntry> longSpec(ListParams.Criterion criterion, String... path) {
        Long value;
        try {
            value = Long.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            Path<Long> attribute = root.get(path[0]);
            for (int i = 1; i < path.length; i++) {
                attribute = attribute.get(path[i]);
            }
            return criterion.operator() == ListParams.Operator.NE
                    ? cb.notEqual(attribute, value)
                    : cb.equal(attribute, value);
        };
    }

    private static Specification<LedgerEntry> indicatorSpec(ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get("indicatorCode")), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get("indicatorCode"), value);
            default -> (root, query, cb) -> cb.equal(root.get("indicatorCode"), value);
        };
    }
}
