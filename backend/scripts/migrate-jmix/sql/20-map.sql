-- =============================================================================
-- 20-map.sql — chép dữ liệu từ jmix_ref.* (bản sao thô vừa nạp qua dblink) sang các
-- bảng của bản React/Spring. Chạy sau 00-reset.sql và phần nạp jmix_ref do migrate.py
-- sinh, trong CÙNG một transaction.
--
-- Cách cấp id: mỗi bảng đích được cấp id tuần tự (row_number theo thứ tự ổn định), ghi
-- vào migration_id_map TRƯỚC, rồi chèn với id tường minh. Cuối file đặt lại sequence
-- identity = max(id) + 1. Nhờ vậy chạy lại cho ra đúng cùng một bộ id.
--
-- Dòng Jmix đã xoá mềm (deleted_date khác null) KHÔNG chuyển (bản mới không có xoá
-- mềm) — vẫn còn trong jmix_ref để tra.
-- =============================================================================

-- Tra nhanh id mới theo UUID cũ.
CREATE OR REPLACE FUNCTION pg_temp.mid(p_table text, p_uuid uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT target_id FROM public.migration_id_map WHERE source_table = p_table AND source_uuid = p_uuid
$$;

-- -----------------------------------------------------------------------------
-- 1. Đơn vị: qt_organization → asxh_report_units
-- -----------------------------------------------------------------------------
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_organization', o.id, 'asxh_report_units',
       row_number() OVER (ORDER BY (o.parent_id IS NOT NULL), o.org_type, o.code)
FROM jmix_ref.qt_organization o
WHERE o.deleted_date IS NULL;

INSERT INTO asxh_report_units (id, budget_code, name, parent_id, unit_type, block, active,
                               receives_reports, created_at, updated_at)
SELECT m.target_id, o.code, o.name, pg_temp.mid('qt_organization', o.parent_id),
       CASE o.org_type WHEN 'XA' THEN 'UBND_XA' WHEN 'SO' THEN 'SO' WHEN 'TRUONG' THEN 'TRUONG'
                       WHEN 'TINH' THEN 'TINH' ELSE 'KHAC' END,
       CASE o.org_type WHEN 'XA' THEN 'XA' ELSE 'TINH' END,
       o.active, o.reporting_enabled, coalesce(o.created_date, now()), o.last_modified_date
FROM jmix_ref.qt_organization o
JOIN migration_id_map m ON m.source_table = 'qt_organization' AND m.source_uuid = o.id;

-- -----------------------------------------------------------------------------
-- 2. Lịch + kỳ: qt_report_calendar / qt_reporting_period
-- -----------------------------------------------------------------------------
-- Kỳ còn sống, kèm loại kỳ mới và số ngày hạn nộp của từng kỳ (hạn - ngày cuối kỳ).
CREATE TEMP TABLE tmp_period ON COMMIT DROP AS
SELECT p.*,
       CASE p.period_type WHEN 'MONTH' THEN 'THANG' WHEN 'QUARTER' THEN 'QUY'
                          WHEN 'HALF_YEAR' THEN 'SAU_THANG' WHEN 'YEAR' THEN 'NAM' END AS kind_new,
       (p.open_to - p.period_to) AS gap_days
FROM jmix_ref.qt_reporting_period p
WHERE p.deleted_date IS NULL AND p.calendar_id IS NOT NULL
  AND p.period_type IN ('MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR');

-- Số ngày hạn nộp của lịch = giá trị gặp nhiều nhất trong các kỳ (Jmix không lưu ở lịch).
CREATE TEMP TABLE tmp_calendar ON COMMIT DROP AS
SELECT c.*,
       coalesce((SELECT least(greatest(g.gap_days, 1), 365) FROM tmp_period g
                 WHERE g.calendar_id = c.id AND g.gap_days IS NOT NULL
                 GROUP BY g.gap_days ORDER BY count(*) DESC, g.gap_days LIMIT 1), 5) AS deadline_days,
       coalesce((SELECT string_agg(k, ',' ORDER BY ord) FROM (
                    SELECT DISTINCT g.kind_new AS k,
                           array_position(ARRAY['THANG','QUY','SAU_THANG','NAM'], g.kind_new) AS ord
                    FROM tmp_period g WHERE g.calendar_id = c.id) x), '') AS kinds
FROM jmix_ref.qt_report_calendar c
WHERE c.deleted_date IS NULL;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_calendar', c.id, 'asxh_report_calendars', row_number() OVER (ORDER BY c.year_no)
FROM tmp_calendar c;

INSERT INTO asxh_report_calendars (id, year_no, deadline_days, kinds, created_at, updated_at)
SELECT pg_temp.mid('qt_report_calendar', c.id), c.year_no, c.deadline_days, c.kinds,
       coalesce(c.created_date, now()), c.last_modified_date
FROM tmp_calendar c;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_reporting_period', p.id, 'asxh_report_periods',
       row_number() OVER (ORDER BY p.year, array_position(ARRAY['THANG','QUY','SAU_THANG','NAM'], p.kind_new), p.seq)
FROM tmp_period p
JOIN tmp_calendar c ON c.id = p.calendar_id;

INSERT INTO asxh_report_periods (id, calendar_id, kind, seq, code, name, from_date, to_date,
                                 open_from, deadline, status, created_at, updated_at, deadline_manual)
SELECT pg_temp.mid('qt_reporting_period', p.id), pg_temp.mid('qt_report_calendar', p.calendar_id),
       p.kind_new, p.seq,
       CASE p.kind_new WHEN 'THANG' THEN 'T' || p.seq WHEN 'QUY' THEN 'Q' || p.seq
                       WHEN 'SAU_THANG' THEN CASE WHEN p.seq = 1 THEN '6TĐN' ELSE '6TCN' END ELSE 'NAM' END,
       CASE p.kind_new WHEN 'THANG' THEN 'Tháng ' || p.seq || '/' || p.year
                       WHEN 'QUY' THEN 'Quý ' || (ARRAY['I','II','III','IV'])[p.seq] || '/' || p.year
                       WHEN 'SAU_THANG' THEN CASE WHEN p.seq = 1 THEN '6 tháng đầu năm ' ELSE '6 tháng cuối năm ' END || p.year
                       ELSE 'Năm ' || p.year END,
       p.period_from, p.period_to, p.open_from, p.open_to, p.status,
       coalesce(p.created_date, now()), p.last_modified_date,
       (p.open_to IS DISTINCT FROM p.period_to + c.deadline_days)
FROM tmp_period p
JOIN tmp_calendar c ON c.id = p.calendar_id;

-- -----------------------------------------------------------------------------
-- 3. Mẫu biểu: bộ mẫu → biểu (chuỗi theo sheetCode) → phiên bản (workbook + script)
-- -----------------------------------------------------------------------------
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_template', t.id, 'asxh_template_sets', row_number() OVER (ORDER BY t.created_date, t.code)
FROM jmix_ref.qt_report_template t
WHERE t.deleted_date IS NULL;

INSERT INTO asxh_template_sets (id, name, description, created_at, updated_at)
SELECT pg_temp.mid('qt_report_template', t.id), t.name, NULL, coalesce(t.created_date, now()), t.last_modified_date
FROM jmix_ref.qt_report_template t
WHERE t.deleted_date IS NULL;

-- Phiên bản còn sống (phiên bản + tờ biểu của nó đều chưa xoá mềm, bộ mẫu chưa xoá).
-- Bản Jmix đã chốt "một phiên bản đúng một tờ biểu".
CREATE TEMP TABLE tmp_version ON COMMIT DROP AS
SELECT v.*, s.id AS sheet_id, s.sheet_code, s.report_type, s.name AS sheet_name,
       s.workbook_json AS sheet_workbook
FROM jmix_ref.qt_template_version v
JOIN jmix_ref.qt_template_sheet s ON s.template_version_id = v.id AND s.deleted_date IS NULL
JOIN jmix_ref.qt_report_template t ON t.id = v.template_id AND t.deleted_date IS NULL
WHERE v.deleted_date IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tmp_version GROUP BY id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Có phiên bản Jmix mang nhiều hơn một tờ biểu — bản mới không chứa được';
    END IF;
    IF EXISTS (SELECT 1 FROM tmp_version GROUP BY sheet_code HAVING count(DISTINCT template_id) > 1) THEN
        RAISE EXCEPTION 'Một mã biểu (sheetCode) xuất hiện ở hai bộ mẫu — mã biểu bản mới phải duy nhất';
    END IF;
END $$;

-- Biểu = chuỗi phiên bản theo sheetCode; tên / loại lấy theo phiên bản mới nhất.
CREATE TEMP TABLE tmp_series ON COMMIT DROP AS
SELECT DISTINCT ON (v.sheet_code)
       v.sheet_code, v.template_id,
       left(coalesce(nullif(trim(v.report_type), ''), nullif(trim(v.name), ''), v.sheet_code), 32) AS short_name,
       left(v.sheet_name, 500) AS name,
       CASE v.kind WHEN 'YEAR_SUMMARY' THEN 'TONG_HOP' ELSE 'CHI_TIET' END AS kind,
       (SELECT min(x.created_date) FROM tmp_version x WHERE x.sheet_code = v.sheet_code) AS created_date,
       (SELECT max(x.last_modified_date) FROM tmp_version x WHERE x.sheet_code = v.sheet_code) AS last_modified_date
FROM tmp_version v
ORDER BY v.sheet_code, v.created_date DESC;

INSERT INTO migration_id_map (source_table, source_key, target_table, target_id)
SELECT 'qt_template_sheet.sheet_code', s.sheet_code, 'asxh_templates',
       row_number() OVER (ORDER BY s.template_id, s.kind, s.short_name)
FROM tmp_series s;

INSERT INTO asxh_templates (id, template_set_id, code, short_name, name, kind, sort_order, created_at, updated_at)
SELECT m.target_id, pg_temp.mid('qt_report_template', s.template_id), s.sheet_code, s.short_name, s.name, s.kind,
       row_number() OVER (PARTITION BY s.template_id ORDER BY s.kind, s.short_name),
       coalesce(s.created_date, now()), s.last_modified_date
FROM tmp_series s
JOIN migration_id_map m ON m.source_table = 'qt_template_sheet.sheet_code' AND m.source_key = s.sheet_code;

-- Script: bản mới lưu MỘT script_text mỗi phiên bản. Mỗi bản ghi qt_template_script
-- thành một khối "(function () { <mã cũ> })();" — mã cũ kết thúc bằng
-- "return defineScript({...})" nên trong hàm bọc, defineScript được gọi đúng một lần
-- mỗi khối, các hằng/hàm cấp cao của từng bản ghi không đụng nhau. Frontend
-- (compile.ts, dạng 2) và ServerScriptRunner đều gom mọi lần gọi defineScript và chạy
-- theo thứ tự, tương đương nhiều bản ghi xếp theo displayOrder như bản Jmix.
CREATE TEMP TABLE tmp_script_text ON COMMIT DROP AS
SELECT sc.template_version_id,
       '// Script chuyển từ bản Jmix: ' || count(*) || ' bản ghi qt_template_script, mỗi khối dưới đây là một bản ghi,'
       || E'\n// chạy theo thứ tự (displayOrder). Mỗi khối gọi defineScript({...}) đúng một lần.\n\n'
       || string_agg(
            '// ===== [Khối Jmix ' || sc.rn || '/' || sc.total || '] ' || replace(sc.name, E'\n', ' ')
            || coalesce(' — hook: ' || nullif(sc.declared_hooks, ''), '')
            || CASE WHEN sc.enabled THEN '' ELSE ' (ĐANG TẮT ở bản Jmix — đã chuyển thành chú thích)' END
            || E' =====\n'
            || CASE WHEN sc.enabled
                    THEN E'(function () {\n' || sc.code || E'\n})();\n'
                    ELSE regexp_replace(sc.code, '^', '// ', 'gn') || E'\n' END,
            E'\n' ORDER BY sc.rn) AS script_text
FROM (
    SELECT s.*,
           row_number() OVER (PARTITION BY s.template_version_id ORDER BY s.display_order, s.name, s.id) AS rn,
           count(*) OVER (PARTITION BY s.template_version_id) AS total
    FROM jmix_ref.qt_template_script s
    WHERE s.deleted_date IS NULL
) sc
GROUP BY sc.template_version_id;

INSERT INTO migration_id_map (source_table, source_uuid, source_key, target_table, target_id)
SELECT 'qt_template_version', v.id, NULL, 'asxh_template_versions',
       row_number() OVER (ORDER BY v.sheet_code, v.created_date, v.version_code)
FROM tmp_version v;

INSERT INTO asxh_template_versions (id, template_id, version_no, previous_version_id, status,
                                    effective_from, effective_to, workbook_json, script_text,
                                    published_at, published_by, revoked_at, revoked_by, created_at, updated_at)
SELECT pg_temp.mid('qt_template_version', v.id),
       t.id,
       row_number() OVER (PARTITION BY v.sheet_code ORDER BY v.created_date, v.version_code),
       pg_temp.mid('qt_template_version', v.previous_version_id),
       v.status, v.effective_from, NULL,
       coalesce(v.sheet_workbook::text, '{}'),
       coalesce(st.script_text, ''),
       v.approved_at, v.approved_by, v.revoked_at, v.revoked_by,
       coalesce(v.created_date, now()), v.last_modified_date
FROM tmp_version v
JOIN asxh_templates t ON t.code = v.sheet_code
LEFT JOIN tmp_script_text st ON st.template_version_id = v.id;

-- Mã phiên bản Jmix (PB-xxxxxx) không có cột ở bản mới: giữ trong bảng tra để đối soát.
UPDATE migration_id_map m SET source_key = v.version_code
FROM tmp_version v
WHERE m.source_table = 'qt_template_version' AND m.source_uuid = v.id;

-- effective_to: bản mới tự tính (TemplateVersionService.refreshEffectiveTo) — bản đã ban
-- hành hết hiệu lực một ngày trước bản đã ban hành kế sau; còn lại để trống.
UPDATE asxh_template_versions tv SET effective_to = x.next_from - 1
FROM (
    SELECT id, lead(effective_from) OVER (PARTITION BY template_id ORDER BY effective_from, id) AS next_from
    FROM asxh_template_versions
    WHERE status = 'PUBLISHED' AND effective_from IS NOT NULL
) x
WHERE tv.id = x.id AND x.next_from IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Thiết lập kỳ: period_template × scope × scope_org → asxh_period_assignments
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_assignment ON COMMIT DROP AS
SELECT DISTINCT ON (pg_temp.mid('qt_reporting_period', pt.period_id), pg_temp.mid('qt_organization', so.organization_id), ts.sheet_code)
       so.id AS scope_org_id,
       pg_temp.mid('qt_reporting_period', pt.period_id) AS period_id,
       pg_temp.mid('qt_organization', so.organization_id) AS unit_id,
       ts.sheet_code,
       coalesce(so.created_by, pt.created_by) AS created_by,
       coalesce(so.created_date, pt.created_date, now()) AS created_at
FROM jmix_ref.qt_report_period_scope_org so
JOIN jmix_ref.qt_report_period_scope sc ON sc.id = so.scope_id
     AND sc.deleted_date IS NULL AND sc.active AND sc.rule_ = 'INCLUDE'
JOIN jmix_ref.qt_report_period_template pt ON pt.id = sc.period_template_id
     AND pt.deleted_date IS NULL AND pt.active
JOIN jmix_ref.qt_template_sheet ts ON ts.id = pt.template_sheet_id
WHERE pg_temp.mid('qt_reporting_period', pt.period_id) IS NOT NULL
  AND pg_temp.mid('qt_organization', so.organization_id) IS NOT NULL
ORDER BY pg_temp.mid('qt_reporting_period', pt.period_id), pg_temp.mid('qt_organization', so.organization_id),
         ts.sheet_code, so.created_date;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_period_scope_org', a.scope_org_id, 'asxh_period_assignments',
       row_number() OVER (ORDER BY a.period_id, a.unit_id, a.sheet_code)
FROM tmp_assignment a;

INSERT INTO asxh_period_assignments (id, period_id, unit_id, template_id, created_by, created_at)
SELECT pg_temp.mid('qt_report_period_scope_org', a.scope_org_id), a.period_id, a.unit_id, t.id, a.created_by, a.created_at
FROM tmp_assignment a
JOIN asxh_templates t ON t.code = a.sheet_code;

-- -----------------------------------------------------------------------------
-- 5. Đợt phát hành: qt_report_publication → asxh_publications
-- -----------------------------------------------------------------------------
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_publication', p.id, 'asxh_publications', row_number() OVER (ORDER BY p.created_date, p.publication_code)
FROM jmix_ref.qt_report_publication p
WHERE pg_temp.mid('qt_reporting_period', p.period_id) IS NOT NULL;

INSERT INTO asxh_publications (id, period_id, kind, status, publication_no, unit_count, report_count,
                               sheet_count, created_by, created_at, cancelled_at)
SELECT m.target_id, pg_temp.mid('qt_reporting_period', p.period_id),
       CASE p.publication_type WHEN 'SUPPLEMENTAL' THEN 'BO_SUNG' ELSE 'LAN_DAU' END,
       CASE p.status WHEN 'PUBLISHED' THEN 'PUBLISHED' ELSE 'CANCELLED' END,
       p.publication_no,
       (SELECT count(DISTINCT i.organization_id) FROM jmix_ref.qt_report_publication_item i
         WHERE i.publication_id = p.id AND i.result_ = 'CREATED'),
       p.created_reports,
       (SELECT count(*) FROM jmix_ref.qt_report_publication_item i
         WHERE i.publication_id = p.id AND i.result_ = 'CREATED'),
       coalesce(p.published_by, p.created_by),
       coalesce(p.published_at, p.created_date, now()),
       CASE WHEN p.status <> 'PUBLISHED' THEN p.last_modified_date END
FROM jmix_ref.qt_report_publication p
JOIN migration_id_map m ON m.source_table = 'qt_report_publication' AND m.source_uuid = p.id;

-- -----------------------------------------------------------------------------
-- 6. Phiếu nhập + tờ biểu: qt_input_report / qt_input_report_sheet
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_report ON COMMIT DROP AS
SELECT r.*, nx.created_date AS next_created_date, nx.created_by AS next_created_by,
       nx.return_reason AS next_return_reason
FROM jmix_ref.qt_input_report r
LEFT JOIN jmix_ref.qt_input_report nx ON nx.previous_revision_id = r.id AND nx.deleted_date IS NULL
WHERE r.deleted_date IS NULL
  AND pg_temp.mid('qt_organization', r.org_id) IS NOT NULL
  AND pg_temp.mid('qt_reporting_period', r.period_id) IS NOT NULL
  AND pg_temp.mid('qt_report_publication', r.publication_id) IS NOT NULL;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_input_report', r.id, 'asxh_input_reports', row_number() OVER (ORDER BY r.created_date, r.revision_no, r.id)
FROM tmp_report r;

-- Jmix không lưu "trả lại lúc nào / ai trả": lấy theo phiên bản kế tiếp (Jmix tạo bản
-- kế tiếp đúng lúc Sở trả lại, người tạo là người trả) — cùng mô hình InputReportService.returnReport.
INSERT INTO asxh_input_reports (id, unit_id, period_id, publication_id, revision_no, previous_revision_id,
                                status, submitted_at, submitted_by, approved_at, approved_by,
                                returned_at, returned_by, return_reason, created_at, updated_at)
SELECT pg_temp.mid('qt_input_report', r.id),
       pg_temp.mid('qt_organization', r.org_id),
       pg_temp.mid('qt_reporting_period', r.period_id),
       pg_temp.mid('qt_report_publication', r.publication_id),
       r.revision_no, NULL, r.status,
       r.submitted_at, r.submitted_by, r.approved_at, r.approved_by,
       CASE WHEN r.next_created_date IS NOT NULL THEN r.next_created_date
            WHEN r.previous_revision_id IS NOT NULL THEN r.created_date END,
       CASE WHEN r.next_created_date IS NOT NULL THEN r.next_created_by
            WHEN r.previous_revision_id IS NOT NULL THEN r.created_by END,
       left(coalesce(r.return_reason, r.next_return_reason), 1000),
       coalesce(r.created_date, now()), r.last_modified_date
FROM tmp_report r;

UPDATE asxh_input_reports ir SET previous_revision_id = pg_temp.mid('qt_input_report', r.previous_revision_id)
FROM tmp_report r
WHERE ir.id = pg_temp.mid('qt_input_report', r.id) AND r.previous_revision_id IS NOT NULL;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_input_report_sheet', s.id, 'asxh_input_report_sheets',
       row_number() OVER (ORDER BY pg_temp.mid('qt_input_report', s.report_id), s.sheet_code)
FROM jmix_ref.qt_input_report_sheet s
WHERE pg_temp.mid('qt_input_report', s.report_id) IS NOT NULL;

-- completion: Jmix không có NOT_STARTED — tờ IN_PROGRESS chưa từng lưu bản nháp
-- (workbook_draft_json rỗng) là "chưa nhập" → NOT_STARTED.
INSERT INTO asxh_input_report_sheets (id, report_id, template_id, template_version_id, data_json, completion,
                                      completed_at, completed_by, data_updated_at, data_updated_by,
                                      version, created_at)
SELECT m.target_id, pg_temp.mid('qt_input_report', s.report_id), t.id,
       pg_temp.mid('qt_template_version', s.template_version_id),
       s.workbook_draft_json::text,
       CASE WHEN s.completion_status = 'IN_PROGRESS' AND s.workbook_draft_json IS NULL THEN 'NOT_STARTED'
            ELSE s.completion_status END,
       s.completed_at, s.completed_by,
       s.draft_updated_at, CASE WHEN s.draft_updated_at IS NOT NULL THEN s.last_modified_by END,
       s.version, coalesce(s.created_date, r.created_date, now())
FROM jmix_ref.qt_input_report_sheet s
JOIN migration_id_map m ON m.source_table = 'qt_input_report_sheet' AND m.source_uuid = s.id
JOIN jmix_ref.qt_input_report r ON r.id = s.report_id
JOIN asxh_templates t ON t.code = s.sheet_code;

-- Ô "Đã có phiếu xác nhận Kho bạc": chỉ ghi dòng cho phiếu đã tích (thiếu dòng = chưa tích).
INSERT INTO asxh_input_report_treasury_confirmations (report_id, confirmed, updated_at, updated_by)
SELECT pg_temp.mid('qt_input_report', r.id), true,
       coalesce(a.last_at, r.last_modified_date, r.created_date, now()),
       coalesce(a.last_by, r.last_modified_by)
FROM tmp_report r
LEFT JOIN LATERAL (
    SELECT max(x.created_date) AS last_at,
           (array_agg(x.created_by ORDER BY x.created_date DESC))[1] AS last_by
    FROM jmix_ref.qt_report_attachment x
    WHERE x.report_id = r.id AND x.deleted_date IS NULL
) a ON true
WHERE r.treasury_confirmed;

-- File đính kèm: chỉ chép SIÊU DỮ LIỆU. Nội dung file nằm trên đĩa máy chủ Jmix
-- (FileStorage "fs", dạng fs://yyyy/MM/dd/<uuid>.<ext>?name=...). storage_path ghi
-- "jmix-fs/yyyy/MM/dd/<uuid>.<ext>" — chép thư mục gốc FileStorage Jmix vào
-- <asxh.attachments.storage-dir>/jmix-fs/ là file mở được (xem README).
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_attachment', a.id, 'asxh_input_report_attachments', row_number() OVER (ORDER BY a.created_date, a.id)
FROM jmix_ref.qt_report_attachment a
WHERE pg_temp.mid('qt_input_report', a.report_id) IS NOT NULL
  AND a.kind = 'TREASURY_CONFIRMATION';

INSERT INTO asxh_input_report_attachments (id, report_id, kind, file_name, content_type, file_size, storage_path,
                                           created_at, created_by, deleted_at, deleted_by)
SELECT m.target_id, pg_temp.mid('qt_input_report', a.report_id), 'TREASURY_CONFIRMATION',
       left(a.file_name, 255), a.content_type, coalesce(a.file_size, 0),
       'jmix-fs/' || regexp_replace(regexp_replace(a.file_, '^fs://', ''), '\?.*$', ''),
       coalesce(a.created_date, now()), a.created_by, a.deleted_date, a.deleted_by
FROM jmix_ref.qt_report_attachment a
JOIN migration_id_map m ON m.source_table = 'qt_report_attachment' AND m.source_uuid = a.id;

-- -----------------------------------------------------------------------------
-- 7. Số liệu đã duyệt (sổ cái phiếu) + nhật ký ghi
-- -----------------------------------------------------------------------------
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_report_ledger', l.id, 'asxh_ledger_entries',
       row_number() OVER (ORDER BY pg_temp.mid('qt_input_report', l.report_id), l.sheet_code, l.order_no, l.indicator_code, l.id)
FROM jmix_ref.qt_report_ledger l
WHERE pg_temp.mid('qt_input_report', l.report_id) IS NOT NULL;

INSERT INTO asxh_ledger_entries (id, report_id, sheet_id, template_id, template_version_id, period_id, unit_id,
                                 submitter_unit_id, indicator_code, indicator_name, quantity, amount, note,
                                 order_no, source, created_at, updated_at)
SELECT m.target_id, sh.report_id, sh.id, sh.template_id, sh.template_version_id,
       pg_temp.mid('qt_reporting_period', l.period_id),
       pg_temp.mid('qt_organization', l.org_id),
       pg_temp.mid('qt_organization', coalesce(l.submitter_org_id, r.org_id)),
       l.indicator_code, l.indicator_name, l.quantity, l.amount, left(l.note, 4000), l.order_no, 'SCRIPT',
       coalesce(l.created_date, now()), l.last_modified_date
FROM jmix_ref.qt_report_ledger l
JOIN migration_id_map m ON m.source_table = 'qt_report_ledger' AND m.source_uuid = l.id
JOIN jmix_ref.qt_input_report r ON r.id = l.report_id
JOIN asxh_templates t ON t.code = l.sheet_code
JOIN asxh_input_report_sheets sh ON sh.report_id = pg_temp.mid('qt_input_report', l.report_id) AND sh.template_id = t.id;

INSERT INTO asxh_ledger_write_audits (report_id, sheet_id, template_id, template_version_id, source, result,
                                      lines_added, lines_updated, lines_removed, fail_reason, operated_at, operated_by)
SELECT pg_temp.mid('qt_input_report', a.report_id), sh.id, t.id, sh.template_version_id, 'SCRIPT', a.result,
       coalesce(a.lines_added, 0), coalesce(a.lines_updated, 0), coalesce(a.lines_removed, 0),
       left(a.fail_reason, 2000), a.operated_at, a.operated_by
FROM jmix_ref.qt_script_write_audit a
LEFT JOIN asxh_templates t ON t.code = a.sheet_code
LEFT JOIN asxh_input_report_sheets sh ON sh.report_id = pg_temp.mid('qt_input_report', a.report_id) AND sh.template_id = t.id
WHERE pg_temp.mid('qt_input_report', a.report_id) IS NOT NULL
ORDER BY a.operated_at, a.id;

-- -----------------------------------------------------------------------------
-- 8. Bản chất chỉ tiêu: qt_criterion.measure_kind → asxh_indicator_measures
--    (bảng tiêu chí đầy đủ chưa có ở bản mới — nằm ở jmix_ref.qt_criterion)
-- -----------------------------------------------------------------------------
INSERT INTO asxh_indicator_measures (indicator_code, measure_kind, note, created_at, updated_at)
SELECT DISTINCT ON (c.code) c.code, c.measure_kind, NULL, coalesce(c.created_date, now()), c.last_modified_date
FROM jmix_ref.qt_criterion c
WHERE c.deleted_date IS NULL AND c.measure_kind IS NOT NULL
  AND c.measure_kind IN ('NGUOI', 'LUOT', 'DON_GIA', 'THOI_GIAN', 'TIEN')
ORDER BY c.code, c.last_modified_date DESC NULLS LAST;

-- -----------------------------------------------------------------------------
-- 9. Số liệu Sở: qt_dept_* → asxh_dept_* (kỳ) và asxh_annual_* (báo cáo năm)
--    Jmix gộp hai thứ trong qt_dept_report (kind = PERIOD | YEAR); bản mới tách:
--    PERIOD → asxh_dept_reports, YEAR → asxh_annual_reports.
-- -----------------------------------------------------------------------------
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_dept_report', d.id, 'asxh_dept_reports', row_number() OVER (ORDER BY d.created_date, d.id)
FROM jmix_ref.qt_dept_report d
WHERE d.kind = 'PERIOD' AND pg_temp.mid('qt_reporting_period', d.period_id) IS NOT NULL;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_dept_report(YEAR)', d.id, 'asxh_annual_reports', row_number() OVER (ORDER BY d.report_year, d.revision_no)
FROM jmix_ref.qt_dept_report d
WHERE d.kind = 'YEAR' AND d.status IN ('SUBMITTED', 'APPROVED', 'RETURNED');

INSERT INTO asxh_dept_reports (id, period_id, report_year, ledger_version, source_fingerprint, source_count,
                               created_by, created_at, updated_at)
SELECT m.target_id, pg_temp.mid('qt_reporting_period', d.period_id), d.report_year, d.ledger_version,
       d.source_fingerprint, coalesce(d.source_count, 0), d.created_by, coalesce(d.created_date, now()),
       d.last_modified_date
FROM jmix_ref.qt_dept_report d
JOIN migration_id_map m ON m.source_table = 'qt_dept_report' AND m.source_uuid = d.id;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_dept_report_sheet', s.id, 'asxh_dept_report_sheets', row_number() OVER (ORDER BY pg_temp.mid('qt_dept_report', s.report_id), s.display_order, s.sheet_code)
FROM jmix_ref.qt_dept_report_sheet s
WHERE pg_temp.mid('qt_dept_report', s.report_id) IS NOT NULL;

INSERT INTO asxh_dept_report_sheets (id, report_id, template_id, template_version_id, display_order, draft_json,
                                     draft_updated_at, draft_updated_by, completion, completed_at, completed_by,
                                     revision, created_at)
SELECT m.target_id, pg_temp.mid('qt_dept_report', s.report_id), t.id,
       pg_temp.mid('qt_template_version', s.template_version_id), s.display_order,
       s.workbook_draft_json::text, s.draft_updated_at,
       CASE WHEN s.workbook_draft_json IS NOT NULL THEN s.last_modified_by END,
       CASE WHEN s.completion_status = 'COMPLETED' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
       s.completed_at, s.completed_by, s.version, coalesce(s.created_date, now())
FROM jmix_ref.qt_dept_report_sheet s
JOIN migration_id_map m ON m.source_table = 'qt_dept_report_sheet' AND m.source_uuid = s.id
JOIN asxh_templates t ON t.code = s.sheet_code;

INSERT INTO asxh_dept_report_sources (report_id, input_report_id, unit_id, period_id, revision_no, approved_at)
SELECT pg_temp.mid('qt_dept_report', s.report_id), pg_temp.mid('qt_input_report', s.input_report_id),
       pg_temp.mid('qt_organization', s.organization_id), pg_temp.mid('qt_reporting_period', s.period_id),
       s.revision_no, s.approved_at
FROM jmix_ref.qt_dept_report_source s
WHERE pg_temp.mid('qt_dept_report', s.report_id) IS NOT NULL
ORDER BY s.approved_at, s.id;

-- Báo cáo năm (phiếu nộp UBND).
-- reopened = phiếu RETURNED mà quyết định cuối cùng của UBND là "mở lại" (REOPENED).
INSERT INTO asxh_annual_reports (id, report_year, revision_no, status, ledger_version, doc_no, doc_date,
                                 submitted_at, submitted_by, decided_at, decided_by, return_reason, reopened,
                                 created_at, updated_at)
SELECT m.target_id, d.report_year, d.revision_no, d.status, d.ledger_version,
       left(coalesce(d.submission_doc_no, ''), 50),
       coalesce(d.submission_doc_date, d.submitted_at::date, d.created_date::date),
       coalesce(d.submitted_at, d.created_date, now()), d.submitted_by,
       d.ubnd_decided_at, d.ubnd_decided_by, left(d.return_reason, 1000),
       d.status = 'RETURNED' AND coalesce((
           SELECT c.action FROM jmix_ref.qt_dept_change c
           WHERE c.report_id = d.id AND c.action IN ('APPROVED', 'RETURNED', 'REOPENED')
           ORDER BY c.occurred_at DESC LIMIT 1) = 'REOPENED', false),
       coalesce(d.created_date, now()), d.last_modified_date
FROM jmix_ref.qt_dept_report d
JOIN migration_id_map m ON m.source_table = 'qt_dept_report(YEAR)' AND m.source_uuid = d.id;

INSERT INTO asxh_annual_report_sheets (report_id, template_id, template_version_id, display_order)
SELECT pg_temp.mid('qt_dept_report(YEAR)', s.report_id), t.id,
       pg_temp.mid('qt_template_version', s.template_version_id), s.display_order
FROM jmix_ref.qt_dept_report_sheet s
JOIN asxh_templates t ON t.code = s.sheet_code
WHERE pg_temp.mid('qt_dept_report(YEAR)', s.report_id) IS NOT NULL
ORDER BY 1, s.display_order;

INSERT INTO asxh_annual_report_attachments (report_id, file_name, content_type, file_size, storage_path,
                                            created_at, created_by)
SELECT pg_temp.mid('qt_dept_report(YEAR)', a.report_id), left(a.file_name, 255), a.content_type,
       coalesce(a.file_size, 0),
       'jmix-fs/' || regexp_replace(regexp_replace(a.file_, '^fs://', ''), '\?.*$', ''),
       coalesce(a.created_date, now()), a.created_by
FROM jmix_ref.qt_dept_report_attachment a
WHERE a.deleted_date IS NULL AND pg_temp.mid('qt_dept_report(YEAR)', a.report_id) IS NOT NULL
ORDER BY a.created_date;

-- Bộ đếm phiên bản năm + khoá năm (Jmix suy khoá từ phiếu năm mới nhất; bản mới lưu cột).
INSERT INTO asxh_dept_ledger_years (year_no, current_version, lock_state, lock_note, locked_at, locked_by,
                                    created_at, updated_at)
SELECT y.report_year, y.current_version,
       coalesce(CASE a.status WHEN 'SUBMITTED' THEN 'SUBMITTED' WHEN 'APPROVED' THEN 'APPROVED' END, 'OPEN'),
       CASE a.status
           WHEN 'SUBMITTED' THEN 'Báo cáo năm ' || y.report_year || ' đã nộp UBND (Phiếu ' || a.revision_no
                                 || ') và đang chờ duyệt nên chưa sửa được số liệu.'
           WHEN 'APPROVED' THEN 'UBND đã duyệt báo cáo năm ' || y.report_year || ' (Phiếu ' || a.revision_no
                                 || ') nên số liệu đã chốt, không sửa được. Muốn sửa thì UBND phải mở lại.'
       END,
       CASE a.status WHEN 'SUBMITTED' THEN a.submitted_at WHEN 'APPROVED' THEN a.ubnd_decided_at END,
       CASE a.status WHEN 'SUBMITTED' THEN a.submitted_by WHEN 'APPROVED' THEN a.ubnd_decided_by END,
       coalesce(y.last_modified_date, now()), y.last_modified_date
FROM jmix_ref.qt_dept_ledger_year y
LEFT JOIN LATERAL (
    SELECT d.* FROM jmix_ref.qt_dept_report d
    WHERE d.kind = 'YEAR' AND d.report_year = y.report_year
    ORDER BY d.revision_no DESC LIMIT 1
) a ON true;

-- Lịch sử số liệu Sở.
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id)
SELECT 'qt_dept_change', c.id, 'asxh_dept_changes', row_number() OVER (ORDER BY c.occurred_at, c.id)
FROM jmix_ref.qt_dept_change c
JOIN jmix_ref.qt_dept_report d ON d.id = c.report_id
WHERE pg_temp.mid('qt_dept_report', d.id) IS NOT NULL OR pg_temp.mid('qt_dept_report(YEAR)', d.id) IS NOT NULL;

INSERT INTO asxh_dept_changes (id, report_year, report_id, annual_ref, template_id, action, version_no,
                               row_count, note, actor, occurred_at)
SELECT m.target_id, d.report_year,
       pg_temp.mid('qt_dept_report', d.id),
       pg_temp.mid('qt_dept_report(YEAR)', d.id),
       t.id,
       CASE c.action WHEN 'PERIOD_CLOSED' THEN 'PERIOD_SAVED' WHEN 'SHEET_SAVED' THEN 'SHEET_SAVED'
                     WHEN 'SUBMITTED' THEN 'YEAR_SUBMITTED' WHEN 'APPROVED' THEN 'YEAR_APPROVED'
                     WHEN 'RETURNED' THEN 'YEAR_RETURNED' WHEN 'REOPENED' THEN 'YEAR_REOPENED'
                     ELSE c.action END,
       c.version_no, c.row_count, left(c.note, 1000), c.actor, c.occurred_at
FROM jmix_ref.qt_dept_change c
JOIN migration_id_map m ON m.source_table = 'qt_dept_change' AND m.source_uuid = c.id
JOIN jmix_ref.qt_dept_report d ON d.id = c.report_id
LEFT JOIN asxh_templates t ON t.code = c.sheet_code;

INSERT INTO asxh_dept_ledger_lines (report_id, sheet_id, unit_key, unit_id, indicator_code, indicator_name, slot,
                                    measure_kind, source_quantity, source_amount, quantity, amount, allocated_amount,
                                    adjust_reason, order_no, version_from, version_to, change_id)
SELECT pg_temp.mid('qt_dept_report', l.report_id), ds.id, l.org_key, pg_temp.mid('qt_organization', l.org_id),
       l.indicator_code, l.indicator_name, coalesce(l.slot, 'ALL'), l.measure_kind,
       l.source_quantity, l.source_amount, l.quantity, l.amount, l.allocated_amount,
       l.adjust_reason, l.order_no, l.version_from, l.version_to, pg_temp.mid('qt_dept_change', l.change_id)
FROM jmix_ref.qt_dept_ledger l
JOIN asxh_templates t ON t.code = l.sheet_code
JOIN asxh_dept_report_sheets ds ON ds.report_id = pg_temp.mid('qt_dept_report', l.report_id) AND ds.template_id = t.id
ORDER BY l.created_date, l.order_no, l.id;

INSERT INTO asxh_dept_ledger_audits (report_id, template_id, unit_key, indicator_code, slot, action,
                                     quantity_before, quantity_after, amount_before, amount_after,
                                     allocated_before, allocated_after, reason, operated_by, operated_at, change_id)
SELECT pg_temp.mid('qt_dept_report', a.report_id), t.id, a.org_key, a.indicator_code, a.slot, a.action,
       a.quantity_before, a.quantity_after, a.amount_before, a.amount_after,
       a.allocated_before, a.allocated_after, a.reason, a.operated_by, a.operated_at,
       pg_temp.mid('qt_dept_change', a.change_id)
FROM jmix_ref.qt_dept_ledger_audit a
JOIN asxh_templates t ON t.code = a.sheet_code
WHERE pg_temp.mid('qt_dept_report', a.report_id) IS NOT NULL
ORDER BY a.operated_at, a.id;

-- -----------------------------------------------------------------------------
-- 10. Tài khoản: rf_user → users, sec_role_assignment → user_roles
-- -----------------------------------------------------------------------------
-- Vai trò Jmix → vai trò bản mới (165-seed-asxh-roles.sql). Vai trò Jmix không có ở đây
-- (ui-minimal: quyền vào giao diện; officer-org-row-level: lọc theo đơn vị — bản mới làm
-- bằng users.report_unit_id) thì bỏ.
CREATE TEMP TABLE tmp_role_map (jmix_code varchar, role_code varchar) ON COMMIT DROP;
INSERT INTO tmp_role_map VALUES
    ('system-full-access',    'ADMIN'),
    ('user-officer',          'ORGANIZATION_REPORTER'),
    ('report-officer',        'REPORT_APPROVER'),
    ('report-approver',       'REPORT_APPROVER'),
    ('report-admin',          'REPORT_ADMIN'),
    ('template-admin',        'TEMPLATE_ADMIN'),
    ('dept-report-compiler',  'DEPT_REPORT_COMPILER'),
    ('dept-report-submitter', 'DEPT_REPORT_SUBMITTER'),
    ('ubnd-approver',         'UBND_APPROVER'),
    ('report-auditor',        'AUDITOR');

-- Tài khoản trùng tên đăng nhập với tài khoản sẵn có (admin) → GỘP: giữ mật khẩu,
-- email của bản mới, chỉ bổ sung vai trò.
INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id, created)
SELECT 'rf_user', u.id, 'users', x.id, false
FROM jmix_ref.rf_user u
JOIN users x ON lower(x.username) = lower(u.username);

-- Mã băm: bản Jmix lưu "{bcrypt}$2a$..." (DelegatingPasswordEncoder); bản mới dùng
-- BCryptPasswordEncoder thuần → bỏ tiền tố "{bcrypt}" là dùng được (nhận $2a/$2b/$2y).
-- Định dạng khác ({noop}, {pbkdf2}…) → mật khẩu tạm "User@123" (chuỗi băm BCrypt của
-- 005/167-seed), người dùng đổi sau.
INSERT INTO users (username, email, password_hash, full_name, status, report_unit_id, created_at)
SELECT u.username,
       CASE WHEN nullif(trim(u.email), '') IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM users e WHERE lower(e.email) = lower(trim(u.email)))
            THEN trim(u.email)
            ELSE lower(u.username) || '@dongnai.local' END,
       CASE WHEN pw.password ~ '^\{bcrypt\}\$2[aby]\$\d\d\$.{53}$' THEN substring(pw.password FROM 9)
            WHEN pw.password ~ '^\$2[aby]\$\d\d\$.{53}$' THEN pw.password
            ELSE '$2a$10$VAqCXeceitJBv.F3pGGwcehpaeGKP2.nyTe.5lFwfbmqPCS8hLSTm' END,
       coalesce(nullif(trim(CASE WHEN u.first_name = u.last_name THEN u.first_name
                                 ELSE concat_ws(' ', nullif(trim(u.first_name), ''), nullif(trim(u.last_name), '')) END), ''),
                u.username),
       CASE WHEN coalesce(u.active, true) THEN 'ACTIVE' ELSE 'INACTIVE' END,
       pg_temp.mid('qt_organization', u.org_id),
       now()
FROM jmix_ref.rf_user u
JOIN tmp_rf_user_password pw ON pw.id = u.id
WHERE NOT EXISTS (SELECT 1 FROM users x WHERE lower(x.username) = lower(u.username))
ORDER BY u.username;

INSERT INTO migration_id_map (source_table, source_uuid, target_table, target_id, created)
SELECT 'rf_user', u.id, 'users', x.id, true
FROM jmix_ref.rf_user u
JOIN users x ON x.username = u.username
WHERE NOT EXISTS (SELECT 1 FROM migration_id_map m WHERE m.source_table = 'rf_user' AND m.source_uuid = u.id);

-- Ghi lại tài khoản nào nhận mật khẩu tạm (để báo cáo).
CREATE TABLE jmix_ref.migrated_user_password (username varchar PRIMARY KEY, password_kept boolean NOT NULL, note text);
INSERT INTO jmix_ref.migrated_user_password
SELECT u.username,
       m.created AND pw.password ~ '^(\{bcrypt\})?\$2[aby]\$\d\d\$.{53}$',
       CASE WHEN NOT m.created THEN 'Gộp vào tài khoản sẵn có của bản mới — giữ mật khẩu bản mới'
            WHEN pw.password ~ '^(\{bcrypt\})?\$2[aby]\$\d\d\$.{53}$' THEN 'Giữ mật khẩu cũ (BCrypt)'
            ELSE 'Mật khẩu tạm User@123 (định dạng cũ không tương thích)' END
FROM jmix_ref.rf_user u
JOIN tmp_rf_user_password pw ON pw.id = u.id
JOIN migration_id_map m ON m.source_table = 'rf_user' AND m.source_uuid = u.id;

INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT pg_temp.mid('rf_user', u.id), r.id
FROM jmix_ref.sec_role_assignment ra
JOIN jmix_ref.rf_user u ON u.username = ra.username
JOIN tmp_role_map rm ON rm.jmix_code = ra.role_code
JOIN roles r ON r.code = rm.role_code
WHERE ra.delete_ts IS NULL AND pg_temp.mid('rf_user', u.id) IS NOT NULL
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Đặt lại sequence identity của mọi bảng ASXH = max(id) + 1
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t record;
    seq text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'id' AND is_identity = 'YES'
               AND (table_name LIKE 'asxh\_%' OR table_name = 'users')
    LOOP
        seq := pg_get_serial_sequence('public.' || quote_ident(t.table_name), 'id');
        IF seq IS NOT NULL THEN
            EXECUTE format('SELECT setval(%L, coalesce((SELECT max(id) FROM public.%I), 0) + 1, false)', seq, t.table_name);
        END IF;
    END LOOP;
END $$;
