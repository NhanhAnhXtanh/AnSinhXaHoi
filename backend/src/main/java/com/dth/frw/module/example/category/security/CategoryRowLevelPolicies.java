package com.dth.frw.module.example.category.security;

import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What a row-level policy on {@code categories} may say.
 *
 * <p>The smallest policy set here, and it is worth saying why it exists at all
 * rather than leaving a two-column lookup table unmanaged. A category is the
 * foreign key on the resource beside it, so narrowing categories is how "this
 * team only works on this section of the site" is expressed — and the moment
 * that rule exists somewhere, the table it is about has to be under the same
 * management as the one it narrows, or the two disagree.
 *
 * <p>{@code title} is the only column there is, so it is also the only thing a
 * policy can be about. That is a fair warning: a scope over an editable name
 * stops matching the day somebody corrects a typo, and {@code id} with
 * {@code in} is the more durable way to write the same rule.
 */
@Component
public class CategoryRowLevelPolicies implements RowLevelPolicySet<Category> {

    @Override
    public String resource() {
        return "categories";
    }

    @Override
    public Class<Category> entityClass() {
        return Category.class;
    }

    /** {@code FULL}: a resource already in use, so switching this on is a no-op. */
    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.column("title", String.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id");
    }
}
