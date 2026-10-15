package com.dth.frw.module.example.category.api.dto;

import com.dth.frw.domain.example.category.Category;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import java.util.Map;

/** Wire shape of a category — the two fields the admin UI reads, plus the row flags. */
public record CategoryResponse(
        Long id,
        String title,
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

    /** Without row flags — for the echo of a deleted row, which nobody can act on. */
    public static CategoryResponse from(Category category) {
        return from(category, null);
    }

    public static CategoryResponse from(Category category, RowLevelSecurity rowLevel) {
        return new CategoryResponse(
                category.getId(),
                category.getTitle(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(category));
    }
}
