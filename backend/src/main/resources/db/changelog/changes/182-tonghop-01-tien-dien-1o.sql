--liquibase formatted sql

-- Biểu Tổng hợp năm (BM-000009), tab 01, dòng 83 "Hộ CSXH" và 84 "Hộ đồng bào DTTS sống ở vùng chưa có
-- điện lưới" (tiền điện, lấy từ tab 1o-snnmt-95xp) — lỗi có sẵn từ file gốc, tìm thấy khi soát 1o ngày
-- 09/11/2026:
--   * D83 = ROUND((F9*H9*I9)+(F9*J9*K9),0) lấy số hộ ở F9 — dòng ĐƠN VỊ ĐẦU TIÊN của tab 1o (script tổng hợp
--     nhân dòng 9 cho từng xã) — thay vì dòng tổng F8, nên chỉ tính kinh phí của một xã;
--   * D84 = ROUND(-D83+N9,0)-1 cũng lấy N9 (đơn vị đầu tiên) và trừ cứng 1 để chữa làm tròn.
-- Sửa: D83 = số hộ CSXH dòng tổng F8 × (mức H9 × số tháng I9 + mức J9 × số tháng K9) — mức và số tháng
-- chung mọi xã, nằm ở dòng 9; D84 = kinh phí hộ chính sách dòng tổng N8 − D83, nên D83 + D84 luôn bằng
-- ROUND(N8). Mức và số tháng của tab 1o giữ nguyên (chờ Sở chốt mức theo từng năm).
--
-- Chỉ đụng phiên bản còn đúng công thức cũ; chạy lại không đổi gì. CSDL không có biểu này thì không đổi dòng nào.

--changeset dth:182-tonghop-01-tien-dien-1o splitStatements:false
--comment Tổng hợp năm, tab 01 D83, D84: kinh phí tiền điện hộ chính sách lấy dòng tổng tab 1o, bỏ trừ 1
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(v.workbook_json::jsonb,
    '{sheets,01,data,dataTable,82,3,formula}',
    to_jsonb('ROUND(''1o-snnmt-95xp''!F8*(''1o-snnmt-95xp''!H9*''1o-snnmt-95xp''!I9+''1o-snnmt-95xp''!J9*''1o-snnmt-95xp''!K9),0)'::text)),
    '{sheets,01,data,dataTable,83,3,formula}',
    to_jsonb('ROUND(''1o-snnmt-95xp''!N8,0)-D83'::text)))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,01,data,dataTable,82,3,formula}'
      = 'ROUND((''1o-snnmt-95xp''!F9*''1o-snnmt-95xp''!H9*''1o-snnmt-95xp''!I9)+(''1o-snnmt-95xp''!F9*''1o-snnmt-95xp''!J9*''1o-snnmt-95xp''!K9),0)'
  AND v.workbook_json::jsonb #>> '{sheets,01,data,dataTable,83,3,formula}'
      = 'ROUND(-D83+''1o-snnmt-95xp''!N9,0)-1';
--rollback SELECT 1;
