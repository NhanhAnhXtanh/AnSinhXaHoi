--liquibase formatted sql

--changeset dth:111-seed-asxh-template-permissions
--comment Quyền cho ba resource mẫu biểu (template_sets, templates, template_versions), gán cho ADMIN.

-- Cùng khuôn "resource:action" như 005/010: nửa trước là tên resource đúng như
-- frontend khai báo. Ban hành / khoá / mở khoá / thu hồi / tạo phiên bản kế tiếp
-- dùng template_versions:write. system_permission = TRUE vì các mã này đến cùng
-- migration với @PreAuthorize kiểm tra chúng (xem 008).
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('template_sets:read',       'Xem bộ mẫu',                'Xem danh sách và chi tiết bộ mẫu báo cáo',                                 TRUE),
  ('template_sets:write',      'Tạo và sửa bộ mẫu',         'Tạo bộ mẫu, đổi tên và mô tả',                                             TRUE),
  ('template_sets:delete',     'Xoá bộ mẫu',                'Xoá bộ mẫu chưa có biểu nào',                                              TRUE),
  ('templates:read',           'Xem biểu mẫu',              'Xem danh sách và chi tiết biểu trong bộ mẫu',                              TRUE),
  ('templates:write',          'Tạo và sửa biểu mẫu',       'Tạo biểu (kèm phiên bản nháp đầu), đổi tên, thứ tự, loại biểu',            TRUE),
  ('templates:delete',         'Xoá biểu mẫu',              'Xoá biểu chưa từng ban hành',                                              TRUE),
  ('template_versions:read',   'Xem phiên bản mẫu',         'Xem phiên bản mẫu, bảng tính và script',                                   TRUE),
  ('template_versions:write',  'Thiết kế và ban hành mẫu',  'Lưu thiết kế, ban hành, khoá, mở khoá, thu hồi, tạo phiên bản kế tiếp',   TRUE),
  ('template_versions:delete', 'Xoá phiên bản mẫu',         'Xoá phiên bản mới nhất chưa được dùng',                                    TRUE);

-- ADMIN phải ghi rõ: 005 chỉ cấp cho ADMIN những quyền có lúc nó chạy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'template_sets:read', 'template_sets:write', 'template_sets:delete',
  'templates:read', 'templates:write', 'templates:delete',
  'template_versions:read', 'template_versions:write', 'template_versions:delete')
WHERE r.code = 'ADMIN';

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'template_sets:%' OR code LIKE 'templates:%' OR code LIKE 'template_versions:%');
--rollback DELETE FROM permissions WHERE code LIKE 'template_sets:%' OR code LIKE 'templates:%' OR code LIKE 'template_versions:%';
