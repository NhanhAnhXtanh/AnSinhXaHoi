package com.dth.frw.module.system.notification.repo;

import com.dth.frw.domain.system.notification.Notification;
import com.dth.frw.domain.system.notification.NotificationLevel;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Translates the parsed query string into a JPA {@link Specification}.
 *
 * <p>Unknown fields are ignored rather than rejected, as everywhere else: the
 * admin UI is free to add a filter control before the backend knows about it,
 * and a 400 there would blank the whole table instead of just not narrowing it.
 *
 * <p>What is <em>not</em> here is the recipient. Scoping to the signed-in
 * account is not a filter the client may express — it is the invariant of this
 * resource — so {@code NotificationService} adds it itself, to whatever this
 * produces. Accepting a {@code recipient} filter here would make reading
 * somebody else's notifications a matter of typing a different query string.
 */
public final class NotificationSpecifications {

    private NotificationSpecifications() {
    }

    public static Specification<Notification> from(ListParams params) {
        List<Specification<Notification>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Notification> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "level" -> levelSpec(criterion);
                case "read" -> readSpec(criterion);
                case "title" -> titleSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` is the quick filter: one term across the two fields that carry
        // words, because the provider has no way to express an OR across them.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), ListParams.likePattern(term)),
                cb.like(cb.lower(root.get("body")), ListParams.likePattern(term)))));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Notification> idSpec(ListParams.Criterion criterion) {
        Long id = parseId(criterion.value());
        if (id == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<Notification> levelSpec(ListParams.Criterion criterion) {
        NotificationLevel level;
        try {
            level = NotificationLevel.valueOf(criterion.value().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            // A level that does not exist matches nothing, which is a truthful
            // answer; ignoring the filter would quietly widen the result.
            return (root, query, cb) -> cb.disjunction();
        }
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) -> cb.notEqual(root.get("level"), level);
            default -> (root, query, cb) -> cb.equal(root.get("level"), level);
        };
    }

    /**
     * {@code read=false} is what the bell asks for.
     *
     * <p>Read state is stored as a nullable timestamp rather than a boolean, so
     * the filter the client writes and the column it lands on are different
     * shapes — this is where they are reconciled.
     */
    private static Specification<Notification> readSpec(ListParams.Criterion criterion) {
        boolean read = Boolean.parseBoolean(criterion.value().trim());
        boolean wanted = criterion.operator() == ListParams.Operator.NE ? !read : read;
        return wanted
                ? (root, query, cb) -> cb.isNotNull(root.get("readAt"))
                : (root, query, cb) -> cb.isNull(root.get("readAt"));
    }

    private static Specification<Notification> titleSpec(ListParams.Criterion criterion) {
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
