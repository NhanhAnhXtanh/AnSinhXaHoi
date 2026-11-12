package com.dth.frw.module.asxh.period.repo;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.shared.data.TextFold;
import com.dth.frw.shared.web.ListParams;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.jpa.domain.Specification;

/**
 * Lọc kỳ báo cáo: {@code id}, {@code calendar.id}, {@code calendar.year}, {@code kind},
 * {@code status}, {@code seq}, {@code code}, {@code name}, và các mốc ngày
 * {@code fromDate}, {@code toDate}, {@code openFrom}, {@code deadline} (kèm
 * {@code _gte}/{@code _lte}, định dạng {@code yyyy-MM-dd}). {@code q} khớp mã và tên
 * kỳ. Trường lạ bị bỏ qua.
 */
public final class ReportPeriodSpecifications {

    private ReportPeriodSpecifications() {
    }

    public static Specification<ReportPeriod> from(ListParams params) {
        List<Specification<ReportPeriod>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<ReportPeriod> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "calendar.id", "calendarId" -> calendarIdSpec(criterion);
                case "calendar.year", "year" -> yearSpec(criterion);
                case "kind" -> enumSpec("kind", criterion, PeriodKind::from);
                case "status" -> enumSpec("status", criterion, PeriodStatus::from);
                case "seq" -> seqSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "fromDate" -> dateSpec("fromDate", criterion);
                case "toDate" -> dateSpec("toDate", criterion);
                case "openFrom" -> dateSpec("openFrom", criterion);
                case "deadline" -> dateSpec("deadline", criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = TextFold.likePattern(term);
            return cb.or(
                    cb.like(TextFold.fold(cb, root.get("code")), pattern),
                    cb.like(TextFold.fold(cb, root.get("name")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<ReportPeriod> idSpec(ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<ReportPeriod> calendarIdSpec(ListParams.Criterion criterion) {
        Long calendarId = parseLong(criterion.value());
        if (calendarId == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("calendar").get("id"), calendarId)
                : (root, query, cb) -> cb.equal(root.get("calendar").get("id"), calendarId);
    }

    private static Specification<ReportPeriod> yearSpec(ListParams.Criterion criterion) {
        Long parsed = parseLong(criterion.value());
        if (parsed == null) {
            return never();
        }
        Integer year = parsed.intValue();
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("calendar").get("year"), year);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("calendar").get("year"), year);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("calendar").get("year"), year);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("calendar").get("year"), year);
        };
    }

    private static Specification<ReportPeriod> seqSpec(ListParams.Criterion criterion) {
        Long parsed = parseLong(criterion.value());
        if (parsed == null) {
            return never();
        }
        Integer seq = parsed.intValue();
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("seq"), seq)
                : (root, query, cb) -> cb.equal(root.get("seq"), seq);
    }

    private static Specification<ReportPeriod> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static <E extends Enum<E>> Specification<ReportPeriod> enumSpec(
            String attribute, ListParams.Criterion criterion, Function<String, E> parser) {
        E value;
        try {
            value = parser.apply(criterion.value());
        } catch (IllegalArgumentException e) {
            return never();
        }
        if (value == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get(attribute), value)
                : (root, query, cb) -> cb.equal(root.get(attribute), value);
    }

    private static Specification<ReportPeriod> dateSpec(String attribute, ListParams.Criterion criterion) {
        LocalDate date;
        try {
            // Chấp nhận cả "2026-03-31T00:00:00..." mà bộ chọn ngày có thể gửi.
            String raw = criterion.value().trim();
            date = LocalDate.parse(raw.length() > 10 ? raw.substring(0, 10) : raw);
        } catch (DateTimeParseException e) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get(attribute), date);
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), date);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get(attribute), date);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get(attribute), date);
        };
    }

    private static Specification<ReportPeriod> never() {
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
