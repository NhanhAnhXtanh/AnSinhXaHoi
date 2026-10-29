package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/input_report_sheets}.
 *
 * <p>Trường lọc: {@code id}, {@code report.id}, {@code template.id}, {@code completion}.
 * {@code q} tìm theo tên ngắn / tên biểu.
 */
public final class InputReportSheetSpecifications {

    private InputReportSheetSpecifications() {
    }

    public static Specification<InputReportSheet> from(ListParams params) {
        List<Specification<InputReportSheet>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<InputReportSheet> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion, null);
                case "report.id", "reportId" -> idSpec(criterion, "report");
                case "template.id", "templateId" -> idSpec(criterion, "template");
                case "completion" -> completionSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            return cb.or(
                    cb.like(cb.lower(root.get("template").get("shortName")), pattern),
                    cb.like(cb.lower(root.get("template").get("name")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<InputReportSheet> idSpec(ListParams.Criterion criterion, String association) {
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

    private static Specification<InputReportSheet> completionSpec(ListParams.Criterion criterion) {
        SheetCompletion completion = SheetCompletion.parse(criterion.value());
        if (completion == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("completion"), completion)
                : (root, query, cb) -> cb.equal(root.get("completion"), completion);
    }
}
