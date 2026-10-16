--liquibase formatted sql

--changeset dth:167-seed-asxh-dev-accounts
--comment Tài khoản mẫu ASXH cho môi trường phát triển: hai tài khoản đơn vị, cán bộ Sở (duyệt, điều hành, tổng hợp) và UBND.

-- CHỈ DÙNG KHI PHÁT TRIỂN — đổi mật khẩu hoặc xoá trên mọi máy người khác truy cập được.
--
-- Mật khẩu: cả sáu tài khoản dùng chung mật khẩu dev "User@123" — đúng chuỗi băm BCrypt của
-- tài khoản "viewer" ở 005-seed-security.sql (cùng thuật toán, cùng mật khẩu, để khỏi sinh băm
-- mới ngoài ứng dụng). Ghi băm thành chữ thay vì đọc từ dòng "viewer": nếu ai đó đã đổi mật
-- khẩu viewer trên CSDL của mình thì tài khoản mới vẫn có mật khẩu đoán trước được.
--
-- Nối theo khoá tự nhiên như mọi seed khác: tài khoản theo username, vai trò theo mã,
-- đơn vị theo mã quan hệ ngân sách (budget_code, seed ở 101). Vai trò nghiệp vụ seed ở 165.
--
-- Hai tài khoản đơn vị gắn hai phường của TP. Biên Hoà đều có phiếu ở 123 (Quý I đã duyệt,
-- Quý IV đang nhập) — đủ để thử "cán bộ phường A không thấy phiếu phường B".
INSERT INTO users (username, email, password_hash, full_name, status, report_unit_id, created_at)
SELECT v.username, v.email,
       '$2a$10$VAqCXeceitJBv.F3pGGwcehpaeGKP2.nyTe.5lFwfbmqPCS8hLSTm',
       v.full_name, 'ACTIVE', u.id, TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+07'
FROM (VALUES
  ('donvi.bienhoa', 'donvi.bienhoa@dongnai.local', 'Trần Văn Hùng',     '1051101'),
  ('donvi.buulong', 'donvi.buulong@dongnai.local', 'Lê Thị Hồng',       '1051102'),
  ('so.duyet',      'so.duyet@dongnai.local',      'Nguyễn Thị Thu',    NULL),
  ('so.dieuhanh',   'so.dieuhanh@dongnai.local',   'Phạm Minh Tuấn',    NULL),
  ('so.tonghop',    'so.tonghop@dongnai.local',    'Đặng Thanh Hà',     NULL),
  ('ubnd.duyet',    'ubnd.duyet@dongnai.local',    'Lê Quốc Bảo',       NULL)
) AS v(username, email, full_name, budget_code)
LEFT JOIN asxh_report_units u ON u.budget_code = v.budget_code
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT us.id, r.id
FROM (VALUES
  ('donvi.bienhoa', 'ORGANIZATION_REPORTER'),
  ('donvi.buulong', 'ORGANIZATION_REPORTER'),
  ('so.duyet',      'REPORT_APPROVER'),
  ('so.dieuhanh',   'REPORT_ADMIN'),
  ('so.tonghop',    'DEPT_REPORT_COMPILER'),
  ('so.tonghop',    'DEPT_REPORT_SUBMITTER'),
  ('ubnd.duyet',    'UBND_APPROVER')
) AS v(username, role_code)
JOIN users us ON us.username = v.username
JOIN roles r ON r.code = v.role_code
ON CONFLICT DO NOTHING;

--rollback DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username IN ('donvi.bienhoa', 'donvi.buulong', 'so.duyet', 'so.dieuhanh', 'so.tonghop', 'ubnd.duyet'));
--rollback DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username IN ('donvi.bienhoa', 'donvi.buulong', 'so.duyet', 'so.dieuhanh', 'so.tonghop', 'ubnd.duyet'));
--rollback DELETE FROM users WHERE username IN ('donvi.bienhoa', 'donvi.buulong', 'so.duyet', 'so.dieuhanh', 'so.tonghop', 'ubnd.duyet');
