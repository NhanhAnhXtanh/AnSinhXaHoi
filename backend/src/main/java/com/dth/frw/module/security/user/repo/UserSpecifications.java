package com.dth.frw.module.security.user.repo;

import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected, as everywhere else: the
 * admin UI is free to add a filter control before the backend knows about it,
 * and a 400 there would blank the whole table instead of merely failing to
 * narrow it.
 */
public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<User> from(ListParams params) {
        List<Specification<User>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<User> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "username" -> textSpec("username", criterion);
                case "email" -> textSpec("email", criterion);
                case "fullName" -> textSpec("fullName", criterion);
                case "status" -> statusSpec(criterion);
                // The list view filters by role through the nested id the
                // response reports, so the field arrives as "roles.id".
                case "roles.id", "roleId" -> roleSpec(criterion);
                case "organization.id", "organizationId" -> placementSpec("organization", criterion);
                case "department.id", "departmentId" -> placementSpec("department", criterion);
                // Đơn vị báo cáo ASXH: ô lọc "Đơn vị" của màn Người dùng, panel Tài khoản của
                // màn Đơn vị. Cùng khuôn LEFT join như tổ chức / phòng ban.
                case "reportUnit.id", "reportUnitId" -> placementSpec("reportUnit", criterion);
                // Cấp tài khoản (BR-69.1): "don_vi" = có đơn vị, "so_ubnd" = không gắn đơn vị.
                case "accountLevel" -> accountLevelSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // The quick filter is one term matched across the three text columns,
        // because the provider has no way to express an OR across fields.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("username")), ListParams.likePattern(term)),
                cb.like(cb.lower(root.get("email")), ListParams.likePattern(term)),
                cb.like(cb.lower(root.get("fullName")), ListParams.likePattern(term)))));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<User> idSpec(ListParams.Criterion criterion) {
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

    private static Specification<User> textSpec(String field, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(field)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(cb.lower(root.get(field)), value.toLowerCase());
            default -> (root, query, cb) -> cb.equal(cb.lower(root.get(field)), value.toLowerCase());
        };
    }

    private static Specification<User> statusSpec(ListParams.Criterion criterion) {
        UserStatus status;
        try {
            status = UserStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // An unknown status is a filter that can never match, not a request
            // worth rejecting: same reasoning as an unknown field.
            return (root, query, cb) -> cb.disjunction();
        }
        if (status == null) {
            return null;
        }
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) -> cb.notEqual(root.get("status"), status);
            default -> (root, query, cb) -> cb.equal(root.get("status"), status);
        };
    }

    /**
     * Filters by an assigned role.
     *
     * <p>The join is inner and the query distinct: a user holding the role once
     * must appear once, and the many-to-many would otherwise multiply rows and
     * corrupt the page total.
     */
    private static Specification<User> roleSpec(ListParams.Criterion criterion) {
        Long roleId = parseId(criterion.value());
        if (roleId == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            if (query != null) {
                query.distinct(true);
            }
            return cb.equal(root.join("roles", JoinType.INNER).get("id"), roleId);
        };
    }

    /**
     * Filters on {@code organization.id} or {@code department.id}.
     *
     * <p>No {@code distinct}, unlike {@link #roleSpec}: both are to-one
     * associations, so the join cannot duplicate a row the way the roles
     * collection can.
     *
     * <p>{@code _ne} deliberately also matches rows where the field is null —
     * "not in this organization" plainly includes "in no organization", and a
     * bare inequality in SQL drops those rows instead, since {@code NULL <> 3}
     * is unknown rather than true.
     *
     * <p>The join has to be an explicit {@code LEFT} one for that to work.
     * Writing {@code root.get("organization").get("id")} lets JPA add an
     * <em>inner</em> join, which removes the unplaced rows before the
     * {@code IS NULL} branch above ever gets to see them — a filter that looks
     * right, reads right, and quietly returns a subset.
     */
    private static Specification<User> placementSpec(String attribute, ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            var placement = root.join(attribute, JoinType.LEFT);
            return criterion.operator() == ListParams.Operator.NE
                    ? cb.or(cb.isNull(placement.get("id")), cb.notEqual(placement.get("id"), id))
                    : cb.equal(placement.get("id"), id);
        };
    }

    /** Lọc theo cấp tài khoản suy ra từ đơn vị báo cáo; giá trị lạ không khớp dòng nào. */
    private static Specification<User> accountLevelSpec(ListParams.Criterion criterion) {
        String value = criterion.value() == null ? "" : criterion.value().trim().toLowerCase();
        return switch (value) {
            case "don_vi" -> (root, query, cb) -> cb.isNotNull(root.get("reportUnit"));
            case "so_ubnd" -> (root, query, cb) -> cb.isNull(root.get("reportUnit"));
            default -> (root, query, cb) -> cb.disjunction();
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
