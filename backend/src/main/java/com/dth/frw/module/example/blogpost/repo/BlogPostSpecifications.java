package com.dth.frw.module.example.blogpost.repo;

import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>The field names handled here are the ones the admin UI's advanced filter
 * emits: {@code id}, {@code title}, {@code status}, {@code category.id} and
 * {@code createdAt}. Unknown fields are ignored rather than rejected, so a new
 * filter control on the frontend degrades to "not narrowed" instead of blanking
 * the table with a 400.
 */
public final class BlogPostSpecifications {

    private BlogPostSpecifications() {
    }

    public static Specification<BlogPost> from(ListParams params) {
        List<Specification<BlogPost>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<BlogPost> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "title" -> textSpec("title", criterion);
                case "content" -> textSpec("content", criterion);
                case "status" -> statusSpec(criterion);
                case "category.id", "categoryId" -> categorySpec(criterion);
                case "createdAt" -> createdAtSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` is the quick filter: one term matched across id, title and
        // content, because the provider has no way to express an OR across
        // separate fields. The id half only joins in when the term parses as
        // one, which keeps the query off a per-row cast.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            var byText = cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("content")), pattern));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<BlogPost> idSpec(ListParams.Criterion criterion) {
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

    private static Specification<BlogPost> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static Specification<BlogPost> statusSpec(ListParams.Criterion criterion) {
        BlogPostStatus status;
        try {
            status = BlogPostStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // Filtering by a status that does not exist is a valid question
            // with an empty answer, not a bad request.
            return never();
        }
        if (status == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    private static Specification<BlogPost> categorySpec(ListParams.Criterion criterion) {
        Long categoryId = parseLong(criterion.value());
        if (categoryId == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("category").get("id"), categoryId)
                : (root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId);
    }

    /**
     * {@code createdAt} filtering.
     *
     * <p>{@code _gte}/{@code _lte} take an ISO date or instant. {@code _like}
     * takes a bare year and is turned into a range over it — that is the shape
     * the list view's "Created At" filter sends, and matching a timestamp with
     * a string {@code LIKE} would otherwise depend on how the database happens
     * to render one.
     */
    private static Specification<BlogPost> createdAtSpec(ListParams.Criterion criterion) {
        String value = criterion.value().trim();

        if (criterion.operator() == ListParams.Operator.LIKE || criterion.operator() == ListParams.Operator.EQ) {
            if (!value.matches("[0-9]{4}")) {
                return never();
            }
            int year = Integer.parseInt(value);
            Instant from = LocalDate.of(year, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant to = LocalDate.of(year + 1, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
            return (root, query, cb) -> cb.and(
                    cb.greaterThanOrEqualTo(createdAt(root), from),
                    cb.lessThan(createdAt(root), to));
        }

        Instant instant = parseInstant(value);
        if (instant == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(createdAt(root), instant);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(createdAt(root), instant);
            default -> (root, query, cb) -> cb.notEqual(createdAt(root), instant);
        };
    }

    private static Path<Instant> createdAt(jakarta.persistence.criteria.Root<BlogPost> root) {
        return root.get("createdAt");
    }

    /** A predicate no row can satisfy — an unmatchable filter value. */
    private static Specification<BlogPost> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Accepts both {@code 2024-01-31} and a full ISO instant. */
    private static Instant parseInstant(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            // fall through to the date-only form
        }
        try {
            return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
