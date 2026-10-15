package com.dth.frw.module.system.notification.api.dto;

import com.dth.frw.domain.system.notification.Notification;
import com.dth.frw.domain.system.notification.NotificationLevel;
import java.time.Instant;

/**
 * One notification, as the list endpoint and the live channel both report it.
 *
 * <p>The same shape on both paths on purpose: the bell prepends what arrives on
 * the WebSocket to the list it fetched over HTTP, and two shapes would mean the
 * client rendering the same thing two ways depending on how it arrived.
 *
 * <p>{@code recipient} is absent, and that is the point — every endpoint is
 * already scoped to the caller, so the field would carry no information while
 * inviting a client to filter on it.
 *
 * @param read a convenience for the client, derived from {@code readAt} so the
 *             UI does not have to know that read state is stored as a timestamp
 * @param link a frontend route to open, or null
 */
public record NotificationResponse(
        Long id,
        NotificationLevel level,
        String title,
        String body,
        String link,
        boolean read,
        Instant readAt,
        Instant createdAt) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getLevel(),
                notification.getTitle(),
                notification.getBody(),
                notification.getLink(),
                notification.isRead(),
                notification.getReadAt(),
                notification.getCreatedAt());
    }
}
