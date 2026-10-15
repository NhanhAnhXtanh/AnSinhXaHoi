package com.dth.frw.module.system.notification.service;

/**
 * A notification has been written and committed.
 *
 * <p>Published inside {@code NotificationService} and consumed by
 * {@code NotificationPublisher}, which is what puts it on the recipient's
 * WebSocket. Two reasons it is an event and not a direct call:
 *
 * <ul>
 *   <li>It is consumed {@code AFTER_COMMIT}. Pushing from inside the
 *       transaction would let the client be told about a row it cannot read
 *       yet, or — worse — about one that a rollback then removed.</li>
 *   <li>Raising a notification is something any feature may do, and none of
 *       them should have to know that a delivery mechanism exists, let alone
 *       which one. A second channel added later is a second listener, not an
 *       edit to every caller.</li>
 * </ul>
 *
 * @param id        the row, so a listener can re-read it rather than being
 *                  handed a detached entity across a transaction boundary
 * @param recipientId who it is for, which is all the routing needs
 */
public record NotificationRaised(long id, long recipientId) {
}
