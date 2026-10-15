package com.dth.frw.module.example.blogpost.api.dto;

import com.dth.frw.domain.example.blogpost.BlogPost;
import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import com.dth.frw.domain.example.category.Category;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Map;
import java.time.Instant;

/**
 * Wire shape of a blog post.
 *
 * <p>{@code category} is nested rather than flattened to a {@code categoryId}
 * because the admin UI reads {@code category.title} in the list column and
 * binds its form field to {@code category.id}.
 */
public record BlogPostResponse(
        Long id,
        String title,
        String content,
        BlogPostStatus status,
        CategorySummary category,
        Instant createdAt,
        /**
         * What this caller may do to <em>this row</em>, as
         * {@code {"write": true, "delete": false}}.
         *
         * <p>{@code USING} and {@code WITH CHECK} together against the state the
         * row is in now, which is the precise answer a button needs. Empty when
         * the resource is unmanaged or an association a policy needs was not
         * fetched.
         */
        @com.fasterxml.jackson.annotation.JsonProperty("_can")
        Map<String, Boolean> can) {

    /**
     * The category as this endpoint reports it.
     *
     * <p>Identical in shape to the category resource's own response today, and
     * declared here anyway: reusing that record would make the category API's
     * payload part of this endpoint's contract, so widening one response would
     * silently widen the other.
     */
    public record CategorySummary(Long id, String title) {

        static CategorySummary from(Category category) {
            return new CategorySummary(category.getId(), category.getTitle());
        }
    }

    /** Without row flags — for the echo of a deleted row, which nobody can act on. */
    public static BlogPostResponse from(BlogPost post) {
        return from(post, null);
    }

    public static BlogPostResponse from(BlogPost post, RowLevelSecurity rowLevel) {
        return new BlogPostResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getStatus(),
                CategorySummary.from(post.getCategory()),
                post.getCreatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(post));
    }
}
