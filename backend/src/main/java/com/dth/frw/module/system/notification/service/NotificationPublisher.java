package com.dth.frw.module.system.notification.service;

import com.dth.frw.domain.system.notification.Notification;
import com.dth.frw.module.system.notification.api.dto.NotificationResponse;
import com.dth.frw.module.security.auth.service.AuthorizationService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.messaging.PostgresEventBus;
import com.dth.frw.shared.security.Permissions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Puts a raised notification on its recipient's live connection.
 *
 * <p>Delivery only. The row written by {@code NotificationService} is the
 * record, and it is complete without this: somebody offline finds the
 * notification waiting at their next sign-in, and the bell reads it over HTTP
 * like anything else. What this adds is that somebody who is <em>online</em>
 * does not have to ask.
 *
 * <p>That framing is what keeps the failure modes boring. If the socket is
 * closed, the bus is down, or the client is on a node this message never
 * reaches, nothing is lost — only deferred to the next time the bell loads.
 *
 * <h2>The destination</h2>
 *
 * <p>{@code /user/queue/notifications}, resolved by Spring to the recipient's
 * own sessions. The user name it matches on is the account id as a string,
 * which is what {@code StompAuthChannelInterceptor} sets as the principal name
 * — the two have to agree or every message is addressed to somebody the broker
 * considers absent.
 */
@Component
public class NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationPublisher.class);

    /** Where the client subscribes, minus the {@code /user} prefix Spring adds. */
    public static final String DESTINATION = "/queue/notifications";

    /** What this feature's messages are labelled with on the shared bus. */
    static final String KIND = "notify";

    private final SimpMessagingTemplate messaging;
    private final NotificationService notifications;
    private final AuthorizationService authorizationService;
    private final PostgresEventBus bus;

    public NotificationPublisher(SimpMessagingTemplate messaging,
                                 NotificationService notifications,
                                 AuthorizationService authorizationService,
                                 PostgresEventBus bus) {
        this.messaging = messaging;
        this.notifications = notifications;
        this.authorizationService = authorizationService;
        this.bus = bus;
    }

    /**
     * Delivers a notification raised on this node, then tells the others.
     *
     * <p>{@code AFTER_COMMIT} is not a detail. Pushing from inside the
     * transaction would announce a row the client cannot read yet — and if the
     * caller's own work then rolled back, would announce something that never
     * happened at all.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRaised(NotificationRaised raised) {
        deliver(raised.id(), raised.recipientId());
        bus.publish(KIND, "%d:%d".formatted(raised.id(), raised.recipientId()));
    }

    /**
     * Delivers a notification raised on another node.
     *
     * <p>The bus carries only the two ids; this node re-reads the row for
     * itself. Sending the whole payload would work today and break the first
     * time a notification outgrew Postgres's 8000-byte notification limit.
     */
    @EventListener
    public void onRemote(PostgresEventBus.RemoteEvent remote) {
        if (!KIND.equals(remote.kind())) {
            return;
        }
        String[] parts = remote.payload().split(":");
        if (parts.length < 2) {
            log.warn("Ignoring unrecognised notification message: {}", remote.payload());
            return;
        }
        try {
            deliver(Long.parseLong(parts[0]), Long.parseLong(parts[1]));
        } catch (NumberFormatException e) {
            log.warn("Ignoring unrecognised notification message: {}", remote.payload());
        }
    }

    /**
     * Sends to whichever of the recipient's sessions are open on this node.
     *
     * <p>Costs nothing when they have none: the broker drops a message for a
     * user it does not know, so there is no need to check first.
     */
    @Transactional(readOnly = true)
    public void deliver(long notificationId, long recipientId) {
        // Re-asked per message rather than trusted from whenever the socket was
        // opened — see AuthorizationService.has. A connection can outlive the
        // permission that justified it by hours.
        if (!authorizationService.has(recipientId, Permissions.NOTIFICATIONS_READ)) {
            log.debug("Not delivering {} — recipient {} may not read notifications", notificationId, recipientId);
            return;
        }

        try {
            Notification notification = notifications.get(recipientId, notificationId);
            messaging.convertAndSendToUser(
                    String.valueOf(recipientId),
                    DESTINATION,
                    NotificationResponse.from(notification));
        } catch (ResourceNotFoundException e) {
            // Deleted between the commit and here, or the message reached a
            // node after the row was already gone. Nothing to deliver.
            log.debug("Notification {} no longer exists", notificationId);
        }
    }
}
