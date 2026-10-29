package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/period_assignments}.
 *
 * <p>Trường lọc: {@code id}, {@code period.id}, {@code unit.id}, {@code template.id}.
 * {@code q} tìm theo tên đơn vị, mã quan hệ ngân sách, tên ngắn của biểu.
 */
public final class PeriodAssignmentSpecifications {

    private PeriodAssignmentSpecifications() {
    }

    public static Specification<PeriodAssignment> from(ListParams params) {
        List<Specification<PeriodAssignment>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<PeriodAssignment> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion, null);
                case "period.id", "periodId" -> idSpec(criterion, "period");
                case "unit.id", "unitId" -> idSpec(criterion, "unit");
                case "template.id", "templateId" -> idSpec(criterion, "template");
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            return cb.or(
                    cb.like(cb.lower(root.get("unit").get("name")), pattern),
                    cb.like(cb.lower(root.get("unit").get("budgetCode")), pattern),
                    cb.like(cb.lower(root.get("template").get("shortName")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<PeriodAssignment> idSpec(ListParams.Criterion criterion, String association) {
        Long value;
        try {
            value = Long.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            jakarta.persistence.criteria.Path<Long> attribute = association == null
                    ? root.get("id")
                    : root.get(association).get("id");
            return criterion.operator() == ListParams.Operator.NE
                    ? cb.notEqual(attribute, value)
                    : cb.equal(attribute, value);
        };
    }
}
