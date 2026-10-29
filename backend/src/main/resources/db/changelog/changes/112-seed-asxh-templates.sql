--liquibase formatted sql

--changeset dth:112-seed-asxh-templates
--comment Dữ liệu mẫu Đồng Nai: một bộ mẫu, ba biểu (1a, 1b, TH) và các phiên bản ở nhiều trạng thái.

-- Nối bằng khoá tự nhiên (tên bộ mẫu, mã biểu) chứ không ghim id, như các seed
-- của base: id là identity, ghim id sẽ để sequence tụt lại và lần chèn đầu từ
-- ứng dụng bị trùng. Mã biểu BM-000001..3 nằm dưới 1000 nên không đụng mã do
-- asxh_template_code_seq sinh ra.
--
-- Workbook là JSON SpreadJS tối giản (đủ để màn mở được), script là khung trống.
-- Không có dấu chấm phẩy trong chuỗi vì Liquibase tách câu lệnh theo dấu đó.

INSERT INTO asxh_template_sets (name, description, created_at) VALUES
  ('Bộ mẫu quyết toán kinh phí an sinh xã hội',
   'Các biểu báo cáo quyết toán kinh phí thực hiện chính sách an sinh xã hội gửi Sở Tài chính Đồng Nai.',
   TIMESTAMP WITH TIME ZONE '2025-01-02 08:00:00+07');

INSERT INTO asxh_templates (template_set_id, code, short_name, name, kind, sort_order, created_at)
SELECT s.id, v.code, v.short_name, v.name, v.kind, v.sort_order, TIMESTAMP WITH TIME ZONE '2025-01-02 08:00:00+07'
FROM (VALUES
  ('BM-000001', '1a', 'Kinh phí thực hiện chính sách bảo trợ xã hội',                 'CHI_TIET', 1),
  ('BM-000002', '1b', 'Kinh phí hỗ trợ miễn, giảm học phí và chi phí học tập',        'CHI_TIET', 2),
  ('BM-000003', 'TH', 'Tổng hợp quyết toán kinh phí an sinh xã hội toàn tỉnh',        'TONG_HOP', 3)
) AS v(code, short_name, name, kind, sort_order)
JOIN asxh_template_sets s ON s.name = 'Bộ mẫu quyết toán kinh phí an sinh xã hội';

-- Phiên bản đầu chuỗi của cả ba biểu.
--   1a v1: ban hành từ 01/01/2025, hết hiệu lực 31/12/2025 (bị v2 thay).
--   1b v1, TH v1: ban hành từ 01/01/2026.
INSERT INTO asxh_template_versions
  (template_id, version_no, previous_version_id, status, effective_from, effective_to,
   workbook_json, script_text, published_at, published_by, created_at)
SELECT t.id, 1, NULL, 'PUBLISHED', v.effective_from, v.effective_to,
       v.workbook_json, '// Script của biểu — chưa có quy tắc kiểm tra',
       v.published_at, 'admin', v.published_at
FROM (VALUES
  ('BM-000001', DATE '2025-01-01', DATE '2025-12-31',
   '{"version":"17.0.0","sheetCount":1,"sheets":{"1a":{"name":"1a","rowCount":30,"columnCount":6,"data":{"dataTable":{"0":{"0":{"value":"BIỂU 1a - KINH PHÍ THỰC HIỆN CHÍNH SÁCH BẢO TRỢ XÃ HỘI"}},"2":{"0":{"value":"STT"},"1":{"value":"Nội dung"},"2":{"value":"Dự toán"},"3":{"value":"Quyết toán"}}}}}}}',
   TIMESTAMP WITH TIME ZONE '2024-12-20 09:00:00+07'),
  ('BM-000002', DATE '2026-01-01', NULL,
   '{"version":"17.0.0","sheetCount":1,"sheets":{"1b":{"name":"1b","rowCount":30,"columnCount":6,"data":{"dataTable":{"0":{"0":{"value":"BIỂU 1b - KINH PHÍ HỖ TRỢ MIỄN, GIẢM HỌC PHÍ VÀ CHI PHÍ HỌC TẬP"}},"2":{"0":{"value":"STT"},"1":{"value":"Đối tượng"},"2":{"value":"Số người"},"3":{"value":"Kinh phí"}}}}}}}',
   TIMESTAMP WITH TIME ZONE '2025-12-15 09:00:00+07'),
  ('BM-000003', DATE '2026-01-01', NULL,
   '{"version":"17.0.0","sheetCount":1,"sheets":{"TH":{"name":"TH","rowCount":40,"columnCount":8,"data":{"dataTable":{"0":{"0":{"value":"TỔNG HỢP QUYẾT TOÁN KINH PHÍ AN SINH XÃ HỘI TOÀN TỈNH"}},"2":{"0":{"value":"STT"},"1":{"value":"Đơn vị"},"2":{"value":"Dự toán"},"3":{"value":"Quyết toán"}}}}}}}',
   TIMESTAMP WITH TIME ZONE '2025-12-15 09:00:00+07')
) AS v(code, effective_from, effective_to, workbook_json, published_at)
JOIN asxh_templates t ON t.code = v.code;

-- 1a v2: phiên bản kế tiếp của v1, ban hành từ 01/01/2026 — bản đang áp dụng.
INSERT INTO asxh_template_versions
  (template_id, version_no, previous_version_id, status, effective_from, effective_to,
   workbook_json, script_text, published_at, published_by, created_at)
SELECT t.id, 2, prev.id, 'PUBLISHED', DATE '2026-01-01', NULL,
       prev.workbook_json, prev.script_text,
       TIMESTAMP WITH TIME ZONE '2025-12-15 09:00:00+07', 'admin',
       TIMESTAMP WITH TIME ZONE '2025-12-01 09:00:00+07'
FROM asxh_templates t
JOIN asxh_template_versions prev ON prev.template_id = t.id AND prev.version_no = 1
WHERE t.code = 'BM-000001';

-- 1b v2: bản nháp đang thiết kế (chưa có ngày áp dụng) — để màn có nút Ban hành.
INSERT INTO asxh_template_versions
  (template_id, version_no, previous_version_id, status, effective_from, effective_to,
   workbook_json, script_text, created_at)
SELECT t.id, 2, prev.id, 'DRAFT', NULL, NULL,
       prev.workbook_json, prev.script_text,
       TIMESTAMP WITH TIME ZONE '2026-09-01 09:00:00+07'
FROM asxh_templates t
JOIN asxh_template_versions prev ON prev.template_id = t.id AND prev.version_no = 1
WHERE t.code = 'BM-000002';

--rollback DELETE FROM asxh_template_versions WHERE template_id IN (SELECT id FROM asxh_templates WHERE code IN ('BM-000001', 'BM-000002', 'BM-000003')) AND version_no = 2;
--rollback DELETE FROM asxh_template_versions WHERE template_id IN (SELECT id FROM asxh_templates WHERE code IN ('BM-000001', 'BM-000002', 'BM-000003'));
--rollback DELETE FROM asxh_templates WHERE code IN ('BM-000001', 'BM-000002', 'BM-000003');
--rollback DELETE FROM asxh_template_sets WHERE name = 'Bộ mẫu quyết toán kinh phí an sinh xã hội';
