--liquibase formatted sql

--changeset dth:168-seed-asxh-indicator-measure-permissions
--comment Mã quyền màn Bản chất chỉ tiêu (indicator_measures): xem và khai bản chất để tổng hợp nhiều kỳ gộp đúng.

-- Khai bản chất làm đổi số tổng hợp nhiều kỳ (cộng dồn / lấy kỳ cao nhất / lấy kỳ mới nhất) nên chỉ
-- người dựng mẫu (TEMPLATE_ADMIN) và người tổng hợp (DEPT_REPORT_COMPILER) được ghi; người lập báo cáo
-- năm và người kiểm tra chỉ xem. ADMIN được ghi đích danh vì 005 chỉ cấp quyền có lúc nó chạy.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('indicator_measures:read',  'Xem bản chất chỉ tiêu', 'Xem danh mục chỉ tiêu và cách cộng số khi tổng hợp nhiều kỳ',         TRUE),
  ('indicator_measures:write', 'Khai bản chất chỉ tiêu', 'Khai chỉ tiêu là người hưởng, lượt, mức hỗ trợ, thời gian hay kinh phí', TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('indicator_measures:read', 'indicator_measures:write')
WHERE r.code IN ('ADMIN', 'TEMPLATE_ADMIN', 'DEPT_REPORT_COMPILER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'indicator_measures:read'
WHERE r.code IN ('DEPT_REPORT_SUBMITTER', 'AUDITOR');

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('indicator_measures:read', 'indicator_measures:write'));
--rollback DELETE FROM permissions WHERE code IN ('indicator_measures:read', 'indicator_measures:write');
