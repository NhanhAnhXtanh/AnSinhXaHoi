--liquibase formatted sql

--changeset dth:101-seed-report-units
--comment Quyền của resource report_units, cấp cho các role, và dữ liệu mẫu đơn vị Đồng Nai.

-- Cùng khuôn "resource:action" với 010: nửa resource là tên resource frontend khai
-- trong routes.tsx. system_permission = TRUE vì mã đến cùng @PreAuthorize kiểm nó.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('report_units:read',   'Xem đơn vị báo cáo',        'Xem danh sách và chi tiết đơn vị báo cáo',      TRUE),
  ('report_units:write',  'Thêm và sửa đơn vị báo cáo', 'Thêm đơn vị, sửa thông tin, ngừng hoạt động',    TRUE),
  ('report_units:delete', 'Xoá đơn vị báo cáo',        'Xoá hẳn một đơn vị chưa được sử dụng',          TRUE);

-- ADMIN phải được ghi rõ: 005 chỉ cấp cho ADMIN những quyền tồn tại lúc nó chạy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('report_units:read', 'report_units:write', 'report_units:delete')
WHERE r.code = 'ADMIN';

-- Mọi màn nghiệp vụ đều hiển thị tên đơn vị, nên MANAGER và USER được xem.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'report_units:read'
WHERE r.code IN ('MANAGER', 'USER');

-- Dữ liệu mẫu Đồng Nai, khớp dữ liệu mẫu đang dùng ở frontend (features/report-units).
-- Nối cấp trên theo budget_code (khoá tự nhiên), không ghim id — cột id là identity.

-- Cấp 1: đơn vị gốc.
INSERT INTO asxh_report_units (budget_code, name, parent_id, unit_type, block, active, receives_reports, created_at) VALUES
  ('1000001', 'Sở Tài chính Đồng Nai', NULL, 'SO', 'TINH', TRUE, TRUE, TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+07');

-- Cấp 2: dưới Sở Tài chính.
INSERT INTO asxh_report_units (budget_code, name, parent_id, unit_type, block, active, receives_reports, created_at)
SELECT v.budget_code, v.name, p.id, v.unit_type, v.block, v.active, v.receives_reports, TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+07'
FROM (VALUES
  ('1051001', 'UBND TP. Biên Hoà',                  'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1052001', 'UBND TP. Long Khánh',                'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1053001', 'UBND huyện Trảng Bom',               'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1054001', 'UBND huyện Long Thành',              'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1055001', 'UBND huyện Nhơn Trạch',              'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1056001', 'UBND huyện Thống Nhất',              'UBND_HUYEN', 'HUYEN', TRUE,  TRUE),
  ('1060001', 'Bảo hiểm xã hội Đồng Nai',           'SO',         'TINH',  TRUE,  TRUE),
  ('1070001', 'Trường THPT Chuyên Lương Thế Vinh',  'TRUONG',     'TINH',  TRUE,  TRUE),
  ('1070002', 'Trường Mầm non Hoa Sen',             'TRUONG',     'TINH',  FALSE, FALSE)
) AS v(budget_code, name, unit_type, block, active, receives_reports)
JOIN asxh_report_units p ON p.budget_code = '1000001';

-- Cấp 3: xã / phường dưới các UBND huyện.
INSERT INTO asxh_report_units (budget_code, name, parent_id, unit_type, block, active, receives_reports, created_at)
SELECT v.budget_code, v.name, p.id, 'UBND_XA', 'XA', v.active, TRUE, TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+07'
FROM (VALUES
  ('1051101', 'UBND phường Trấn Biên',     '1051001', TRUE),
  ('1051102', 'UBND phường Bửu Long',      '1051001', TRUE),
  ('1051103', 'UBND phường Hoá An',        '1051001', TRUE),
  ('1051104', 'UBND phường Tân Phong',     '1051001', FALSE),
  ('1052345', 'UBND phường Bảo Vinh',      '1052001', TRUE),
  ('1052346', 'UBND phường Xuân An',       '1052001', TRUE),
  ('1053101', 'UBND xã Bàu Hàm',           '1053001', TRUE),
  ('1053102', 'UBND xã Hố Nai 3',          '1053001', TRUE),
  ('1053103', 'UBND thị trấn Trảng Bom',   '1053001', TRUE),
  ('1054101', 'UBND xã An Phước',          '1054001', TRUE),
  ('1055101', 'UBND xã Long Tân',          '1055001', TRUE),
  ('1056101', 'UBND xã Gia Tân 1',         '1056001', TRUE)
) AS v(budget_code, name, parent_code, active)
JOIN asxh_report_units p ON p.budget_code = v.parent_code;

--rollback DELETE FROM asxh_report_units WHERE parent_id IN (SELECT id FROM asxh_report_units WHERE parent_id IS NOT NULL);
--rollback DELETE FROM asxh_report_units WHERE parent_id IS NOT NULL;
--rollback DELETE FROM asxh_report_units;
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'report_units:%');
--rollback DELETE FROM permissions WHERE code LIKE 'report_units:%';
