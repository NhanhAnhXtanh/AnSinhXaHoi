--liquibase formatted sql

--changeset dth:122-seed-asxh-report-permissions
--comment Mã quyền cho thiết lập kỳ, đợt phát hành, phiếu nhập; gán cho ADMIN.

-- Cùng khuôn "resource:action" với phần còn lại; resource là tên REST nguyên văn.
-- input_reports có thêm action approve (Sở duyệt / trả lại) tách khỏi write (đơn vị nhập / nộp)
-- để cán bộ đơn vị không tự duyệt phiếu của mình. Không có :delete — phiếu không xoá tay.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('period_assignments:read',  'Xem thiết lập kỳ',        'Xem ma trận đơn vị x biểu mẫu của kỳ',                          TRUE),
  ('period_assignments:write', 'Thiết lập kỳ',            'Gán / gỡ biểu mẫu cho đơn vị trên ma trận của kỳ',              TRUE),
  ('publications:read',        'Xem lịch sử mở đợt',      'Xem các đợt phát hành phiếu của kỳ',                            TRUE),
  ('publications:write',       'Điều hành đợt báo cáo',   'Mở đợt, mở đợt bổ sung, chốt, gia hạn, thu hồi kỳ',             TRUE),
  ('input_reports:read',       'Xem phiếu nhập',          'Xem phiếu nhập và số liệu các biểu',                            TRUE),
  ('input_reports:write',      'Nhập và nộp phiếu',       'Lưu số liệu, đánh dấu biểu, nộp phiếu lên Sở',                  TRUE),
  ('input_reports:approve',    'Duyệt phiếu nhập',        'Phê duyệt hoặc trả lại phiếu đơn vị đã nộp',                    TRUE);

-- ADMIN phải được ghi đích danh: 005 chỉ cấp những quyền tồn tại lúc nó chạy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'period_assignments:read', 'period_assignments:write',
  'publications:read', 'publications:write',
  'input_reports:read', 'input_reports:write', 'input_reports:approve')
WHERE r.code = 'ADMIN';

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('period_assignments:read', 'period_assignments:write', 'publications:read', 'publications:write', 'input_reports:read', 'input_reports:write', 'input_reports:approve'));
--rollback DELETE FROM permissions WHERE code IN ('period_assignments:read', 'period_assignments:write', 'publications:read', 'publications:write', 'input_reports:read', 'input_reports:write', 'input_reports:approve');
