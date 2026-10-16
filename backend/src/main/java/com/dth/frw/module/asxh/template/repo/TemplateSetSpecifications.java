package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Query string → {@link Specification} cho {@code /api/template_sets}.
 * Trường lọc: {@code id}, {@code name}, {@code description}; {@code q} tìm theo
 * tên + mô tả. Trường lạ bị bỏ qua.
 */
public final class TemplateSetSpecifications {

    private TemplateSetSpecifications() {
    }

    public static Specification<TemplateSet> from(ListParams params) {
        List<Specification<TemplateSet>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<TemplateSet> spec = switch (criterion.field()) {
                case "id" -> SpecSupport.idSpec("id", criterion);
                case "name" -> SpecSupport.textSpec("name", criterion);
                case "description" -> SpecSupport.textSpec("description", criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            String pattern = ListParams.likePattern(term);
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }
}
