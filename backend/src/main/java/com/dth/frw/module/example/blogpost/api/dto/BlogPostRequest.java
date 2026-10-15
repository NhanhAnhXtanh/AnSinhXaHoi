package com.dth.frw.module.example.blogpost.api.dto;

import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /blog_posts} payload.
 *
 * <p>{@code status} is optional — a post created without one starts as a draft,
 * which is what the form's default already sends.
 */
public record BlogPostRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must be at most 255 characters")
        String title,

        @NotBlank(message = "Content is required")
        String content,

        BlogPostStatus status,

        @NotNull(message = "Category is required")
        @Valid
        CategoryRef category) {
}
