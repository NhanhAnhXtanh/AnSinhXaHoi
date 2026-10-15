package com.dth.frw.module.example.blogpost.api.dto;

import com.dth.frw.domain.example.blogpost.BlogPostStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /blog_posts/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 */
public record BlogPostPatchRequest(
        @Size(min = 1, max = 255, message = "Title must be between 1 and 255 characters")
        String title,

        @Size(min = 1, message = "Content cannot be empty")
        String content,

        BlogPostStatus status,

        @Valid
        CategoryRef category) {
}
