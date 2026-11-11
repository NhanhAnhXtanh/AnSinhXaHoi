--liquibase formatted sql

-- Ba vai trò và ba tài khoản mẫu của khung gốc (changeset 005) có tên, mô tả tiếng Anh, hiện ra ở
-- danh sách vai trò, cột "Vai trò" của Người dùng và hộp chọn vai trò khi cấp tài khoản (B08, đợt
-- kiểm thử toàn app 10/11/2026). Đổi sang tiếng Việt; chỉ đổi khi còn đúng chữ gốc để không đè tên
-- mà quản trị đã tự sửa. Mã vai trò (ADMIN, MANAGER, USER) và quyền không đổi.

--changeset dth:184-viet-hoa-vai-tro-he-thong
UPDATE roles SET name = 'Quản trị hệ thống',
                 description = 'Toàn quyền với mọi phần của hệ thống, kể cả người dùng và vai trò.'
 WHERE code = 'ADMIN' AND name = 'Administrator';

UPDATE roles SET name = 'Quản lý nội dung',
                 description = 'Quản lý toàn bộ nội dung, được xem nhưng không được sửa người dùng và vai trò.'
 WHERE code = 'MANAGER' AND name = 'Manager';

UPDATE roles SET name = 'Người xem nội dung',
                 description = 'Chỉ được xem nội dung.'
 WHERE code = 'USER' AND name = 'User';

UPDATE users SET full_name = 'Quản trị hệ thống' WHERE username = 'admin'   AND full_name = 'System Administrator';
UPDATE users SET full_name = 'Quản lý nội dung'  WHERE username = 'manager' AND full_name = 'Content Manager';
UPDATE users SET full_name = 'Người xem'         WHERE username = 'viewer'  AND full_name = 'Read-only Viewer';
