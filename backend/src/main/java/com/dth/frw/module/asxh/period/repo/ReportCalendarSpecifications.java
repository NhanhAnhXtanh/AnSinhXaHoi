package com.dth.frw.module.asxh.period.repo;

import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Lọc lịch báo cáo: {@code id}, {@code year} (kèm {@code _gte}/{@code _lte}/{@code _ne}).
 * {@code q} là số năm. Trường lạ bị bỏ qua.
 */
public final class ReportCalendarSpecifications {

    private ReportCalendarSpecifications() {
    }

    public static Specification<ReportCalendar> from(ListParams params) {
        List<Specification<ReportCalendar>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<ReportCalendar> spec = switch (criterion.field()) {
                case "id" -> numberSpec("id", criterion);
                case "year" -> numberSpec("year", criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> {
            Long year = parseLong(term);
            specs.add(year == null
                    ? never()
                    : (root, query, cb) -> cb.equal(root.get("year"), year.intValue()));
        });

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<ReportCalendar> numberSpec(String attribute, ListParams.Criterion criterion) {
        Long parsed = parseLong(criterion.value());
        if (parsed == null) {
            return never();
        }
        // year là Integer, id là Long: so sánh đúng kiểu để Hibernate không phải ép.
        if ("year".equals(attribute)) {
            Integer value = parsed.intValue();
            return switch (criterion.operator()) {
                case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get(attribute), value);
                case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
                case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get(attribute), value);
                case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get(attribute), value);
            };
        }
        Long value = parsed;
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get(attribute), value);
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get(attribute), value);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get(attribute), value);
        };
    }

    private static Specification<ReportCalendar> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
