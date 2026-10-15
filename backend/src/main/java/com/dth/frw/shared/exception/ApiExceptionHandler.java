package com.dth.frw.shared.exception;

import com.dth.frw.shared.security.rowlevel.PolicyValidationException;
import com.dth.frw.shared.security.rowlevel.RowLevelViolationException;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Turns the exceptions the controllers and the security filter chain can raise
 * into a JSON body.
 *
 * <p>A body is not optional here: the data provider calls {@code response.json()}
 * on every non-2xx response, so an empty error payload surfaces in the admin UI
 * as an unparseable-response error instead of the real message.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException e) {
        return body(HttpStatus.NOT_FOUND, e.getMessage(), Map.of());
    }

    /**
     * A username already taken, or a role that is still assigned being deleted.
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ConflictException e) {
        return body(HttpStatus.CONFLICT, e.getMessage(), Map.of());
    }

    /**
     * Wrong username or password.
     *
     * <p>Deliberately the same message whichever half was wrong: saying which
     * one turns the login form into a way to find out whether an account
     * exists. It is separated from the handler below only so that the message
     * can be about credentials rather than about a token.
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException e) {
        return body(HttpStatus.UNAUTHORIZED, e.getMessage(), Map.of());
    }

    /**
     * No access token, or one that is expired, tampered with or not ours.
     *
     * <p>Reached from the security filter chain rather than from a controller,
     * via {@code RestAuthenticationEntryPoint}. The admin UI treats a 401 on any
     * request as its cue to refresh the token and, failing that, to sign out —
     * so this needs a body like every other error, or that path never runs.
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthenticated(AuthenticationException e) {
        return body(HttpStatus.UNAUTHORIZED, "Authentication is required to access this resource", Map.of());
    }

    /**
     * A valid token without the permission the endpoint asks for.
     *
     * <p>Covers both the filter chain and the {@code @PreAuthorize} annotations,
     * whose {@code AuthorizationDeniedException} is an {@code AccessDeniedException}.
     * Distinct from a 401 on purpose: the admin UI must not try to refresh a
     * token that is working exactly as intended.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, "You do not have permission to perform this action", Map.of());
    }

    /** Field-level bean validation failures on a {@code @Valid} request body. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidBody(MethodArgumentNotValidException e) {
        Map<String, Object> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(error ->
                errors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        return body(HttpStatus.UNPROCESSABLE_CONTENT, "Validation failed", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException e) {
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), Map.of());
    }

    /**
     * A write whose resulting state falls outside the caller's data scope.
     *
     * <p>{@code 422}, the same status a failed bean validation gets, and for the
     * same reason: the request was understood and the row does exist as far as
     * this caller is concerned. What is refused is the state it would leave
     * behind — moving a task into a department the writer cannot reach, say.
     * A {@code 403} would suggest the whole endpoint is closed to them, and a
     * {@code 404} would deny a record they can plainly see.
     */
    @ExceptionHandler(RowLevelViolationException.class)
    public ResponseEntity<Map<String, Object>> handleRowLevel(RowLevelViolationException e) {
        Map<String, Object> errors = e.field() == null
                ? Map.of()
                : Map.of(e.field(), "outside your data scope");
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), errors);
    }

    /**
     * A row-level policy that cannot be compiled — an unknown field, an operator
     * the type does not support, a literal that will not coerce.
     *
     * <p>Raised only on the path that <em>saves</em> a policy, which is the one
     * moment somebody is present to be told. The same failure at load time is
     * quarantined instead; see {@code RowLevelPolicyCache}.
     */
    @ExceptionHandler(PolicyValidationException.class)
    public ResponseEntity<Map<String, Object>> handlePolicyValidation(PolicyValidationException e) {
        Map<String, Object> errors = e.node() == null
                ? Map.of()
                : Map.of("scope", e.node());
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), errors);
    }

    /**
     * Deleting a category that blog posts still reference. The foreign key is
     * declared {@code ON DELETE RESTRICT}, so the database is what refuses it;
     * this turns that into a 409 with a message the admin UI can show.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrityViolation(DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "This record is still referenced by other records", Map.of());
    }

    /** Covers the unparseable enum / id values the request DTOs reject. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        return body(HttpStatus.BAD_REQUEST, e.getMessage(), Map.of());
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message, Map<String, Object> errors) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("timestamp", Instant.now().toString());
        payload.put("status", status.value());
        payload.put("error", status.getReasonPhrase());
        payload.put("message", message);
        if (!errors.isEmpty()) {
            payload.put("errors", errors);
        }
        return ResponseEntity.status(status).body(payload);
    }
}
