package com.dth.frw.module.asxh.ledger.security;

/**
 * Mã quyền của slice số liệu đã lưu + đính kèm + khoá/huỷ phiếu, seed ở
 * {@code 132-seed-asxh-ledger-permissions.sql}.
 *
 * <ul>
 *   <li>{@code input_reports:lock} — khoá phiếu đã phê duyệt (UC-47).</li>
 *   <li>{@code input_reports:cancel} — huỷ phiếu đang nhập / bị trả lại (UC-47).</li>
 *   <li>{@code input_report_attachments:*} — xem {@code AttachmentPermissions}.</li>
 *   <li>{@code ledger_entries:read} — xem số liệu đã lưu của phiếu.</li>
 *   <li>{@code ledger_entries:import} — nạp số liệu BHXH vào phiếu (UC-49).</li>
 * </ul>
 */
public final class LedgerPermissions {

    public static final String INPUT_REPORTS_LOCK = "input_reports:lock";
    public static final String INPUT_REPORTS_CANCEL = "input_reports:cancel";

    public static final String LEDGER_ENTRIES_READ = "ledger_entries:read";
    public static final String LEDGER_ENTRIES_IMPORT = "ledger_entries:import";

    private LedgerPermissions() {
    }
}
