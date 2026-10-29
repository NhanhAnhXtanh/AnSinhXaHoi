package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Root;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.data.jpa.domain.Specification;

/**
 * Mảnh dùng chung cho ba lớp {@code *Specifications} của slice mẫu biểu —
 * cùng cách hiểu toán tử như {@code DepartmentSpecifications} của base: giá trị
 * không đọc được thì trả "không dòng nào khớp" chứ không trả 400.
 */
final class SpecSupport {

    private SpecSupport() {
    }

    /** Đi theo đường dẫn có dấu chấm, ví dụ {@code template.templateSet.id}. */
    static <T, Y> Path<Y> path(Root<T> root, String dotted) {
        String[] parts = dotted.split("\\.");
        Path<?> path = root;
        for (int i = 0; i < parts.length - 1; i++) {
            path = path.get(parts[i]);
        }
        return path.<Y>get(parts[parts.length - 1]);
    }

    static <T> Specification<T> idSpec(String attribute, ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(path(root, attribute), id);
            case NE -> (root, query, cb) -> cb.notEqual(path(root, attribute), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(SpecSupport.<T, Long>path(root, attribute), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(SpecSupport.<T, Long>path(root, attribute), id);
        };
    }

    static <T> Specification<T> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(SpecSupport.<T, String>path(root, attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(path(root, attribute), value);
            default -> (root, query, cb) -> cb.equal(path(root, attribute), value);
        };
    }

    static <T> Specification<T> intSpec(String attribute, ListParams.Criterion criterion) {
        Long parsed = parseLong(criterion.value());
        if (parsed == null) {
            return never();
        }
        int value = parsed.intValue();
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(path(root, attribute), value);
            case NE -> (root, query, cb) -> cb.notEqual(path(root, attribute), value);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(SpecSupport.<T, Integer>path(root, attribute), value);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(SpecSupport.<T, Integer>path(root, attribute), value);
        };
    }

    static <T> Specification<T> dateSpec(String attribute, ListParams.Criterion criterion) {
        LocalDate date = parseDate(criterion.value());
        if (date == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(path(root, attribute), date);
            case NE -> (root, query, cb) -> cb.notEqual(path(root, attribute), date);
            case GTE -> (root, query, cb) ->
                    cb.greaterThanOrEqualTo(SpecSupport.<T, LocalDate>path(root, attribute), date);
            case LTE -> (root, query, cb) ->
                    cb.lessThanOrEqualTo(SpecSupport.<T, LocalDate>path(root, attribute), date);
        };
    }

    /** So bằng / khác cho một giá trị enum đã đọc; {@code null} = giá trị lạ → không dòng nào. */
    static <T> Specification<T> enumSpec(String attribute, Enum<?> value, ListParams.Criterion criterion) {
        if (value == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(path(root, attribute), value)
                : (root, query, cb) -> cb.equal(path(root, attribute), value);
    }

    /** Một vị từ không dòng nào thoả — giá trị lọc không thể khớp. */
    static <T> Specification<T> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    static Long parseLong(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Chấp nhận {@code yyyy-MM-dd} và phần ngày của một ISO date-time. */
    static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > 10) {
            trimmed = trimmed.substring(0, 10);
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
