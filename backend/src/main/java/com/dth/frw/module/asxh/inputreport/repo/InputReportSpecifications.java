package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/input_reports}.
 *
 * <p>Trường lọc: {@code id}, {@code status}, {@code period.id}, {@code unit.id},
 * {@code publication.id}, {@code revisionNo}, {@code period.calendar.year} (bí danh
 * {@code year} — ô Năm dùng chung của màn), {@code includeSuperseded}. {@code q} tìm theo tên
 * đơn vị, mã quan hệ ngân sách và tên kỳ. Trường lạ bị bỏ qua.
 *
 * <p>Bản cũ ({@code SUPERSEDED}) bị loại mặc định (BR-33.2): chỉ hiện khi lọc đích danh
 * {@code status=SUPERSEDED} hoặc {@code includeSuperseded=true} (hộp lịch sử phiên bản).
 */
public final class InputReportSpecifications {

    private InputReportSpecifications() {
    }

    public static Specification<InputReport> from(ListParams params) {
        List<Specification<InputReport>> specs = new ArrayList<>();
        boolean statusFiltered = false;
        boolean includeSuperseded = false;

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<InputReport> spec = switch (criterion.field()) {
                case "id" -> longSpec(criterion, "id");
                case "status" -> statusSpec(criterion);
                case "period.id", "periodId" -> longSpec(criterion, "period", "id");
                case "unit.id", "unitId" -> longSpec(criterion, "unit", "id");
                case "publication.id", "publicationId" -> longSpec(criterion, "publication", "id");
                case "revisionNo" -> intSpec(criterion);
                case "period.calendar.year", "year" -> yearSpec(criterion);
                default -> null;
            };
            if ("status".equals(criterion.field())) {
                statusFiltered = true;
            }
            if ("includeSuperseded".equals(criterion.field())) {
                includeSuperseded = Boolean.parseBoolean(criterion.value().trim());
            }
            if (spec != null) {
                specs.add(spec);
            }
        }

        if (!statusFiltered && !includeSuperseded) {
            specs.add((root, query, cb) -> cb.notEqual(root.get("status"), ReportStatus.SUPERSEDED));
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            return cb.or(
                    cb.like(cb.lower(root.get("unit").get("name")), pattern),
                    cb.like(cb.lower(root.get("unit").get("budgetCode")), pattern),
                    cb.like(cb.lower(root.get("period").get("name")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<InputReport> longSpec(ListParams.Criterion criterion, String... path) {
        Long value = parseLong(criterion.value());
        if (value == null) {
            return never();
        }
        return (root, query, cb) -> {
            jakarta.persistence.criteria.Path<Long> attribute = root.get(path[0]);
            for (int i = 1; i < path.length; i++) {
                attribute = attribute.get(path[i]);
            }
            return switch (criterion.operator()) {
                case NE -> cb.notEqual(attribute, value);
                case GTE -> cb.greaterThanOrEqualTo(attribute, value);
                case LTE -> cb.lessThanOrEqualTo(attribute, value);
                default -> cb.equal(attribute, value);
            };
        };
    }

    private static Specification<InputReport> intSpec(ListParams.Criterion criterion) {
        Integer value;
        try {
            value = Integer.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return never();
        }
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) -> cb.notEqual(root.get("revisionNo"), value);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("revisionNo"), value);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("revisionNo"), value);
            default -> (root, query, cb) -> cb.equal(root.get("revisionNo"), value);
        };
    }

    private static Specification<InputReport> yearSpec(ListParams.Criterion criterion) {
        Integer year;
        try {
            year = Integer.valueOf(criterion.value().trim());
        } catch (NumberFormatException e) {
            return never();
        }
        return (root, query, cb) -> cb.equal(root.get("period").get("calendar").get("year"), year);
    }

    private static Specification<InputReport> statusSpec(ListParams.Criterion criterion) {
        ReportStatus status = ReportStatus.parse(criterion.value());
        if (status == null) {
            // Lọc theo trạng thái không tồn tại là câu hỏi hợp lệ với câu trả lời rỗng.
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    private static Specification<InputReport> never() {
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
