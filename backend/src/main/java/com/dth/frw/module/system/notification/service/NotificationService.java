package com.dth.frw.module.system.notification.service;

import com.dth.frw.domain.system.notification.Notification;
import com.dth.frw.domain.system.notification.NotificationLevel;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.module.system.notification.repo.NotificationRepository;
import com.dth.frw.module.system.notification.repo.NotificationSpecifications;
import com.dth.frw.module.security.user.service.UserService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Raising notifications, and reading your own.
 *
 * <p>Two audiences, and they are worth telling apart. {@link #notify} is the
 * API the rest of the application calls — an order arrives, a job finishes, a
 * task is assigned — and it is the only way a notification comes into
 * existence. Everything else here serves the bell in the admin UI, and every
 * one of those methods is scoped to the caller.
 *
 * <h2>Scoping is an invariant, not a filter</h2>
 *
 * <p>Every read takes the recipient's id as an argument and applies it itself,
 * rather than trusting a {@code recipient} filter in the query string.
 * {@link #get} and {@link #delete} answer 404 rather than 403 for somebody
 * else's row, which is the same answer they give for a row that does not exist
 * — the id of a notification you are not allowed to see should not be
 * distinguishable from an id that was never issued.
 */
@Service
@Transactional(readOnly = true)
public class NotificationService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE = Set.of("id", "level", "title", "createdAt", "readAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final NotificationRepository repository;

    // Recipients are resolved through the user feature's own service rather
    // than its repository, so an unknown id produces the same 404 that
    // resource's endpoints would.
    private final UserService userService;

    private final ApplicationEventPublisher events;

    public NotificationService(NotificationRepository repository,
                               UserService userService,
                               ApplicationEventPublisher events) {
        this.repository = repository;
        this.userService = userService;
        this.events = events;
    }

    /**
     * Raises a notification and delivers it.
     *
     * <p>The call any feature makes. It writes the row first and announces it
     * only after the transaction commits, so a caller whose own work rolls back
     * has not told anybody about something that did not happen.
     *
     * @param link a frontend route to open, or null when there is nothing to
     *             open. A path such as {@code /blog_posts/show/3} rather than a
     *             URL: the notification does not know which host is serving the
     *             admin UI
     */
    @Transactional
    public Notification notify(Long recipientId, NotificationLevel level, String title, String body, String link) {
        User recipient = userService.get(recipientId);
        Notification saved = repository.save(
                new Notification(recipient, level, title.trim(), trimToNull(body), trimToNull(link)));

        events.publishEvent(new NotificationRaised(saved.getId(), recipient.getId()));
        return saved;
    }

    public Page<Notification> list(Long recipientId, ListParams params) {
        return repository.findAll(
                mine(recipientId).and(NotificationSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public List<Notification> getMany(Long recipientId, List<Long> ids) {
        return repository.findAll(
                mine(recipientId).and((root, query, cb) -> root.get("id").in(ids)));
    }

    /** The newest few, for the bell's dropdown. */
    public List<Notification> recent(Long recipientId) {
        return repository.findTop20ByRecipientIdOrderByCreatedAtDescIdDesc(recipientId);
    }

    public long unreadCount(Long recipientId) {
        return repository.countByRecipientIdAndReadAtIsNull(recipientId);
    }

    public Notification get(Long recipientId, Long id) {
        return repository.findOne(mine(recipientId).and((root, query, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("Notification", id));
    }

    @Transactional
    public Notification markRead(Long recipientId, Long id) {
        Notification notification = get(recipientId, id);
        notification.markRead(Instant.now());
        return repository.save(notification);
    }

    /** @return how many were still unread */
    @Transactional
    public int markAllRead(Long recipientId) {
        return repository.markAllRead(recipientId, Instant.now());
    }

    @Transactional
    public Notification delete(Long recipientId, Long id) {
        Notification notification = get(recipientId, id);
        repository.delete(notification);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return notification;
    }

    /**
     * The invariant every read is built on.
     *
     * <p>Composed with whatever the query string asked for rather than being
     * one of the things it can ask for, so no filter can widen it.
     */
    private static Specification<Notification> mine(Long recipientId) {
        return (root, query, cb) -> cb.equal(root.get("recipient").get("id"), recipientId);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
