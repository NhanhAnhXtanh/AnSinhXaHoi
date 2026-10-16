package com.dth.frw.module.asxh.setup.security;

/**
 * Mã quyền của slice thiết lập kỳ + đợt phát hành, seed ở {@code 122-seed-report-permissions.sql}.
 *
 * <p>Để riêng ở slice thay vì thêm vào {@code shared/security/Permissions} vì ba agent backend
 * viết song song; điều phối có thể dời vào đó sau. Hằng số biên dịch để
 * {@code @PreAuthorize} gõ sai là lỗi biên dịch.
 *
 * <p>{@code publications:write} gom mọi thao tác điều hành đợt (mở đợt, mở đợt bổ sung, chốt,
 * gia hạn, thu hồi) — bản Jmix tách thành nhiều quyền nhỏ ({@code reportPeriod.publish},
 * {@code .close}, {@code .withdraw}…); tách lại khi BA chốt phân vai.
 */
public final class SetupPermissions {

    public static final String PERIOD_ASSIGNMENTS_READ = "period_assignments:read";
    public static final String PERIOD_ASSIGNMENTS_WRITE = "period_assignments:write";

    public static final String PUBLICATIONS_READ = "publications:read";
    public static final String PUBLICATIONS_WRITE = "publications:write";

    private SetupPermissions() {
    }
}
