package com.dth.frw.module.example.category.repo;

import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected: the admin UI is free to
 * add a filter control before the backend knows about it, and a 400 there would
 * blank the whole table instead of just not narrowing it.
 */
public final class CategorySpecifications {

    private CategorySpecifications() {
    }

    public static Specification<Category> from(ListParams params) {
        List<Specification<Category>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Category> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "title" -> titleSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` is the quick filter: one term matched across id and title, because
        // the provider has no way to express an OR across separate fields. The
        // id half only joins in when the term parses as one, which keeps the
        // query off a per-row cast.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            var byTitle = cb.like(cb.lower(root.get("title")), ListParams.likePattern(term));
            Long id = parseId(term);
            return id == null ? byTitle : cb.or(byTitle, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Category> idSpec(ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            // A non-numeric id can never match; say so explicitly rather than
            // letting the filter silently disappear.
            return (root, query, cb) -> cb.disjunction();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<Category> titleSpec(ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get("title")), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get("title"), value);
            default -> (root, query, cb) -> cb.equal(root.get("title"), value);
        };
    }

    private static Long parseId(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
