--liquibase formatted sql

-- Khoá cả biểu thay cho khoá từng phiên bản: biểu đang khoá thì không phiên bản nào của nó được
-- chọn cho đợt báo cáo mới, không ban hành / thu hồi được; vẫn xem, vẫn tạo và sửa bản nháp để chữa
-- lỗi; mở khoá rồi ban hành. Xem TemplateService.lockForm / unlockForm.
--
-- Dữ liệu cũ: biểu nào đang có phiên bản ở trạng thái LOCKED (khoá từng bản kiểu cũ) thì chuyển
-- thành biểu đang khoá, và các bản LOCKED trở lại PUBLISHED (giữ ngày áp dụng, người/ngày ban
-- hành) — vẫn không được chọn cho đợt mới vì cả biểu đang khoá.

--changeset dth:175-template-lock-whole-form
--comment Biểu mẫu: khoá cả biểu (locked, locked_at, locked_by); chuyển bản LOCKED cũ sang khoá biểu
ALTER TABLE asxh_templates ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE asxh_templates ADD COLUMN locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE asxh_templates ADD COLUMN locked_by VARCHAR(100);
UPDATE asxh_templates t
   SET locked = TRUE, locked_at = now(), locked_by = 'system'
 WHERE EXISTS (SELECT 1 FROM asxh_template_versions v WHERE v.template_id = t.id AND v.status = 'LOCKED');
UPDATE asxh_template_versions SET status = 'PUBLISHED' WHERE status = 'LOCKED';
-- Tính lại ngày hết hiệu lực của các biểu vừa chuyển (như TemplateVersionService.refreshEffectiveTo:
-- mỗi bản đã ban hành hết hiệu lực một ngày trước bản đã ban hành kế sau, bản cuối để trống).
UPDATE asxh_template_versions v
   SET effective_to = s.next_from - 1
  FROM (SELECT id, LEAD(effective_from) OVER (PARTITION BY template_id ORDER BY effective_from, id) AS next_from
          FROM asxh_template_versions
         WHERE status = 'PUBLISHED' AND effective_from IS NOT NULL) s
 WHERE v.id = s.id
   AND v.template_id IN (SELECT id FROM asxh_templates WHERE locked_by = 'system');
--rollback ALTER TABLE asxh_templates DROP COLUMN locked_by;
--rollback ALTER TABLE asxh_templates DROP COLUMN locked_at;
--rollback ALTER TABLE asxh_templates DROP COLUMN locked;
