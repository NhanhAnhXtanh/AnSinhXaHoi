package com.dth.frw.module.system.notification.api.dto;

/**
 * The number on the bell.
 *
 * <p>An object rather than a bare number because the data provider parses every
 * response body as JSON, and a bare {@code 3} is valid JSON that no client
 * treats as a document. Wrapping it also leaves room to add — a most-recent
 * timestamp, say — without changing the shape of a response somebody is already
 * parsing.
 */
public record UnreadCountResponse(long unread) {
}
