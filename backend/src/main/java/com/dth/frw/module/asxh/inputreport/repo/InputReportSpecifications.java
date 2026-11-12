package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.shared.data.TextFold;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Chuỗi truy vấn → {@link Specification} cho {@code /api/input_reports}.
 *
 * <p>Trường lọc: {@code id}, {@code status}, {@code period.id}, {@code unit.id},
 * {@code publication.id}, {@code revisionNo}, {@code period.calendar.year} (bí danh
 * {@code year} — ô Năm dùng chung của màn), {@code period.status}, {@code templateSet.id},
 * {@code unit.block} (tinh / huyen / xa), {@code unit.parent.id} (huyện / thành phố),
 * {@code display} (trạng thái hiển thị — xem {@link #displaySpec}), {@code includeSuperseded}.
 * {@code q} tìm theo tên đơn vị, mã quan hệ ngân sách và tên kỳ. Trường lạ bị bỏ qua.
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
                case "display" -> displaySpec(criterion.value());
                case "period.id", "periodId" -> longSpec(criterion, "period", "id");
                case "period.status" -> periodStatusSpec(criterion);
                case "unit.id", "unitId" -> longSpec(criterion, "unit", "id");
                case "unit.parent.id" -> longSpec(criterion, "unit", "parent", "id");
                case "unit.block" -> blockSpec(criterion);
                case "publication.id", "publicationId" -> longSpec(criterion, "publication", "id");
                case "templateSet.id", "templateSetId" -> templateSetSpec(criterion);
                case "revisionNo" -> intSpec(criterion);
                case "period.calendar.year", "year" -> yearSpec(criterion);
                default -> null;
            };
            if ("status".equals(criterion.field()) || "display".equals(criterion.field())) {
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
            String pattern = TextFold.likePattern(term);
            return cb.or(
                    cb.like(TextFold.fold(cb, root.get("unit").get("name")), pattern),
                    cb.like(TextFold.fold(cb, root.get("unit").get("budgetCode")), pattern),
                    cb.like(TextFold.fold(cb, root.get("period").get("name")), pattern));
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

    /**
     * {@code status=SUBMITTED} hoặc nhiều giá trị cách nhau bằng dấu phẩy
     * ({@code status=DRAFT,RETURNED}); {@code status_ne} chỉ nhận một giá trị.
     */
    private static Specification<InputReport> statusSpec(ListParams.Criterion criterion) {
        List<ReportStatus> statuses = new ArrayList<>();
        for (String token : criterion.value().split(",")) {
            ReportStatus status = ReportStatus.parse(token);
            if (status != null) {
                statuses.add(status);
            }
        }
        if (statuses.isEmpty()) {
            // Lọc theo trạng thái không tồn tại là câu hỏi hợp lệ với câu trả lời rỗng.
            return never();
        }
        if (criterion.operator() == ListParams.Operator.NE) {
            ReportStatus first = statuses.getFirst();
            return (root, query, cb) -> cb.notEqual(root.get("status"), first);
        }
        return (root, query, cb) -> root.get("status").in(statuses);
    }

    /**
     * Trạng thái HIỂN THỊ (thẻ lọc nhanh, ô Trạng thái của hai màn danh sách), nhiều giá trị
     * cách nhau bằng dấu phẩy, nối bằng OR:
     *
     * <ul>
     *   <li>{@code draft} — phiếu DRAFT của kỳ CHƯA quá hạn (thẻ "Cần nhập");</li>
     *   <li>{@code overdue} — phiếu DRAFT của kỳ Quá hạn: "Quá hạn" không phải trạng thái phiếu
     *       mà là phiếu chưa nộp trong kỳ OVERDUE (bị khoá nhập hẳn);</li>
     *   <li>tên trạng thái phiếu còn lại ({@code returned}, {@code submitted}, {@code approved},
     *       {@code locked}, {@code cancelled}, {@code superseded}).</li>
     * </ul>
     */
    public static Specification<InputReport> displaySpec(String raw) {
        List<Specification<InputReport>> any = new ArrayList<>();
        for (String token : raw.split(",")) {
            Specification<InputReport> spec = displayKeySpec(token.trim().toLowerCase(Locale.ROOT));
            if (spec != null) {
                any.add(spec);
            }
        }
        return any.isEmpty() ? never() : Specification.anyOf(any);
    }

    /** Một khoá trạng thái hiển thị; {@code null} khi không nhận ra. */
    public static Specification<InputReport> displayKeySpec(String key) {
        if (DISPLAY_DRAFT.equals(key)) {
            return (root, query, cb) -> cb.and(
                    cb.equal(root.get("status"), ReportStatus.DRAFT),
                    cb.notEqual(root.get("period").get("status"), PeriodStatus.OVERDUE));
        }
        if (DISPLAY_OVERDUE.equals(key)) {
            return (root, query, cb) -> cb.and(
                    cb.equal(root.get("status"), ReportStatus.DRAFT),
                    cb.equal(root.get("period").get("status"), PeriodStatus.OVERDUE));
        }
        ReportStatus status = ReportStatus.parse(key);
        if (status == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /** Khoá trạng thái hiển thị "Cần nhập". */
    public static final String DISPLAY_DRAFT = "draft";

    /** Khoá trạng thái hiển thị "Quá hạn". */
    public static final String DISPLAY_OVERDUE = "overdue";

    private static Specification<InputReport> periodStatusSpec(ListParams.Criterion criterion) {
        PeriodStatus status;
        try {
            status = PeriodStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            return never();
        }
        if (status == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("period").get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("period").get("status"), status);
    }

    /** Khối của đơn vị (tinh / huyen / xa) — ô "Khối" của màn duyệt. */
    private static Specification<InputReport> blockSpec(ListParams.Criterion criterion) {
        ReportBlock block;
        try {
            block = ReportBlock.from(criterion.value());
        } catch (IllegalArgumentException e) {
            return never();
        }
        if (block == null) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("unit").get("block"), block)
                : (root, query, cb) -> cb.equal(root.get("unit").get("block"), block);
    }

    /** Phiếu có ít nhất một biểu thuộc bộ mẫu cho trước — EXISTS, không join (tránh nhân dòng). */
    private static Specification<InputReport> templateSetSpec(ListParams.Criterion criterion) {
        Long setId = parseLong(criterion.value());
        if (setId == null) {
            return never();
        }
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<InputReportSheet> sheet = sub.from(InputReportSheet.class);
            sub.select(sheet.get("id")).where(
                    cb.equal(sheet.get("report"), root),
                    cb.equal(sheet.get("template").get("templateSet").get("id"), setId));
            return cb.exists(sub);
        };
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
