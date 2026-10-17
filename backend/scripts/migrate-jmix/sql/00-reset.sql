-- =============================================================================
-- 00-reset.sql — dọn database ĐÍCH trước khi chép (chạy trong cùng MỘT transaction
-- với các bước sau; lỗi ở bất kỳ đâu thì rollback sạch, database giữ nguyên).
--
-- Xoá: toàn bộ dữ liệu nghiệp vụ ASXH (asxh_*) — gồm dữ liệu demo do Liquibase seed
-- (101 đơn vị, 103 lịch/kỳ, 112–115 mẫu, 123 phiếu demo) hoặc dữ liệu của lần chuyển
-- trước; tài khoản do lần chuyển trước tạo; tài khoản dev gắn đơn vị demo (167).
-- GIỮ: bảng hệ thống của base (roles, permissions, role_permissions, admin, manager,
-- viewer, organizations, departments, blog, tasks…) và vai trò ASXH seed ở 165.
--
-- {{TARGET_DB}} do migrate.py thay bằng tên database đích.
-- =============================================================================

-- Chốt chặn: chỉ chạy trên đúng database đích đã chỉ định.
DO $$
BEGIN
    IF current_database() <> '{{TARGET_DB}}' THEN
        RAISE EXCEPTION 'Sai database đích: đang ở %, cần {{TARGET_DB}}', current_database();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM databasechangelog WHERE id = '166-add-user-report-unit') THEN
        RAISE EXCEPTION 'Database % chưa dựng schema của app (thiếu changeset 166) — chạy backend một lần trước', current_database();
    END IF;
END $$;

-- Bảng tra id cũ (UUID Jmix) → id mới (bigint). Giữ lại sau khi chuyển để đối soát.
CREATE TABLE IF NOT EXISTS public.migration_id_map (
    source_table varchar(64)  NOT NULL,   -- bảng Jmix (hoặc "khoá ghép" mô tả trong README)
    source_uuid  uuid,                    -- id UUID bên Jmix (null nếu nguồn không có UUID riêng)
    source_key   varchar(255),            -- khoá chữ khi nguồn không phải một dòng UUID (vd mã biểu BM-000001)
    target_table varchar(64)  NOT NULL,
    target_id    bigint       NOT NULL,
    created      boolean      NOT NULL DEFAULT true, -- false = gộp vào dòng sẵn có (vd tài khoản admin)
    migrated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_migration_id_map_uuid ON public.migration_id_map (source_table, source_uuid) WHERE source_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_migration_id_map_key ON public.migration_id_map (source_table, source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_migration_id_map_target ON public.migration_id_map (target_table, target_id);
COMMENT ON TABLE public.migration_id_map IS 'Tra id Jmix (report-stc-dn) → id bản React/Spring; sinh bởi backend/scripts/migrate-jmix';

-- Tài khoản do lần chuyển trước TẠO (không đụng tài khoản gộp như admin).
CREATE TEMP TABLE tmp_users_to_drop ON COMMIT DROP AS
SELECT target_id AS id FROM public.migration_id_map
WHERE source_table = 'rf_user' AND target_table = 'users' AND created
UNION
-- Tài khoản gắn đơn vị (dev 167 gắn đơn vị demo, hoặc tài khoản đơn vị lần chuyển trước):
-- đơn vị sắp bị xoá nên tài khoản đơn vị phải đi theo.
SELECT id FROM users WHERE report_unit_id IS NOT NULL;

DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM tmp_users_to_drop);
DELETE FROM user_roles     WHERE user_id IN (SELECT id FROM tmp_users_to_drop);
DELETE FROM users          WHERE id      IN (SELECT id FROM tmp_users_to_drop);
UPDATE users SET report_unit_id = NULL WHERE report_unit_id IS NOT NULL;

TRUNCATE public.migration_id_map;

-- Dữ liệu nghiệp vụ ASXH: bảng con trước, bảng cha sau. Tự tham chiếu RESTRICT thì
-- gỡ liên kết trước khi xoá.
DELETE FROM asxh_ledger_entries;
DELETE FROM asxh_ledger_write_audits;
DELETE FROM asxh_input_report_attachments;
DELETE FROM asxh_input_report_treasury_confirmations;
DELETE FROM asxh_dept_ledger_audits;
DELETE FROM asxh_dept_ledger_lines;
DELETE FROM asxh_dept_changes;
DELETE FROM asxh_dept_report_sources;
DELETE FROM asxh_dept_report_sheets;
DELETE FROM asxh_dept_reports;
DELETE FROM asxh_dept_ledger_years;
DELETE FROM asxh_summary_snapshots;
DELETE FROM asxh_annual_report_attachments;
DELETE FROM asxh_annual_report_sheets;
DELETE FROM asxh_annual_reports;
DELETE FROM asxh_indicator_measures;
DELETE FROM asxh_input_report_sheets;
UPDATE asxh_input_reports SET previous_revision_id = NULL WHERE previous_revision_id IS NOT NULL;
DELETE FROM asxh_input_reports;
DELETE FROM asxh_publications;
DELETE FROM asxh_period_assignments;
UPDATE asxh_template_versions SET previous_version_id = NULL WHERE previous_version_id IS NOT NULL;
DELETE FROM asxh_template_versions;
DELETE FROM asxh_templates;
DELETE FROM asxh_template_sets;
DELETE FROM asxh_report_periods;
DELETE FROM asxh_report_calendars;
UPDATE asxh_report_units SET parent_id = NULL WHERE parent_id IS NOT NULL;
DELETE FROM asxh_report_units;

-- Bản sao thô dữ liệu Jmix (dựng lại mỗi lần chạy).
DROP SCHEMA IF EXISTS jmix_ref CASCADE;
CREATE SCHEMA jmix_ref;
COMMENT ON SCHEMA jmix_ref IS 'Bản sao thô các bảng Jmix (report-stc-dn) — tham chiếu/đối soát; bảng chưa có chỗ trong bản mới (tiêu chí, loại đối tượng…) nằm ở đây';

CREATE EXTENSION IF NOT EXISTS dblink;
