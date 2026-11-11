package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.shared.data.TextFold;
import com.dth.frw.shared.web.ListParams;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Query string → {@link Specification} cho {@code /api/templates}.
 *
 * <p>Trường lọc: {@code id}, {@code code}, {@code shortName}, {@code name},
 * {@code kind}, {@code sortOrder}, {@code set.id} (cũng nhận {@code setId},
 * {@code templateSet.id}), và hai bộ lọc suy ra:
 * <ul>
 *   <li>{@code applicableOn=yyyy-MM-dd} — biểu KHÔNG khoá, có bản đã ban hành áp dụng từ
 *       ngày đó trở về trước (cột biểu của ma trận thiết lập, UC-22 / UC-19);</li>
 *   <li>{@code published=true|false} — biểu có / chưa có bản đã ban hành nào.</li>
 * </ul>
 * {@code q} tìm theo tên ngắn, tên biểu, tên bộ mẫu.
 */
public final class TemplateSpecifications {

    private TemplateSpecifications() {
    }

    public static Specification<Template> from(ListParams params) {
        List<Specification<Template>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<Template> spec = switch (criterion.field()) {
                case "id" -> SpecSupport.idSpec("id", criterion);
                case "code" -> SpecSupport.textSpec("code", criterion);
                case "shortName" -> SpecSupport.textSpec("shortName", criterion);
                case "name" -> SpecSupport.textSpec("name", criterion);
                case "sortOrder" -> SpecSupport.intSpec("sortOrder", criterion);
                case "kind" -> SpecSupport.enumSpec("kind", TemplateKind.parse(criterion.value()), criterion);
                case "set.id", "setId", "templateSet.id" -> SpecSupport.idSpec("templateSet.id", criterion);
                case "applicableOn" -> applicableOn(SpecSupport.parseDate(criterion.value()));
                case "published" -> published(criterion.value());
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = TextFold.likePattern(term);
            return cb.or(
                    cb.like(TextFold.fold(cb, root.get("shortName")), pattern),
                    cb.like(TextFold.fold(cb, root.get("name")), pattern),
                    cb.like(TextFold.fold(cb, root.get("templateSet").get("name")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    /** Có bản {@code PUBLISHED} với ngày áp dụng ≤ {@code date}. */
    public static Specification<Template> applicableOn(LocalDate date) {
        if (date == null) {
            return SpecSupport.never();
        }
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<TemplateVersion> version = sub.from(TemplateVersion.class);
            sub.select(version.get("id")).where(
                    cb.equal(version.get("template"), root),
                    cb.equal(version.get("status"), TemplateStatus.PUBLISHED),
                    cb.lessThanOrEqualTo(version.<LocalDate>get("effectiveFrom"), date));
            // Biểu đang khoá (để sửa) không dùng được cho kỳ nào.
            return cb.and(cb.isFalse(root.get("locked")), cb.exists(sub));
        };
    }

    private static Specification<Template> published(String raw) {
        boolean wanted = !"false".equalsIgnoreCase(raw.trim());
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<TemplateVersion> version = sub.from(TemplateVersion.class);
            sub.select(version.get("id")).where(
                    cb.equal(version.get("template"), root),
                    cb.equal(version.get("status"), TemplateStatus.PUBLISHED));
            return wanted ? cb.exists(sub) : cb.not(cb.exists(sub));
        };
    }
}
