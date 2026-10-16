package com.dth.frw.module.asxh.template.security;

/**
 * Mã quyền của phân hệ mẫu biểu, seed bởi {@code 111-seed-asxh-template-permissions.sql}.
 *
 * <p>Cùng khuôn {@code resource:action} như {@code shared.security.Permissions}
 * (nửa trước là tên resource đúng như frontend khai báo), nhưng khai báo trong
 * slice của mình thay vì sửa lớp dùng chung của base.
 *
 * <p>Các thao tác ban hành / khoá / mở khoá / thu hồi / tạo phiên bản kế tiếp
 * dùng quyền {@code write} của resource tương ứng — vẫn ba hành động mà nhà
 * cung cấp quyền của frontend tự suy ra được.
 */
public final class TemplatePermissions {

    public static final String TEMPLATE_SETS_READ = "template_sets:read";
    public static final String TEMPLATE_SETS_WRITE = "template_sets:write";
    public static final String TEMPLATE_SETS_DELETE = "template_sets:delete";

    public static final String TEMPLATES_READ = "templates:read";
    public static final String TEMPLATES_WRITE = "templates:write";
    public static final String TEMPLATES_DELETE = "templates:delete";

    public static final String TEMPLATE_VERSIONS_READ = "template_versions:read";
    public static final String TEMPLATE_VERSIONS_WRITE = "template_versions:write";
    public static final String TEMPLATE_VERSIONS_DELETE = "template_versions:delete";

    private TemplatePermissions() {
    }
}
