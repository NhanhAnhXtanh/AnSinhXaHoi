package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/publications} (lịch sử mở đợt, UC-30).
 *
 * <p>Trường lọc: {@code id}, {@code period.id}, {@code kind}, {@code status},
 * {@code period.calendar.year} (bí danh {@code year}). {@code q} tìm theo tên kỳ.
 */
public final class PublicationSpecifications {

    private PublicationSpecifications() {
    }

    public static Specification<Publication> from(ListParams params) {
        List<Specification<Publication>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Publication> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion, false);
                case "period.id", "periodId" -> idSpec(criterion, true);
                case "kind" -> kindSpec(criterion);
                case "status" -> statusSpec(criterion);
                case "period.calendar.year", "year" -> yearSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) ->
                cb.like(cb.lower(root.get("period").get("name")), ListParams.likePattern(term))));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<Publication> idSpec(ListParams.Criterion criterion, boolean period) {
        Long value;
        try {
            value = Long.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return never();
        }
        return (root, query, cb) -> {
            jakarta.persistence.criteria.Path<Long> attribute = period
                    ? root.get("period").get("id")
                    : root.get("id");
            return criterion.operator() == ListParams.Operator.NE
                    ? cb.notEqual(attribute, value)
                    : cb.equal(attribute, value);
        };
    }

    private static Specification<Publication> kindSpec(ListParams.Criterion criterion) {
        PublicationKind kind = PublicationKind.parse(criterion.value());
        if (kind == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("kind"), kind)
                : (root, query, cb) -> cb.equal(root.get("kind"), kind);
    }

    private static Specification<Publication> statusSpec(ListParams.Criterion criterion) {
        PublicationStatus status = PublicationStatus.parse(criterion.value());
        if (status == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    private static Specification<Publication> yearSpec(ListParams.Criterion criterion) {
        Integer year;
        try {
            year = Integer.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return never();
        }
        return (root, query, cb) -> cb.equal(root.get("period").get("calendar").get("year"), year);
    }

    private static Specification<Publication> never() {
        return (root, query, cb) -> cb.disjunction();
    }
}
