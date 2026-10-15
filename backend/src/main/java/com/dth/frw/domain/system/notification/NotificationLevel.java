package com.dth.frw.domain.system.notification;

/**
 * How much attention a notification is asking for.
 *
 * <p>Four values and no more. This is what the bell turns into an icon and a
 * colour, so it is about presentation, not about which feature raised the
 * notification — that belongs in the title and the link. Keeping it coarse is
 * what stops this enum growing a case per feature and needing a migration
 * every time the application learns to tell somebody something new.
 */
public enum NotificationLevel {

    /** Something happened that is worth knowing. The default. */
    INFO,

    /** Something finished, and it worked. */
    SUCCESS,

    /** Something needs attention before it becomes a problem. */
    WARNING,

    /** Something failed. */
    ERROR
}
