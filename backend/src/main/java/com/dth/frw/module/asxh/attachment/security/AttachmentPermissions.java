package com.dth.frw.module.asxh.attachment.security;

/**
 * Mã quyền giấy tờ đính kèm phiếu, seed ở {@code 132-seed-asxh-ledger-permissions.sql}.
 *
 * <ul>
 *   <li>{@code input_report_attachments:read} — xem danh sách, tải về, xem ô tích Kho bạc.</li>
 *   <li>{@code input_report_attachments:write} — tải lên, tích / bỏ tích (đơn vị).</li>
 *   <li>{@code input_report_attachments:delete} — gỡ file (xoá mềm) khi phiếu còn sửa được.</li>
 * </ul>
 */
public final class AttachmentPermissions {

    public static final String ATTACHMENTS_READ = "input_report_attachments:read";
    public static final String ATTACHMENTS_WRITE = "input_report_attachments:write";
    public static final String ATTACHMENTS_DELETE = "input_report_attachments:delete";

    private AttachmentPermissions() {
    }
}
