--liquibase formatted sql

-- Dòng tổng của bảng "Tổng hợp theo kỳ" ở các biểu 1b, 1c (và 1d, 1e, 1f, 1h, 1k, 1o, 1s cùng khuôn) ghi
-- "Tong cong" không dấu, hiện cho người dùng và in ra Excel (B36, đợt kiểm thử toàn app 10/11/2026).
-- Đổi chữ ghi vào ô nhãn dòng tổng thành "Tổng cộng". Kịch bản không so khớp nhãn này ở chỗ nào khác
-- (đã tìm trong docs/form-template và mã nguồn), nên chỉ là chữ hiển thị.
-- Chỉ đụng kịch bản còn dòng cũ; chạy lại không đổi gì.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/<biểu>-scripts/4-tonghop-theo-ky.txt.

--changeset dth:187-tong-cong-co-dau-tonghop splitStatements:false stripComments:false
--comment Tổng hợp theo kỳ: nhãn dòng tổng "Tong cong" -> "Tổng cộng"
WITH s AS (
  SELECT id, replace(code, $js$setText(ctx, ROW0, ORG_COL, 'Tong cong');$js$, $js$setText(ctx, ROW0, ORG_COL, 'Tổng cộng');$js$) AS code
    FROM asxh_template_scripts
   WHERE position($js$setText(ctx, ROW0, ORG_COL, 'Tong cong');$js$ in code) > 0
)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-187'
FROM s
WHERE t.id = s.id;
--rollback SELECT 1;
