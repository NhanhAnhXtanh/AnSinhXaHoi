package com.dth.frw.module.system.notification.repo;

import com.dth.frw.domain.system.notification.Notification;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository
        extends JpaRepository<Notification, Long>, JpaSpecificationExecutor<Notification> {

    /** The number on the bell. Answered by the recipient/created index. */
    long countByRecipientIdAndReadAtIsNull(Long recipientId);

    /** What the bell's dropdown shows, newest first. */
    List<Notification> findTop20ByRecipientIdOrderByCreatedAtDescIdDesc(Long recipientId);

    /**
     * Marks everything unread as read, in one statement.
     *
     * <p>Loading the rows to set a field on each would be one query plus one
     * update per row for something that is a single {@code WHERE} clause. The
     * cost of the shortcut is that the persistence context does not know what
     * changed, so nothing may rely on entities read earlier in the same
     * transaction still being accurate.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Notification n set n.readAt = :when where n.recipient.id = :recipientId and n.readAt is null")
    int markAllRead(@Param("recipientId") Long recipientId, @Param("when") Instant when);
}
