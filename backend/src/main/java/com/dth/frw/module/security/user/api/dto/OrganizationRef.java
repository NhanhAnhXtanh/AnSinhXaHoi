package com.dth.frw.module.security.user.api.dto;

/**
 * An organization referred to by id in a user payload.
 *
 * <p>The id is deliberately <em>not</em> {@code @NotNull}, unlike the role and
 * department references a blog post or a department sends. Placement is
 * optional, and a form needs a way to say "no longer in one" — so
 * {@code {"organization": {"id": null}}} clears the field, while omitting
 * {@code organization} altogether leaves it as it was. Both arrive as
 * {@code null} at the record level, which is why the distinction has to live
 * one level down in the id.
 */
public record OrganizationRef(Long id) {
}
