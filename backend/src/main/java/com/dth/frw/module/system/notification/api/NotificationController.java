package com.dth.frw.module.system.notification.api;

import com.dth.frw.domain.system.notification.Notification;
import com.dth.frw.module.system.notification.api.dto.NotificationRequest;
import com.dth.frw.module.system.notification.api.dto.NotificationResponse;
import com.dth.frw.module.system.notification.api.dto.UnreadCountResponse;
import com.dth.frw.module.system.notification.service.NotificationService;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.Permissions;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/notifications} — the {@code notifications} resource of the admin UI.
 *
 * <p>Answers the data provider's dialect like every other resource, so the list
 * can be a normal table with normal filters. What is different is that
 * <em>every</em> endpoint is scoped to the caller: there is no
 * {@code recipientId} in any path or query, and no permission that lets one
 * account read another's. "Your notifications" is the whole resource.
 *
 * <p>{@code notifications:read} is granted to all three system roles, and it
 * gates the bell rather than access to anyone else's rows — an account that
 * could not read its own notifications would simply never be told anything.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    /**
     * Serves both {@code getList} and {@code getMany}, as the other resources do.
     *
     * <p>{@code ?read=false} is the filter the bell uses.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public ResponseEntity<List<NotificationResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        long me = currentUserId();
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<NotificationResponse> rows = service.getMany(me, ids).stream()
                    .map(NotificationResponse::from)
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<Notification> page = service.list(me, params);
        return ListResponse.of(page.map(NotificationResponse::from).getContent(), page.getTotalElements());
    }

    /**
     * The newest few and nothing else — what the bell's dropdown renders.
     *
     * <p>Separate from the list endpoint rather than a page of it, because the
     * dropdown is not a table: it takes no filters, no sort and no window, and
     * expressing "the newest twenty" as list parameters would let a client ask
     * for something else by editing them.
     */
    @GetMapping("/recent")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public List<NotificationResponse> recent() {
        return service.recent(currentUserId()).stream()
                .map(NotificationResponse::from)
                .toList();
    }

    /** The number on the bell. */
    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public UnreadCountResponse unreadCount() {
        return new UnreadCountResponse(service.unreadCount(currentUserId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public NotificationResponse get(@PathVariable Long id) {
        return NotificationResponse.from(service.get(currentUserId(), id));
    }

    /**
     * Raises a notification for somebody else.
     *
     * <p>Guarded by {@code users:write} rather than a {@code notifications:*}
     * code, and that is the honest mapping: this is the one endpoint here that
     * reaches another account, so what it needs is the permission to act on
     * other people's accounts. A {@code notifications:write} granted to
     * everyone — as {@code notifications:read} is — would let any signed-in user
     * send anything to anyone.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('" + Permissions.USERS_WRITE + "')")
    public ResponseEntity<NotificationResponse> create(@Valid @RequestBody NotificationRequest request) {
        Notification created = service.notify(
                request.recipientId(), request.level(), request.title(), request.body(), request.link());
        return ResponseEntity
                .created(URI.create("/api/notifications/" + created.getId()))
                .body(NotificationResponse.from(created));
    }

    /**
     * Marks one as read.
     *
     * <p>A {@code POST} to a sub-path rather than a {@code PATCH} of a
     * {@code read} field, for the same reason setting a password is its own
     * endpoint: it is the only mutation a recipient may make, and modelling it
     * as a partial update would imply the rest of the row is editable too.
     */
    @PostMapping("/{id}/read")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public NotificationResponse markRead(@PathVariable Long id) {
        return NotificationResponse.from(service.markRead(currentUserId(), id));
    }

    /** Clears the bell in one call rather than one call per row. */
    @PostMapping("/read-all")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public Map<String, Object> markAllRead() {
        return Map.of("marked", service.markAllRead(currentUserId()));
    }

    /** Echoes the deleted row — the data provider parses the response body. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_DELETE + "')")
    public NotificationResponse delete(@PathVariable Long id) {
        return NotificationResponse.from(service.delete(currentUserId(), id));
    }

    /**
     * The account every endpoint here is scoped to.
     *
     * <p>Read from the validated token, never from a parameter. The moment a
     * recipient could be named in a request, "your notifications" would become
     * "anyone's notifications" for whoever edits the URL.
     */
    private static long currentUserId() {
        return CurrentUser.id().orElseThrow(() -> new BadCredentialsException("Not signed in"));
    }
}
