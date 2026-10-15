package com.dth.frw.shared.exception;

/**
 * Raised when a request is well-formed but conflicts with the current state —
 * a username already taken, or a role that is still assigned being deleted.
 *
 * <p>Distinct from a validation failure: nothing about the payload is wrong in
 * isolation, so a 422 with a field error would be misleading. The admin UI
 * shows the message as-is, which is why it is written for a human.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
