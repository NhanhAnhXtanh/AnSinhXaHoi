package com.dth.frw.module.system.notification.api.dto;

import com.dth.frw.domain.system.notification.NotificationLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Raising a notification for somebody, over HTTP.
 *
 * <p>Not how the application normally raises one — features call
 * {@code NotificationService.notify} directly, in the same transaction as the
 * work that warranted it. This exists so that the mechanism can be exercised
 * from the admin UI and from a test without inventing a feature first, which is
 * worth having in a framework whose whole job is to be built on.
 *
 * @param recipientId who it is for. Required: there is no such thing as a
 *                    notification for nobody, and a broadcast is that many rows
 * @param level       null means {@code INFO}
 */
public record NotificationRequest(
        @NotNull(message = "A recipient is required")
        Long recipientId,

        NotificationLevel level,

        @NotBlank(message = "A title is required")
        @Size(max = 255, message = "The title cannot be longer than 255 characters")
        String title,

        @Size(max = 2000, message = "The body cannot be longer than 2000 characters")
        String body,

        @Size(max = 500, message = "The link cannot be longer than 500 characters")
        String link) {
}
