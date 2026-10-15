package com.dth.frw.domain.system.notification;

import com.dth.frw.domain.security.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Something the application wants one person to know about.
 *
 * <p>Addressed to exactly one account. A notification meant for a group is that
 * many rows, deliberately: read state is per person, so a shared row would have
 * to grow a join table to record who had seen it, and the first feature that
 * wanted to delete one person's copy would be stuck.
 *
 * <p>The row is the record; the WebSocket is only the delivery. Whoever was
 * offline when this was raised finds it here on their next sign-in.
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Lazy, unlike the associations in the security model: nothing that reads a
    // notification wants the recipient's row. Every query is already filtered
    // to one account, so loading that account again per row would be N queries
    // to re-read something the caller supplied.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationLevel level = NotificationLevel.INFO;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 2000)
    private String body;

    /** A frontend route to open, or null when there is nothing to open. */
    @Column(length = 500)
    private String link;

    /** Null until read — the timestamp answers both "is it read" and "when". */
    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Notification() {
        // for JPA
    }

    public Notification(User recipient, NotificationLevel level, String title, String body, String link) {
        this.recipient = recipient;
        this.level = level == null ? NotificationLevel.INFO : level;
        this.title = title;
        this.body = body;
        this.link = link;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public boolean isRead() {
        return readAt != null;
    }

    /**
     * Marks this read, once.
     *
     * <p>Re-reading something does not move the timestamp: the question it
     * answers is when it was first seen, and the bell will happily send the
     * same id again as the list re-renders.
     */
    public void markRead(Instant when) {
        if (readAt == null) {
            readAt = when;
        }
    }

    public Long getId() {
        return id;
    }

    public User getRecipient() {
        return recipient;
    }

    public NotificationLevel getLevel() {
        return level;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getLink() {
        return link;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Notification notification)) {
            return false;
        }
        return id != null && id.equals(notification.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
