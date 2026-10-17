-- =============================================================================
-- 30-verify.sql — đối soát nguồn (Jmix, đọc TRỰC TIẾP qua dblink, chỉ đọc) ↔ đích.
-- Chạy SAU khi chuyển xong (migrate.py tự gọi; chạy riêng: python migrate.py --verify-only).
-- Không ghi gì vào database nào. {{SRC_CONN}} do migrate.py thay.
-- =============================================================================
\pset footer off
SELECT dblink_connect('jmix_v', '{{SRC_CONN}}');
SELECT dblink_exec('jmix_v', 'SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');

\echo
\echo '=== 1. Số dòng nguồn (chỉ dòng còn sống) ↔ đích ==='
WITH src AS (
    SELECT * FROM dblink('jmix_v', $q$
        SELECT 'Đơn vị', (SELECT count(*) FROM qt_organization WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Lịch báo cáo', (SELECT count(*) FROM qt_report_calendar WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Kỳ báo cáo', (SELECT count(*) FROM qt_reporting_period WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Bộ mẫu', (SELECT count(*) FROM qt_report_template WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Biểu (chuỗi sheetCode)', (SELECT count(DISTINCT s.sheet_code) FROM qt_template_sheet s JOIN qt_template_version v ON v.id = s.template_version_id WHERE v.deleted_date IS NULL AND s.deleted_date IS NULL)
        UNION ALL SELECT 'Phiên bản mẫu', (SELECT count(*) FROM qt_template_version WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Script (bản ghi → khối)', (SELECT count(*) FROM qt_template_script s JOIN qt_template_version v ON v.id = s.template_version_id WHERE s.deleted_date IS NULL AND v.deleted_date IS NULL)
        UNION ALL SELECT 'Thiết lập kỳ (ô đơn vị × biểu)', (SELECT count(*) FROM qt_report_period_scope_org so JOIN qt_report_period_scope sc ON sc.id = so.scope_id AND sc.deleted_date IS NULL JOIN qt_report_period_template pt ON pt.id = sc.period_template_id AND pt.deleted_date IS NULL)
        UNION ALL SELECT 'Đợt phát hành', (SELECT count(*) FROM qt_report_publication)
        UNION ALL SELECT 'Phiếu nhập', (SELECT count(*) FROM qt_input_report WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Tờ biểu của phiếu', (SELECT count(*) FROM qt_input_report_sheet)
        UNION ALL SELECT 'Phiếu đã tích xác nhận Kho bạc', (SELECT count(*) FROM qt_input_report WHERE treasury_confirmed AND deleted_date IS NULL)
        UNION ALL SELECT 'File đính kèm phiếu', (SELECT count(*) FROM qt_report_attachment)
        UNION ALL SELECT 'Số liệu đã duyệt (sổ cái)', (SELECT count(*) FROM qt_report_ledger)
        UNION ALL SELECT 'Nhật ký ghi số liệu', (SELECT count(*) FROM qt_script_write_audit)
        UNION ALL SELECT 'Số liệu Sở — kỳ', (SELECT count(*) FROM qt_dept_report WHERE kind = 'PERIOD')
        UNION ALL SELECT 'Số liệu Sở — biểu của kỳ', (SELECT count(*) FROM qt_dept_report_sheet s JOIN qt_dept_report d ON d.id = s.report_id WHERE d.kind = 'PERIOD')
        UNION ALL SELECT 'Số liệu Sở — dòng', (SELECT count(*) FROM qt_dept_ledger)
        UNION ALL SELECT 'Số liệu Sở — năm (bộ đếm)', (SELECT count(*) FROM qt_dept_ledger_year)
        UNION ALL SELECT 'Số liệu Sở — lịch sử', (SELECT count(*) FROM qt_dept_change)
        UNION ALL SELECT 'Số liệu Sở — nhật ký ô', (SELECT count(*) FROM qt_dept_ledger_audit)
        UNION ALL SELECT 'Số liệu Sở — phiếu nguồn', (SELECT count(*) FROM qt_dept_report_source)
        UNION ALL SELECT 'Báo cáo năm (phiếu nộp UBND)', (SELECT count(*) FROM qt_dept_report WHERE kind = 'YEAR')
        UNION ALL SELECT 'Báo cáo năm — biểu', (SELECT count(*) FROM qt_dept_report_sheet s JOIN qt_dept_report d ON d.id = s.report_id WHERE d.kind = 'YEAR')
        UNION ALL SELECT 'Báo cáo năm — file', (SELECT count(*) FROM qt_dept_report_attachment WHERE deleted_date IS NULL)
        UNION ALL SELECT 'Tài khoản', (SELECT count(*) FROM rf_user)
    $q$) AS t(nhom text, nguon bigint)
), dst AS (
    SELECT 'Đơn vị' AS nhom, (SELECT count(*) FROM asxh_report_units) AS dich
    UNION ALL SELECT 'Lịch báo cáo', (SELECT count(*) FROM asxh_report_calendars)
    UNION ALL SELECT 'Kỳ báo cáo', (SELECT count(*) FROM asxh_report_periods)
    UNION ALL SELECT 'Bộ mẫu', (SELECT count(*) FROM asxh_template_sets)
    UNION ALL SELECT 'Biểu (chuỗi sheetCode)', (SELECT count(*) FROM asxh_templates)
    UNION ALL SELECT 'Phiên bản mẫu', (SELECT count(*) FROM asxh_template_versions)
    UNION ALL SELECT 'Script (bản ghi → khối)', (SELECT coalesce(sum((length(script_text) - length(replace(script_text, '// ===== [Khối Jmix ', ''))) / length('// ===== [Khối Jmix ')), 0) FROM asxh_template_versions)
    UNION ALL SELECT 'Thiết lập kỳ (ô đơn vị × biểu)', (SELECT count(*) FROM asxh_period_assignments)
    UNION ALL SELECT 'Đợt phát hành', (SELECT count(*) FROM asxh_publications)
    UNION ALL SELECT 'Phiếu nhập', (SELECT count(*) FROM asxh_input_reports)
    UNION ALL SELECT 'Tờ biểu của phiếu', (SELECT count(*) FROM asxh_input_report_sheets)
    UNION ALL SELECT 'Phiếu đã tích xác nhận Kho bạc', (SELECT count(*) FROM asxh_input_report_treasury_confirmations WHERE confirmed)
    UNION ALL SELECT 'File đính kèm phiếu', (SELECT count(*) FROM asxh_input_report_attachments)
    UNION ALL SELECT 'Số liệu đã duyệt (sổ cái)', (SELECT count(*) FROM asxh_ledger_entries)
    UNION ALL SELECT 'Nhật ký ghi số liệu', (SELECT count(*) FROM asxh_ledger_write_audits)
    UNION ALL SELECT 'Số liệu Sở — kỳ', (SELECT count(*) FROM asxh_dept_reports)
    UNION ALL SELECT 'Số liệu Sở — biểu của kỳ', (SELECT count(*) FROM asxh_dept_report_sheets)
    UNION ALL SELECT 'Số liệu Sở — dòng', (SELECT count(*) FROM asxh_dept_ledger_lines)
    UNION ALL SELECT 'Số liệu Sở — năm (bộ đếm)', (SELECT count(*) FROM asxh_dept_ledger_years)
    UNION ALL SELECT 'Số liệu Sở — lịch sử', (SELECT count(*) FROM asxh_dept_changes)
    UNION ALL SELECT 'Số liệu Sở — nhật ký ô', (SELECT count(*) FROM asxh_dept_ledger_audits)
    UNION ALL SELECT 'Số liệu Sở — phiếu nguồn', (SELECT count(*) FROM asxh_dept_report_sources)
    UNION ALL SELECT 'Báo cáo năm (phiếu nộp UBND)', (SELECT count(*) FROM asxh_annual_reports)
    UNION ALL SELECT 'Báo cáo năm — biểu', (SELECT count(*) FROM asxh_annual_report_sheets)
    UNION ALL SELECT 'Báo cáo năm — file', (SELECT count(*) FROM asxh_annual_report_attachments)
    UNION ALL SELECT 'Tài khoản', (SELECT count(*) FROM migration_id_map WHERE source_table = 'rf_user')
)
SELECT s.nhom AS "Nhóm", s.nguon AS "Nguồn", d.dich AS "Đích",
       CASE WHEN s.nguon = d.dich THEN 'khớp' ELSE 'LỆCH' END AS "Kết quả"
FROM src s JOIN dst d USING (nhom);

\echo
\echo '=== 2. Tổng số lượng / kinh phí đã duyệt theo (kỳ, biểu): nguồn ↔ đích ==='
WITH src AS (
    SELECT * FROM dblink('jmix_v', $q$
        SELECT p.year || '-' || p.period_code, l.sheet_code, count(*), sum(l.quantity), sum(l.amount)
        FROM qt_report_ledger l JOIN qt_reporting_period p ON p.id = l.period_id
        GROUP BY 1, 2
    $q$) AS t(ky text, bieu text, so_dong bigint, sl numeric, kp numeric)
), dst AS (
    SELECT c.year_no || '-' || p.code AS ky, t.code AS bieu, count(*) AS so_dong, sum(e.quantity) AS sl, sum(e.amount) AS kp
    FROM asxh_ledger_entries e
    JOIN asxh_report_periods p ON p.id = e.period_id
    JOIN asxh_report_calendars c ON c.id = p.calendar_id
    JOIN asxh_templates t ON t.id = e.template_id
    GROUP BY 1, 2
)
SELECT coalesce(s.ky, d.ky) AS "Kỳ", coalesce(s.bieu, d.bieu) AS "Biểu",
       s.so_dong AS "Dòng nguồn", d.so_dong AS "Dòng đích",
       s.sl AS "SL nguồn", d.sl AS "SL đích", s.kp AS "KP nguồn", d.kp AS "KP đích",
       CASE WHEN s.so_dong = d.so_dong AND s.sl IS NOT DISTINCT FROM d.sl AND s.kp IS NOT DISTINCT FROM d.kp
            THEN 'khớp' ELSE 'LỆCH' END AS "Kết quả"
FROM src s FULL JOIN dst d ON d.ky = s.ky AND d.bieu = s.bieu
ORDER BY 1, 2;

\echo
\echo '=== 3. Số phiếu theo trạng thái: nguồn ↔ đích ==='
WITH src AS (
    SELECT * FROM dblink('jmix_v', $q$
        SELECT status, count(*) FROM qt_input_report WHERE deleted_date IS NULL GROUP BY 1
    $q$) AS t(status text, n bigint)
), dst AS (
    SELECT status, count(*) AS n FROM asxh_input_reports GROUP BY 1
)
SELECT coalesce(s.status, d.status) AS "Trạng thái", s.n AS "Nguồn", d.n AS "Đích",
       CASE WHEN s.n = d.n THEN 'khớp' ELSE 'LỆCH' END AS "Kết quả"
FROM src s FULL JOIN dst d ON d.status = s.status ORDER BY 1;

\echo
\echo '=== 4. dataJson của TOÀN BỘ tờ biểu (md5 nguồn ↔ đích) ==='
WITH src AS (
    SELECT * FROM dblink('jmix_v', $q$
        SELECT id, md5(workbook_draft_json::text) FROM qt_input_report_sheet
    $q$) AS t(id uuid, h text)
)
SELECT count(*) AS "Tờ biểu so", count(*) FILTER (WHERE s.h IS NOT DISTINCT FROM md5(d.data_json)) AS "Khớp",
       count(*) FILTER (WHERE s.h IS DISTINCT FROM md5(d.data_json)) AS "Lệch"
FROM src s
JOIN migration_id_map m ON m.source_table = 'qt_input_report_sheet' AND m.source_uuid = s.id
JOIN asxh_input_report_sheets d ON d.id = m.target_id;

\echo
\echo '=== 5. Năm tờ biểu ngẫu nhiên có số liệu: so chi tiết ==='
WITH pick AS (
    SELECT d.id, m.source_uuid, d.data_json
    FROM asxh_input_report_sheets d
    JOIN migration_id_map m ON m.target_table = 'asxh_input_report_sheets' AND m.target_id = d.id
    WHERE d.data_json IS NOT NULL
    ORDER BY random() LIMIT 5
)
SELECT p.id AS "Tờ đích", u.budget_code AS "Đơn vị", rp.name AS "Kỳ", t.short_name AS "Biểu",
       src.len AS "Độ dài nguồn", length(p.data_json) AS "Độ dài đích",
       CASE WHEN src.h = md5(p.data_json) THEN 'khớp' ELSE 'LỆCH' END AS "md5"
FROM pick p
JOIN asxh_input_report_sheets s ON s.id = p.id
JOIN asxh_input_reports r ON r.id = s.report_id
JOIN asxh_report_units u ON u.id = r.unit_id
JOIN asxh_report_periods rp ON rp.id = r.period_id
JOIN asxh_templates t ON t.id = s.template_id
CROSS JOIN LATERAL dblink('jmix_v', format(
    'SELECT length(workbook_draft_json::text), md5(workbook_draft_json::text) FROM qt_input_report_sheet WHERE id = %L',
    p.source_uuid)) AS src(len int, h text);

\echo
\echo '=== 6. Workbook mẫu (md5 nguồn ↔ đích) ==='
WITH src AS (
    SELECT * FROM dblink('jmix_v', $q$
        SELECT template_version_id, md5(workbook_json::text) FROM qt_template_sheet WHERE deleted_date IS NULL
    $q$) AS t(id uuid, h text)
)
SELECT count(*) AS "Phiên bản so", count(*) FILTER (WHERE s.h = md5(v.workbook_json)) AS "Khớp"
FROM src s
JOIN migration_id_map m ON m.source_table = 'qt_template_version' AND m.source_uuid = s.id
JOIN asxh_template_versions v ON v.id = m.target_id;

\echo
\echo '=== 7. Tài khoản sau chuyển ==='
SELECT u.username AS "Tên đăng nhập", u.full_name AS "Họ tên", u.status AS "Trạng thái",
       ru.budget_code AS "Đơn vị", string_agg(r.code, ', ' ORDER BY r.code) AS "Vai trò",
       p.note AS "Mật khẩu"
FROM migration_id_map m
JOIN users u ON u.id = m.target_id
LEFT JOIN asxh_report_units ru ON ru.id = u.report_unit_id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
LEFT JOIN jmix_ref.migrated_user_password p ON p.username = u.username
WHERE m.source_table = 'rf_user'
GROUP BY 1, 2, 3, 4, 6 ORDER BY 1;

SELECT dblink_disconnect('jmix_v');
