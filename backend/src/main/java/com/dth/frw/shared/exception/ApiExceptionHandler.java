package com.dth.frw.shared.exception;

import com.dth.frw.shared.security.rowlevel.PolicyValidationException;
import com.dth.frw.shared.security.rowlevel.RowLevelViolationException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Turns the exceptions the controllers and the security filter chain can raise
 * into a JSON body.
 *
 * <p>A body is not optional here: the data provider calls {@code response.json()}
 * on every non-2xx response, so an empty error payload surfaces in the admin UI
 * as an unparseable-response error instead of the real message.
 *
 * <p><strong>Every {@code message} is a Vietnamese sentence for the person at the
 * screen</strong> — cán bộ xã, huyện, Sở — with no technical terms and no ids. The
 * shape is unchanged ({@code timestamp, status, error, message, errors}); the
 * frontend reads {@code message} and {@code errors}. Where a feature already
 * wrote its own Vietnamese message (a {@link ConflictException}, an
 * {@link IllegalArgumentException} from a service) it is passed through
 * verbatim; a message with no Vietnamese in it — an English sentence from the
 * framework or from an untranslated corner of the base project — is replaced by
 * the generic sentence for that kind of failure (see {@link #vietnameseOr}).
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    static final String MSG_WRONG_CREDENTIALS = "Tên đăng nhập hoặc mật khẩu không đúng.";
    static final String MSG_ACCOUNT_INACTIVE =
            "Tài khoản này đã ngừng hoạt động. Bạn liên hệ quản trị viên để được mở lại.";
    static final String MSG_SESSION_EXPIRED = "Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại để tiếp tục.";
    static final String MSG_FORBIDDEN = "Bạn chưa được cấp quyền thực hiện thao tác này.";
    static final String MSG_INVALID = "Dữ liệu nhập chưa hợp lệ. Bạn kiểm tra lại các ô được đánh dấu.";
    static final String MSG_BAD_REQUEST = "Dữ liệu gửi lên không hợp lệ. Bạn tải lại trang rồi thử lại.";
    static final String MSG_CONFLICT =
            "Không thực hiện được vì xung đột với dữ liệu hiện có. Bạn tải lại trang để xem dữ liệu mới nhất.";
    static final String MSG_IN_USE =
            "Không thực hiện được vì dữ liệu này đang được dùng ở nơi khác hoặc bị trùng với dữ liệu đã có.";
    static final String MSG_NOT_FOUND = "Không tìm thấy trang hoặc dữ liệu yêu cầu.";
    static final String MSG_SERVER_ERROR =
            "Hệ thống gặp sự cố ngoài ý muốn. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy báo quản trị viên.";
    static final String MSG_FIELD_INVALID = "Giá trị chưa hợp lệ.";

    /**
     * Câu tiếng Anh còn sót ở nơi phát {@code BadCredentialsException}, đổi sang câu cho cán bộ.
     *
     * <p>{@code AuthService} và {@code RefreshTokenService} đã viết câu tiếng Việt ngay tại
     * nguồn nên không còn ở đây. Còn lại "Not signed in" của {@code NotificationController}
     * (ngoài phạm vi sửa đợt này) — giữ để câu đó không rơi xuống câu mặc định "sai mật khẩu".
     */
    private static final Map<String, String> CREDENTIAL_MESSAGES = Map.of(
            "Not signed in", MSG_SESSION_EXPIRED);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException e) {
        return body(HttpStatus.NOT_FOUND, e.getMessage(), Map.of());
    }

    /**
     * A username already taken, or a role that is still assigned being deleted.
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ConflictException e) {
        return body(HttpStatus.CONFLICT, vietnameseOr(e.getMessage(), MSG_CONFLICT), Map.of());
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
        String known = e.getMessage() == null ? null : CREDENTIAL_MESSAGES.get(e.getMessage());
        String message = known != null ? known : vietnameseOr(e.getMessage(), MSG_WRONG_CREDENTIALS);
        return body(HttpStatus.UNAUTHORIZED, message, Map.of());
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
        return body(HttpStatus.UNAUTHORIZED, MSG_SESSION_EXPIRED, Map.of());
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
        // Câu riêng tiếng Việt của service (ví dụ "chỉ được thao tác trên phiếu của đơn vị
        // mình") được giữ; "Access Denied" của Spring rơi về câu chung.
        return body(HttpStatus.FORBIDDEN, vietnameseOr(e.getMessage(), MSG_FORBIDDEN), Map.of());
    }

    /**
     * Field-level bean validation failures on a {@code @Valid} request body.
     *
     * <p>{@code errors} maps each field to a Vietnamese sentence: a message the
     * DTO wrote itself is kept, the framework's built-in English defaults
     * ("must not be blank") are translated from the constraint type.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidBody(MethodArgumentNotValidException e) {
        Map<String, Object> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(error ->
                errors.putIfAbsent(error.getField(), fieldMessage(error)));

        return body(HttpStatus.UNPROCESSABLE_CONTENT, MSG_INVALID, errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException e) {
        Map<String, Object> errors = new LinkedHashMap<>();
        if (e.getConstraintViolations() != null) {
            for (ConstraintViolation<?> violation : e.getConstraintViolations()) {
                errors.putIfAbsent(lastNode(violation.getPropertyPath()), violationMessage(violation));
            }
        }
        return body(HttpStatus.UNPROCESSABLE_CONTENT, MSG_INVALID, errors);
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
                : Map.of(e.field(), "Nằm ngoài phạm vi dữ liệu của bạn.");
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), errors);
    }

    /**
     * A row-level policy that cannot be compiled — an unknown field, an operator
     * the type does not support, a literal that will not coerce.
     *
     * <p>Raised only on the path that <em>saves</em> a policy, which is the one
     * moment somebody is present to be told. The same failure at load time is
     * quarantined instead; see {@code RowLevelPolicyCache}. Its message names
     * fields and operators on purpose — it is read by the administrator writing
     * the policy — so it is passed through as is.
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
        return body(HttpStatus.CONFLICT, MSG_IN_USE, Map.of());
    }

    /**
     * Covers the unparseable enum / id values the request DTOs reject, and the
     * services' own "this input is not acceptable" checks — which, in the ASXH
     * slices, already carry a Vietnamese sentence and are passed through.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        return body(HttpStatus.BAD_REQUEST, vietnameseOr(e.getMessage(), MSG_BAD_REQUEST), Map.of());
    }

    /** A body that is not JSON, or JSON of the wrong shape. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, MSG_BAD_REQUEST, Map.of());
    }

    /** A path or query value of the wrong type — {@code /api/x/abc} for a numeric id. */
    @ExceptionHandler(TypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(TypeMismatchException e) {
        return body(HttpStatus.BAD_REQUEST, MSG_BAD_REQUEST, Map.of());
    }

    /**
     * Everything else.
     *
     * <p>Spring's own MVC exceptions (unknown path, unsupported method, missing
     * parameter…) implement {@link ErrorResponse} and keep the status they
     * carry, with a Vietnamese sentence for it. A {@link ResponseStatusException}
     * thrown with a Vietnamese reason keeps that reason. Anything else is a bug
     * or an outage: logged in full here, answered with a 500 and a sentence that
     * tells the user what to do — never the exception's own text.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        if (e instanceof ErrorResponse errorResponse) {
            HttpStatusCode code = errorResponse.getStatusCode();
            HttpStatus status = HttpStatus.resolve(code.value());
            if (status != null && !status.is5xxServerError()) {
                String reason = e instanceof ResponseStatusException rse ? rse.getReason() : null;
                return body(status, vietnameseOr(reason, messageFor(status)), Map.of());
            }
        }
        log.error("Lỗi không lường trước khi xử lý yêu cầu", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, MSG_SERVER_ERROR, Map.of());
    }

    private static String messageFor(HttpStatus status) {
        return switch (status) {
            case NOT_FOUND -> MSG_NOT_FOUND;
            case UNAUTHORIZED -> MSG_SESSION_EXPIRED;
            case FORBIDDEN -> MSG_FORBIDDEN;
            case CONFLICT -> MSG_CONFLICT;
            case PAYLOAD_TOO_LARGE, CONTENT_TOO_LARGE -> "Dữ liệu gửi lên quá lớn.";
            case METHOD_NOT_ALLOWED, UNSUPPORTED_MEDIA_TYPE, NOT_ACCEPTABLE ->
                    "Thao tác này chưa được hệ thống hỗ trợ.";
            case UNPROCESSABLE_CONTENT -> MSG_INVALID;
            default -> MSG_BAD_REQUEST;
        };
    }

    /** One field's message: the DTO's own wording if it wrote one, else a translation. */
    private static String fieldMessage(FieldError error) {
        if (error.contains(ConstraintViolation.class)) {
            return violationMessage(error.unwrap(ConstraintViolation.class));
        }
        // A binding failure ("typeMismatch") rather than a constraint.
        return vietnameseOr(error.getDefaultMessage(), MSG_FIELD_INVALID);
    }

    /**
     * Built-in constraints ({@code @NotBlank}, {@code @Size}…) left on their
     * default message template produce English; those are translated from the
     * constraint type and its attributes. A template the code set itself is
     * assumed to be the author's own sentence and kept when it is Vietnamese.
     */
    private static String violationMessage(ConstraintViolation<?> violation) {
        String template = violation.getMessageTemplate();
        boolean builtIn = template != null
                && (template.startsWith("{jakarta.validation.constraints.")
                || template.startsWith("{org.hibernate.validator.constraints."));
        if (!builtIn) {
            return vietnameseOr(violation.getMessage(), MSG_FIELD_INVALID);
        }

        String type = violation.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName();
        Map<String, Object> attributes = violation.getConstraintDescriptor().getAttributes();
        return switch (type) {
            case "NotNull", "NotBlank", "NotEmpty" -> "Vui lòng nhập thông tin này.";
            case "Size", "Length" -> sizeMessage(attributes, violation.getInvalidValue());
            case "Email" -> "Địa chỉ email chưa đúng.";
            case "Pattern" -> "Giá trị chưa đúng định dạng.";
            case "Min", "DecimalMin" -> "Giá trị phải từ " + attributes.get("value") + " trở lên.";
            case "Max", "DecimalMax" -> "Giá trị tối đa là " + attributes.get("value") + ".";
            case "Positive" -> "Giá trị phải lớn hơn 0.";
            case "PositiveOrZero" -> "Giá trị không được nhỏ hơn 0.";
            case "Past" -> "Ngày phải trước hôm nay.";
            case "PastOrPresent" -> "Ngày không được sau hôm nay.";
            case "Future" -> "Ngày phải sau hôm nay.";
            case "FutureOrPresent" -> "Ngày không được trước hôm nay.";
            default -> MSG_FIELD_INVALID;
        };
    }

    private static String sizeMessage(Map<String, Object> attributes, Object invalidValue) {
        int min = attributes.get("min") instanceof Number n ? n.intValue() : 0;
        int max = attributes.get("max") instanceof Number n ? n.intValue() : Integer.MAX_VALUE;
        String unit = invalidValue == null || invalidValue instanceof CharSequence ? "ký tự" : "mục";
        if (max == Integer.MAX_VALUE) {
            return "Cần ít nhất %d %s.".formatted(min, unit);
        }
        if (min <= 0) {
            return "Tối đa %d %s.".formatted(max, unit);
        }
        return "Cần từ %d đến %d %s.".formatted(min, max, unit);
    }

    private static String lastNode(Path path) {
        String name = null;
        for (Path.Node node : path) {
            if (node.getName() != null) {
                name = node.getName();
            }
        }
        return name == null ? "value" : name;
    }

    /**
     * {@code message} when it is a Vietnamese sentence, else {@code fallback}.
     *
     * <p>Vietnamese with diacritics always contains a character outside ASCII
     * (đ, ă, ơ, the tone marks); an English sentence or a technical string
     * never does. That is the whole test — crude, but it is exactly the line
     * between "a feature wrote this for the user" and "this leaked through".
     */
    static String vietnameseOr(String message, String fallback) {
        if (message == null || message.isBlank()) {
            return fallback;
        }
        return message.chars().anyMatch(c -> c > 127) ? message : fallback;
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
