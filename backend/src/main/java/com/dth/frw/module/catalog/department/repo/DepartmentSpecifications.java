package com.dth.frw.module.catalog.department.repo;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.department.DepartmentStatus;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>The fields handled here are the ones the admin UI's advanced filter emits:
 * {@code id}, {@code code}, {@code name}, {@code description}, {@code email},
 * {@code phone}, {@code status} and {@code organization.id}. Unknown fields are
 * ignored rather than rejected, so a new filter control on the frontend degrades
 * to "not narrowed" instead of blanking the table with a 400.
 */
public final class DepartmentSpecifications {

    private DepartmentSpecifications() {
    }

    public static Specification<Department> from(ListParams params) {
        List<Specification<Department>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Department> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "description" -> textSpec("description", criterion);
                case "email" -> textSpec("email", criterion);
                case "phone" -> textSpec("phone", criterion);
                case "status" -> statusSpec(criterion);
                case "organization.id", "organizationId" -> organizationSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` is the quick filter: one term matched across the department's own
        // code, name and description plus the organization's name, because the
        // provider has no way to express an OR across separate fields. The
        // organization is already eagerly joined for every row, so reaching
        // through it costs nothing extra here.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            var byText = cb.or(
                    cb.like(cb.lower(root.get("code")), pattern),
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern),
                    cb.like(cb.lower(root.get("organization").get("name")), pattern));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Department> idSpec(ListParams.Criterion criterion) {
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

    private static Specification<Department> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static Specification<Department> statusSpec(ListParams.Criterion criterion) {
        DepartmentStatus status;
        try {
            status = DepartmentStatus.from(criterion.value());
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

    private static Specification<Department> organizationSpec(ListParams.Criterion criterion) {
        Long organizationId = parseLong(criterion.value());
        if (organizationId == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("organization").get("id"), organizationId)
                : (root, query, cb) -> cb.equal(root.get("organization").get("id"), organizationId);
    }

    /** A predicate no row can satisfy — an unmatchable filter value. */
    private static Specification<Department> never() {
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
