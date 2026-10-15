package com.dth.frw.module.example.blogpost.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * The {@code category} object on a blog post request body.
 *
 * <p>The form's select writes to {@code category.id}, and on edit the record it
 * was loaded from still carries {@code category.title}, so the payload arrives
 * as a whole object. Only the id is read; any other property is ignored.
 */
public record CategoryRef(@NotNull(message = "Category is required") Long id) {
}
