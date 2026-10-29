--liquibase formatted sql

--changeset dth:132-seed-asxh-ledger-permissions
--comment Mã quyền khoá / huỷ phiếu, giấy tờ đính kèm phiếu, số liệu đã duyệt; gán cho ADMIN.

-- Cùng khuôn "resource:action"; resource là tên REST nguyên văn.
-- input_reports:lock / :cancel tách khỏi :approve vì là thao tác hành chính hiếm (UC-47, chỉ REST).
-- input_report_attachments là giấy tờ kèm phiếu (xác nhận Kho bạc): đọc / tải lên + tích / gỡ.
-- ledger_entries là số liệu đã duyệt của phiếu: xem, và nạp từ dữ liệu BHXH (UC-49).
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('input_reports:lock',               'Khoá phiếu đã duyệt',        'Khoá phiếu đã phê duyệt; phiếu khoá vẫn được tính vào tổng hợp',     TRUE),
  ('input_reports:cancel',             'Huỷ phiếu',                  'Huỷ phiếu đang nhập hoặc bị trả lại',                               TRUE),
  ('input_report_attachments:read',    'Xem giấy tờ kèm phiếu',      'Xem và tải về xác nhận Kho bạc đính kèm phiếu',                     TRUE),
  ('input_report_attachments:write',   'Đính kèm giấy tờ',           'Tải lên xác nhận Kho bạc và tích "Đã có phiếu xác nhận"',           TRUE),
  ('input_report_attachments:delete',  'Gỡ giấy tờ kèm phiếu',       'Gỡ file xác nhận Kho bạc khỏi phiếu còn đang nhập',                 TRUE),
  ('ledger_entries:read',              'Xem số liệu đã duyệt',       'Xem số liệu đã lưu của các phiếu được phê duyệt',                   TRUE),
  ('ledger_entries:import',            'Nạp số liệu BHXH',           'Nạp số liệu BHXH đã chuẩn hoá vào phiếu',                           TRUE);

-- ADMIN phải được ghi đích danh: 005 chỉ cấp những quyền tồn tại lúc nó chạy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'input_reports:lock', 'input_reports:cancel',
  'input_report_attachments:read', 'input_report_attachments:write', 'input_report_attachments:delete',
  'ledger_entries:read', 'ledger_entries:import')
WHERE r.code = 'ADMIN';

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('input_reports:lock', 'input_reports:cancel', 'input_report_attachments:read', 'input_report_attachments:write', 'input_report_attachments:delete', 'ledger_entries:read', 'ledger_entries:import'));
--rollback DELETE FROM permissions WHERE code IN ('input_reports:lock', 'input_reports:cancel', 'input_report_attachments:read', 'input_report_attachments:write', 'input_report_attachments:delete', 'ledger_entries:read', 'ledger_entries:import');
