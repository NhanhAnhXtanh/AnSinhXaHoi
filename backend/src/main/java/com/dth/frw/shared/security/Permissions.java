package com.dth.frw.shared.security;

/**
 * The permission codes seeded by {@code 005-seed-security.sql}, as constants.
 *
 * <p>These are compile-time constants so that {@code @PreAuthorize} can be
 * written as {@code hasAuthority(Permissions.USERS_WRITE)} — a typo becomes a
 * compile error instead of an endpoint that silently authorises nobody.
 *
 * <p>The code is {@code resource:action}, where the resource half is verbatim
 * the resource name the frontend declares in {@code routes.tsx}. That is not
 * cosmetic: it is what lets the admin UI's access control provider build the
 * code it needs from the resource and action it is already handed, rather than
 * carrying a second copy of this mapping that could drift.
 *
 * <p>Three actions cover the six Refine actions: {@code list}/{@code show} need
 * {@code read}, {@code create}/{@code edit}/{@code clone} need {@code write},
 * and {@code delete} needs {@code delete}.
 */
public final class Permissions {

    public static final String USERS_READ = "users:read";
    public static final String USERS_WRITE = "users:write";
    public static final String USERS_DELETE = "users:delete";

    public static final String ROLES_READ = "roles:read";
    public static final String ROLES_WRITE = "roles:write";
    public static final String ROLES_DELETE = "roles:delete";

    public static final String PERMISSIONS_READ = "permissions:read";

    public static final String BLOG_POSTS_READ = "blog_posts:read";
    public static final String BLOG_POSTS_WRITE = "blog_posts:write";
    public static final String BLOG_POSTS_DELETE = "blog_posts:delete";

    public static final String CATEGORIES_READ = "categories:read";
    public static final String CATEGORIES_WRITE = "categories:write";
    public static final String CATEGORIES_DELETE = "categories:delete";

    public static final String ORGANIZATIONS_READ = "organizations:read";
    public static final String ORGANIZATIONS_WRITE = "organizations:write";
    public static final String ORGANIZATIONS_DELETE = "organizations:delete";

    public static final String DEPARTMENTS_READ = "departments:read";
    public static final String DEPARTMENTS_WRITE = "departments:write";
    public static final String DEPARTMENTS_DELETE = "departments:delete";

    // Not scoped to the caller, unlike the notification codes below: a task
    // list is a shared board, so TASKS_READ means "see the work" and narrowing
    // it to one person is what the assignee filter is for.
    public static final String TASKS_READ = "tasks:read";
    public static final String TASKS_WRITE = "tasks:write";
    public static final String TASKS_DELETE = "tasks:delete";

    // ADMIN only, and 016 spells that out rather than joining: editing a data
    // scope is editing the security model, so it is not a grant to hand around.
    // There is deliberately no row-level scope on the policy table itself --
    // deciding which policies you may see would need the policies you may see.
    public static final String ROW_LEVEL_POLICIES_READ = "row_level_policies:read";
    public static final String ROW_LEVEL_POLICIES_WRITE = "row_level_policies:write";
    public static final String ROW_LEVEL_POLICIES_DELETE = "row_level_policies:delete";

    // Granted to every system role, unlike everything above. They gate the bell,
    // not access to anybody else's rows: every notification endpoint is scoped
    // to the caller. There is no notifications:write -- nobody edits a
    // notification, the application raises one, and the endpoint that raises one
    // for somebody else needs USERS_WRITE because that is what it really does.
    public static final String NOTIFICATIONS_READ = "notifications:read";
    public static final String NOTIFICATIONS_DELETE = "notifications:delete";

    private Permissions() {
    }
}
