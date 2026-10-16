package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Query string → {@link Specification} cho {@code /api/template_versions}.
 *
 * <p>Trường lọc: {@code id}, {@code template.id} (cũng nhận {@code templateId}),
 * {@code template.set.id}, {@code template.kind}, {@code status},
 * {@code versionNo}, {@code effectiveFrom}, {@code effectiveTo} (đều nhận
 * {@code _gte}/{@code _lte}). {@code q} tìm theo tên ngắn / tên biểu.
 */
public final class TemplateVersionSpecifications {

    private TemplateVersionSpecifications() {
    }

    public static Specification<TemplateVersion> from(ListParams params) {
        List<Specification<TemplateVersion>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<TemplateVersion> spec = switch (criterion.field()) {
                case "id" -> SpecSupport.idSpec("id", criterion);
                case "template.id", "templateId" -> SpecSupport.idSpec("template.id", criterion);
                case "template.set.id", "template.templateSet.id", "setId" ->
                        SpecSupport.idSpec("template.templateSet.id", criterion);
                case "template.kind", "kind" ->
                        SpecSupport.enumSpec("template.kind", TemplateKind.parse(criterion.value()), criterion);
                case "status" ->
                        SpecSupport.enumSpec("status", TemplateStatus.parse(criterion.value()), criterion);
                case "versionNo" -> SpecSupport.intSpec("versionNo", criterion);
                case "effectiveFrom" -> SpecSupport.dateSpec("effectiveFrom", criterion);
                case "effectiveTo" -> SpecSupport.dateSpec("effectiveTo", criterion);
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
}
