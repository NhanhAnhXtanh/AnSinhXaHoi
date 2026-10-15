package com.dth.frw.module.example.category.api.dto;

import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /categories/{id}} payload.
 *
 * <p>A {@code null} field means "leave it unchanged". The admin UI happens to
 * always send the whole form, but keeping the patch semantics honest means the
 * endpoint is also usable from anything that sends a real partial update.
 */
public record CategoryPatchRequest(
        @Size(min = 1, max = 255, message = "Title must be between 1 and 255 characters")
        String title) {
}
