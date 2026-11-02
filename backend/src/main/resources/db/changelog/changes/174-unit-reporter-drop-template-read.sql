--liquibase formatted sql

-- Cán bộ đơn vị (ORGANIZATION_REPORTER) không còn mở được màn Bộ biểu mẫu: gỡ ba quyền đọc mẫu biểu
-- mà seed 165 đã cấp. Màn nhập liệu của đơn vị nhận khung biểu và kịch bản qua input_report_sheets,
-- không gọi /api/templates, /api/template_sets hay /api/template_versions; bản Jmix cũng không cho
-- vai trò đơn vị mở danh sách mẫu (UserOfficerResourceRole chỉ có view của phiếu nhập).
-- Không sửa 165 (đã chạy ở máy khác, đổi nội dung là lệch checksum).

--changeset dth:174-unit-reporter-drop-template-read
--comment Vai trò đơn vị nhập liệu: bỏ quyền đọc bộ mẫu, mẫu biểu, phiên bản mẫu
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE code = 'ORGANIZATION_REPORTER')
  AND permission_id IN (SELECT id FROM permissions
                        WHERE code IN ('template_sets:read', 'templates:read', 'template_versions:read'));
--rollback INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('template_sets:read', 'templates:read', 'template_versions:read') WHERE r.code = 'ORGANIZATION_REPORTER' ON CONFLICT DO NOTHING;
