--liquibase formatted sql

-- Khoá đăng nhập tạm thời (chống dò mật khẩu): đếm số lần nhập sai liên tiếp của từng tài khoản và
-- thời điểm hết khoá. Sai đủ số lần thì khoá một lúc; đăng nhập đúng hoặc quản trị đặt lại mật khẩu
-- thì đếm lại từ đầu. Xem LoginAttemptService.

--changeset dth:173-users-login-lockout
--comment Tài khoản: đếm số lần đăng nhập sai liên tiếp và thời điểm hết khoá tạm thời
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
--rollback ALTER TABLE users DROP COLUMN locked_until;
--rollback ALTER TABLE users DROP COLUMN failed_login_count;
