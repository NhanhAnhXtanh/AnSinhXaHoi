package com.dth.frw.module.example.blogpost.security;

import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import com.dth.frw.domain.example.category.Category;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What a row-level policy on {@code blog_posts} may say.
 *
 * <p>This is the resource where a {@code FILTER} finally has an obvious use, and
 * it is worth spelling out because the two kinds are easy to confuse. "Editors
 * only see their own section" is a {@code SCOPE} on {@code category.id} — it
 * widens the role that holds it. "Nobody reads a draft through this API" is a
 * {@code FILTER} on {@code status}, and the difference is not stylistic: a
 * filter names no role, so it cannot be escaped by not holding one, and a role
 * created next month carries it without anybody remembering to say so.
 *
 * <p>{@code content} is deliberately not a policy field. A body of text is not a
 * security boundary, and a {@code like} over it would be a scope that changes
 * meaning every time somebody edits a paragraph.
 */
@Component
public class BlogPostRowLevelPolicies implements RowLevelPolicySet<BlogPost> {

    @Override
    public String resource() {
        // Underscore included: the resource name is verbatim what routes.tsx
        // declares, what the permission codes use, and what the controller is
        // mapped at. There is no lookup table in between to drift.
        return "blog_posts";
    }

    @Override
    public Class<BlogPost> entityClass() {
        return BlogPost.class;
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
                FieldDescriptor.column("title", String.class, false),
                FieldDescriptor.column("status", BlogPostStatus.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false),
                FieldDescriptor.reference("category", Category.class));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt");
    }
}
