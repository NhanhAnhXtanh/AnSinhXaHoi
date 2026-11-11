package com.dth.frw.module.asxh.unit.repo;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.shared.data.TextFold;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn đã parse → {@link Specification}.
 *
 * <p>Trường lọc: {@code id}, {@code budgetCode}, {@code name}, {@code unitType},
 * {@code block}, {@code active}, {@code receivesReports}, {@code parent.id}
 * (giá trị {@code null} = chỉ đơn vị gốc). {@code q} khớp mã và tên. Trường lạ bị
 * bỏ qua thay vì trả 400, để bộ lọc mới ở frontend chỉ "không lọc" chứ không làm
 * trắng bảng.
 */
public final class ReportUnitSpecifications {

    private ReportUnitSpecifications() {
    }

    public static Specification<ReportUnit> from(ListParams params) {
        List<Specification<ReportUnit>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<ReportUnit> spec = switch (criterion.field()) {
                case "id" -> idSpec("id", criterion);
                case "budgetCode" -> textSpec("budgetCode", criterion);
                case "name" -> textSpec("name", criterion);
                case "unitType" -> enumSpec("unitType", criterion, ReportUnitType::from);
                case "block" -> enumSpec("block", criterion, ReportBlock::from);
                case "active" -> booleanSpec("active", criterion);
                case "receivesReports" -> booleanSpec("receivesReports", criterion);
                case "parent.id", "parentId" -> parentSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = TextFold.likePattern(term);
            return cb.or(
                    cb.like(TextFold.fold(cb, root.get("budgetCode")), pattern),
                    cb.like(TextFold.fold(cb, root.get("name")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<ReportUnit> idSpec(String attribute, ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get(attribute), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get(attribute), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get(attribute), id);
        };
    }

    private static Specification<ReportUnit> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static <E extends Enum<E>> Specification<ReportUnit> enumSpec(
            String attribute, ListParams.Criterion criterion, Function<String, E> parser) {
        E value;
        try {
            value = parser.apply(criterion.value());
        } catch (IllegalArgumentException e) {
            // Lọc theo giá trị không tồn tại là câu hỏi hợp lệ với câu trả lời rỗng.
            return never();
        }
        if (value == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get(attribute), value)
                : (root, query, cb) -> cb.equal(root.get(attribute), value);
    }

    private static Specification<ReportUnit> booleanSpec(String attribute, ListParams.Criterion criterion) {
        String raw = criterion.value().trim();
        boolean value;
        if ("true".equalsIgnoreCase(raw) || "1".equals(raw)) {
            value = true;
        } else if ("false".equalsIgnoreCase(raw) || "0".equals(raw)) {
            value = false;
        } else {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get(attribute), value)
                : (root, query, cb) -> cb.equal(root.get(attribute), value);
    }

    private static Specification<ReportUnit> parentSpec(ListParams.Criterion criterion) {
        String raw = criterion.value().trim();
        boolean negate = criterion.operator() == ListParams.Operator.NE;
        if ("null".equalsIgnoreCase(raw)) {
            return negate
                    ? (root, query, cb) -> cb.isNotNull(root.get("parent"))
                    : (root, query, cb) -> cb.isNull(root.get("parent"));
        }
        Long parentId = parseLong(raw);
        if (parentId == null) {
            return never();
        }
        return negate
                ? (root, query, cb) -> cb.notEqual(root.get("parent").get("id"), parentId)
                : (root, query, cb) -> cb.equal(root.get("parent").get("id"), parentId);
    }

    /** Điều kiện không dòng nào thoả — giá trị lọc không khớp được. */
    private static Specification<ReportUnit> never() {
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
