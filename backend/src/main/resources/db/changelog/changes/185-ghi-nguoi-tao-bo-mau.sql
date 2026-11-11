--liquibase formatted sql

-- Tab "Lịch sử thay đổi" của bộ mẫu ghi "Người thực hiện" là "—" cho mọi dòng tạo bộ mẫu, tạo biểu,
-- tạo phiên bản vì ba bảng không lưu ai tạo (B22, đợt kiểm thử toàn app 10/11/2026). Thêm cột người
-- tạo; bản ghi có sẵn để trống (không biết ai tạo) và hiện "—" như cũ.

--changeset dth:185-ghi-nguoi-tao-bo-mau
ALTER TABLE asxh_template_sets ADD COLUMN created_by VARCHAR(255);
ALTER TABLE asxh_templates ADD COLUMN created_by VARCHAR(255);
ALTER TABLE asxh_template_versions ADD COLUMN created_by VARCHAR(255);
