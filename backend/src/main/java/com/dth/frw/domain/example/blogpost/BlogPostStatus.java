package com.dth.frw.domain.example.blogpost;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Publication state of a blog post.
 *
 * <p>The admin UI sends and renders the lower-case wire values
 * ({@code draft}, {@code published}, {@code rejected}); {@link #getValue()} is
 * what Jackson writes and {@link #from(String)} is what it reads, so the enum
 * constants stay idiomatic Java without leaking upper case into the API.
 */
public enum BlogPostStatus {

    DRAFT("draft"),
    PUBLISHED("published"),
    REJECTED("rejected");

    private final String value;

    BlogPostStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static BlogPostStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (BlogPostStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw) || status.name().equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown blog post status: " + raw);
    }
}
