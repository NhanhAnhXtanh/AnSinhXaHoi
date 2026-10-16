--liquibase formatted sql

--changeset dth:165-seed-asxh-summary-annual-permissions
--comment Mã quyền Tổng hợp báo cáo (summary) và Báo cáo năm (annual_reports); ADMIN nhận mọi mã quyền đang có.

-- Hai màn Tổng hợp và Báo cáo năm do slice riêng kiểm bằng @PreAuthorize; slice đó có
-- thể đã seed các mã này trong dải 140–159 (chạy trước file này), nên ON CONFLICT DO
-- NOTHING: không trùng, không ghi đè tên đã đặt.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('summary:read',            'Xem tổng hợp báo cáo',   'Xem số liệu tổng hợp theo kỳ và theo năm',                        TRUE),
  ('summary:write',           'Tổng hợp số liệu',       'Chỉnh và lưu số liệu tổng hợp các kỳ đã chốt',                    TRUE),
  ('annual_reports:read',     'Xem báo cáo năm',        'Xem báo cáo năm đã lập và các lần nộp lên UBND',                  TRUE),
  ('annual_reports:write',    'Lập và nộp báo cáo năm', 'Lập báo cáo năm từ số liệu tổng hợp và nộp lên UBND',             TRUE),
  ('annual_reports:approve',  'Duyệt báo cáo năm',      'Phê duyệt hoặc trả lại báo cáo năm đã nộp',                       TRUE)
ON CONFLICT (code) DO NOTHING;

-- ADMIN là "toàn quyền". 005 chỉ cấp cho ADMIN những mã có lúc nó chạy, và mỗi slice
-- sau đó tự ghi ADMIN cho mã của mình — dòng dưới vá mọi mã còn sót (kể cả mã của slice
-- nào quên), một lần, theo mã quyền chứ không theo id.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('summary:read', 'summary:write', 'annual_reports:read', 'annual_reports:write', 'annual_reports:approve'));
--rollback DELETE FROM permissions WHERE code IN ('summary:read', 'summary:write', 'annual_reports:read', 'annual_reports:write', 'annual_reports:approve');


--changeset dth:165-seed-asxh-business-roles
--comment Vai trò nghiệp vụ ASXH theo bản Jmix (cán bộ đơn vị, cán bộ Sở, UBND, kiểm tra) và quyền của từng vai trò.

-- Tên mã giữ như vai trò Jmix (quyettoan/security/*Role.java) để dễ đối chiếu; tên hiển
-- thị tiếng Việt. system_role = FALSE: quản trị viên được sửa, xoá như vai trò tự tạo.
-- REPORT_OFFICER (Jmix: chỉ trả lại) gộp vào REPORT_APPROVER vì backend dùng chung một
-- mã input_reports:approve cho cả phê duyệt lẫn trả lại.
INSERT INTO roles (code, name, description, system_role) VALUES
  ('ORGANIZATION_REPORTER',  'Cán bộ đơn vị nhập liệu',
     'Nhập số liệu các biểu, đính kèm xác nhận Kho bạc và nộp phiếu của đơn vị lên Sở.',                        FALSE),
  ('REPORT_APPROVER',        'Cán bộ Sở duyệt phiếu',
     'Xem phiếu đơn vị đã nộp, phê duyệt hoặc trả lại kèm lý do, khoá phiếu đã duyệt.',                        FALSE),
  ('REPORT_ADMIN',           'Cán bộ Sở điều hành kỳ báo cáo',
     'Lập lịch và kỳ báo cáo, thiết lập biểu cho đơn vị, mở đợt, chốt, gia hạn, thu hồi.',                      FALSE),
  ('TEMPLATE_ADMIN',         'Cán bộ quản lý biểu mẫu',
     'Thiết kế, ban hành, khoá và thu hồi bộ biểu mẫu báo cáo.',                                               FALSE),
  ('DEPT_REPORT_COMPILER',   'Cán bộ Sở tổng hợp số liệu',
     'Xem và chỉnh số liệu tổng hợp các kỳ đã chốt trên màn Tổng hợp báo cáo.',                                FALSE),
  ('DEPT_REPORT_SUBMITTER',  'Cán bộ Sở nộp báo cáo năm',
     'Lập báo cáo năm từ số liệu tổng hợp, nộp lên UBND; cùng UBND duyệt hoặc trả lại báo cáo năm.',           FALSE),
  ('UBND_APPROVER',          'Lãnh đạo UBND duyệt báo cáo năm',
     'Xem báo cáo năm Sở đã nộp, phê duyệt hoặc trả lại kèm lý do.',                                           FALSE),
  ('AUDITOR',                'Kiểm tra (chỉ xem)',
     'Xem toàn bộ lịch, biểu mẫu, phiếu, số liệu tổng hợp và báo cáo năm; không sửa gì.',                      FALSE)
ON CONFLICT (code) DO NOTHING;

-- Mỗi vai trò một câu, nối theo mã (không ghim id). Mã nào chưa có trong bảng
-- permissions (slice chưa chạy) thì JOIN bỏ qua, không lỗi. Mọi vai trò đều có
-- notifications:read|delete như ba vai trò hệ thống, để chuông thông báo dùng được.

-- Cán bộ đơn vị: phiếu của mình + những gì màn nhập liệu cần đọc (đơn vị, kỳ, mẫu).
-- Chưa có giới hạn "chỉ đơn vị của mình" ở mức dòng — xem ghi chú bàn giao.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'input_reports:read', 'input_reports:write',
  'input_report_attachments:read', 'input_report_attachments:write', 'input_report_attachments:delete',
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'ORGANIZATION_REPORTER'
ON CONFLICT DO NOTHING;

-- Cán bộ Sở duyệt phiếu.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'input_reports:read', 'input_reports:approve', 'input_reports:lock',
  'input_report_attachments:read', 'ledger_entries:read',
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'period_assignments:read', 'publications:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'REPORT_APPROVER'
ON CONFLICT DO NOTHING;

-- Cán bộ Sở điều hành kỳ: lịch, kỳ, thiết lập, đợt; xem phiếu, huỷ / khoá phiếu.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'report_calendars:read', 'report_calendars:write', 'report_calendars:delete',
  'report_periods:read', 'report_periods:write', 'report_periods:delete',
  'period_assignments:read', 'period_assignments:write',
  'publications:read', 'publications:write',
  'input_reports:read', 'input_reports:cancel', 'input_reports:lock',
  'input_report_attachments:read', 'ledger_entries:read', 'summary:read',
  'report_units:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'REPORT_ADMIN'
ON CONFLICT DO NOTHING;

-- Cán bộ quản lý biểu mẫu.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'template_sets:read', 'template_sets:write', 'template_sets:delete',
  'templates:read', 'templates:write', 'templates:delete',
  'template_versions:read', 'template_versions:write', 'template_versions:delete',
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'TEMPLATE_ADMIN'
ON CONFLICT DO NOTHING;

-- Cán bộ Sở tổng hợp số liệu.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'summary:read', 'summary:write', 'ledger_entries:read',
  'input_reports:read', 'annual_reports:read',
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'DEPT_REPORT_COMPILER'
ON CONFLICT DO NOTHING;

-- Cán bộ Sở nộp báo cáo năm (Sở và UBND dùng chung quyền quyết định báo cáo năm, như Jmix).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'annual_reports:read', 'annual_reports:write', 'annual_reports:approve',
  'summary:read', 'ledger_entries:read',
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'DEPT_REPORT_SUBMITTER'
ON CONFLICT DO NOTHING;

-- Lãnh đạo UBND: chỉ báo cáo năm, cùng những gì cần để mở được bảng tính của nó.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'annual_reports:read', 'annual_reports:approve',
  'report_units:read', 'report_periods:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'UBND_APPROVER'
ON CONFLICT DO NOTHING;

-- Kiểm tra: mọi mã :read của nghiệp vụ ASXH.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'report_units:read', 'report_calendars:read', 'report_periods:read',
  'template_sets:read', 'templates:read', 'template_versions:read',
  'period_assignments:read', 'publications:read',
  'input_reports:read', 'input_report_attachments:read', 'ledger_entries:read',
  'summary:read', 'annual_reports:read',
  'notifications:read', 'notifications:delete')
WHERE r.code = 'AUDITOR'
ON CONFLICT DO NOTHING;

--rollback DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code IN ('ORGANIZATION_REPORTER', 'REPORT_APPROVER', 'REPORT_ADMIN', 'TEMPLATE_ADMIN', 'DEPT_REPORT_COMPILER', 'DEPT_REPORT_SUBMITTER', 'UBND_APPROVER', 'AUDITOR'));
--rollback DELETE FROM roles WHERE code IN ('ORGANIZATION_REPORTER', 'REPORT_APPROVER', 'REPORT_ADMIN', 'TEMPLATE_ADMIN', 'DEPT_REPORT_COMPILER', 'DEPT_REPORT_SUBMITTER', 'UBND_APPROVER', 'AUDITOR');
