--liquibase formatted sql

--changeset dth:123-seed-asxh-report-demo
--comment Dữ liệu mẫu Đồng Nai: thiết lập kỳ, đợt phát hành và phiếu nhập năm 2026.

-- Dựa trên seed của slice khác, nối bằng khoá tự nhiên (không ghim id):
--   101 đơn vị (budget_code), 103 lịch 2026 + kỳ (year_no, code), 112 biểu (code BM-00000x).
-- Thiếu dữ liệu nguồn thì các câu INSERT ... SELECT dưới đây chèn 0 dòng, không lỗi.
--
-- Kịch bản (hôm nay của dữ liệu mẫu ~ giữa tháng 10/2026):
--   Quý I/2026   — đã chốt (CLOSED): 11 xã/phường x biểu 1a, 1b, mọi phiếu đã duyệt.
--   Quý III/2026 — đã thiết lập (READY), chưa mở đợt: để thử nút "Mở đợt báo cáo".
--   Quý IV/2026  — đang mở (OPEN): phiếu ở đủ trạng thái (đang nhập, chờ duyệt, đã duyệt,
--                  bị trả lại kèm bản cũ). Tháng 10, 11, 12, 6 tháng cuối năm và Năm 2026
--                  vì thế bị "khoá cả kỳ" (trùng thời gian với kỳ đã mở đợt).
-- Không dùng dấu chấm phẩy trong chuỗi vì Liquibase tách câu lệnh theo dấu đó.

-- 1. Trạng thái kỳ cho khớp với thiết lập / đợt bên dưới.
UPDATE asxh_report_periods p SET status = v.status
FROM (VALUES ('Q1', 'CLOSED'), ('Q3', 'READY'), ('Q4', 'OPEN')) AS v(code, status),
     asxh_report_calendars c
WHERE c.id = p.calendar_id AND c.year_no = 2026 AND p.code = v.code;

-- 2. Ma trận: mọi xã/phường đang hoạt động, được nhận báo cáo x biểu chi tiết 1a, 1b.
INSERT INTO asxh_period_assignments (period_id, unit_id, template_id, created_by, created_at)
SELECT p.id, u.id, t.id, 'admin', v.created_at
FROM (VALUES
  ('Q1', TIMESTAMP WITH TIME ZONE '2026-03-25 09:00:00+07'),
  ('Q3', TIMESTAMP WITH TIME ZONE '2026-09-25 09:00:00+07'),
  ('Q4', TIMESTAMP WITH TIME ZONE '2026-09-28 09:00:00+07')
) AS v(code, created_at)
JOIN asxh_report_periods p ON p.code = v.code
JOIN asxh_report_calendars c ON c.id = p.calendar_id AND c.year_no = 2026
CROSS JOIN asxh_report_units u
CROSS JOIN asxh_templates t
WHERE u.block = 'XA' AND u.active AND u.receives_reports
  AND t.code IN ('BM-000001', 'BM-000002');

-- 3. Đợt mở lần đầu của Quý I và Quý IV (số đếm điền ở bước 7).
INSERT INTO asxh_publications (period_id, kind, status, publication_no, unit_count, report_count, sheet_count, created_by, created_at)
SELECT p.id, 'LAN_DAU', 'PUBLISHED', 1, 0, 0, 0, 'admin', v.created_at
FROM (VALUES
  ('Q1', TIMESTAMP WITH TIME ZONE '2026-04-01 08:00:00+07'),
  ('Q4', TIMESTAMP WITH TIME ZONE '2026-10-01 08:00:00+07')
) AS v(code, created_at)
JOIN asxh_report_periods p ON p.code = v.code
JOIN asxh_report_calendars c ON c.id = p.calendar_id AND c.year_no = 2026;

-- 4. Phiếu Quý I: mỗi xã/phường một phiếu, đã duyệt.
INSERT INTO asxh_input_reports
  (unit_id, period_id, publication_id, revision_no, status,
   submitted_at, submitted_by, approved_at, approved_by, created_at, updated_at)
SELECT u.id, p.id, pub.id, 1, 'APPROVED',
       TIMESTAMP WITH TIME ZONE '2026-04-03 10:00:00+07', 'admin',
       TIMESTAMP WITH TIME ZONE '2026-04-06 15:00:00+07', 'admin',
       pub.created_at, TIMESTAMP WITH TIME ZONE '2026-04-06 15:00:00+07'
FROM asxh_report_periods p
JOIN asxh_report_calendars c ON c.id = p.calendar_id AND c.year_no = 2026
JOIN asxh_publications pub ON pub.period_id = p.id AND pub.publication_no = 1
JOIN asxh_period_assignments a ON a.period_id = p.id
JOIN asxh_report_units u ON u.id = a.unit_id
WHERE p.code = 'Q1'
GROUP BY u.id, p.id, pub.id, pub.created_at;

-- 5. Phiếu Quý IV: trạng thái theo từng đơn vị. Đơn vị 1053102 bị trả lại: bản 1 thành bản cũ
--    (SUPERSEDED), bản 2 (RETURNED) chèn ở bước 6.
INSERT INTO asxh_input_reports
  (unit_id, period_id, publication_id, revision_no, status,
   submitted_at, submitted_by, approved_at, approved_by,
   returned_at, returned_by, return_reason, created_at, updated_at)
SELECT u.id, p.id, pub.id, 1, v.status,
       CASE WHEN v.status IN ('SUBMITTED', 'APPROVED', 'SUPERSEDED')
            THEN TIMESTAMP WITH TIME ZONE '2026-10-08 09:30:00+07' END,
       CASE WHEN v.status IN ('SUBMITTED', 'APPROVED', 'SUPERSEDED') THEN 'admin' END,
       CASE WHEN v.status = 'APPROVED' THEN TIMESTAMP WITH TIME ZONE '2026-10-12 14:00:00+07' END,
       CASE WHEN v.status = 'APPROVED' THEN 'admin' END,
       CASE WHEN v.status = 'SUPERSEDED' THEN TIMESTAMP WITH TIME ZONE '2026-10-13 10:00:00+07' END,
       CASE WHEN v.status = 'SUPERSEDED' THEN 'admin' END,
       CASE WHEN v.status = 'SUPERSEDED'
            THEN 'Biểu 1a: số đối tượng bảo trợ xã hội dòng 3 chưa khớp danh sách chi trả, đề nghị rà soát lại.' END,
       pub.created_at,
       CASE WHEN v.status = 'DRAFT' THEN TIMESTAMP WITH TIME ZONE '2026-10-14 16:20:00+07'
            ELSE TIMESTAMP WITH TIME ZONE '2026-10-13 10:00:00+07' END
FROM (VALUES
  ('1051101', 'DRAFT'),
  ('1051102', 'DRAFT'),
  ('1051103', 'SUBMITTED'),
  ('1052345', 'SUBMITTED'),
  ('1052346', 'APPROVED'),
  ('1053101', 'APPROVED'),
  ('1053102', 'SUPERSEDED'),
  ('1053103', 'DRAFT'),
  ('1054101', 'SUBMITTED'),
  ('1055101', 'DRAFT'),
  ('1056101', 'APPROVED')
) AS v(budget_code, status)
JOIN asxh_report_units u ON u.budget_code = v.budget_code
JOIN asxh_report_calendars c ON c.year_no = 2026
JOIN asxh_report_periods p ON p.calendar_id = c.id AND p.code = 'Q4'
JOIN asxh_publications pub ON pub.period_id = p.id AND pub.publication_no = 1
WHERE EXISTS (SELECT 1 FROM asxh_period_assignments a WHERE a.period_id = p.id AND a.unit_id = u.id);

-- 6. Phiên bản 2 (Bị trả lại) của phiếu vừa thành bản cũ.
INSERT INTO asxh_input_reports
  (unit_id, period_id, publication_id, revision_no, previous_revision_id, status,
   returned_at, returned_by, return_reason, created_at, updated_at)
SELECT r.unit_id, r.period_id, r.publication_id, 2, r.id, 'RETURNED',
       r.returned_at, r.returned_by, r.return_reason, r.returned_at, r.returned_at
FROM asxh_input_reports r
WHERE r.status = 'SUPERSEDED'
  AND r.period_id IN (SELECT p.id FROM asxh_report_periods p
                      JOIN asxh_report_calendars c ON c.id = p.calendar_id
                      WHERE c.year_no = 2026 AND p.code = 'Q4');

-- 7. Tờ biểu: mỗi phiếu một tờ cho mỗi biểu đã thiết lập, ghim phiên bản đã ban hành áp dụng
--    tới ngày mở đợt. Phiếu đã nộp trở lên (và bản trả lại chép từ bản đã nộp) có mọi biểu
--    "Đã nhập xong", riêng 1b của phiếu đã duyệt Quý IV khai "Không phát sinh số liệu".
--    Phiếu đang nhập: 1a đang nhập dở, 1b chưa nhập.
INSERT INTO asxh_input_report_sheets
  (report_id, template_id, template_version_id, data_json, completion,
   completed_at, completed_by, data_updated_at, data_updated_by, version, created_at)
SELECT r.id, t.id, ver.id,
       CASE WHEN r.status = 'DRAFT' AND t.code = 'BM-000002' THEN NULL
            ELSE '{"version":"16.0","sheets":{}}' END,
       CASE WHEN r.status = 'DRAFT' AND t.code = 'BM-000001' THEN 'IN_PROGRESS'
            WHEN r.status = 'DRAFT' THEN 'NOT_STARTED'
            WHEN r.status = 'APPROVED' AND p.code = 'Q4' AND t.code = 'BM-000002' THEN 'NO_DATA'
            ELSE 'COMPLETED' END,
       CASE WHEN r.status = 'DRAFT' THEN NULL ELSE COALESCE(r.submitted_at, r.returned_at) - INTERVAL '1 hour' END,
       CASE WHEN r.status = 'DRAFT' THEN NULL ELSE 'admin' END,
       CASE WHEN r.status = 'DRAFT' AND t.code = 'BM-000002' THEN NULL
            ELSE COALESCE(r.submitted_at, r.updated_at) - INTERVAL '2 hours' END,
       CASE WHEN r.status = 'DRAFT' AND t.code = 'BM-000002' THEN NULL ELSE 'admin' END,
       0, r.created_at
FROM asxh_input_reports r
JOIN asxh_report_periods p ON p.id = r.period_id
JOIN asxh_report_calendars c ON c.id = p.calendar_id AND c.year_no = 2026
JOIN asxh_publications pub ON pub.id = r.publication_id
JOIN asxh_period_assignments a ON a.period_id = r.period_id AND a.unit_id = r.unit_id
JOIN asxh_templates t ON t.id = a.template_id
JOIN LATERAL (
  SELECT v.id FROM asxh_template_versions v
  WHERE v.template_id = t.id AND v.status = 'PUBLISHED'
    AND v.effective_from <= CAST(pub.created_at AS date)
  ORDER BY v.effective_from DESC, v.id DESC
  LIMIT 1
) ver ON TRUE
WHERE p.code IN ('Q1', 'Q4');

-- 8. Số đếm của đợt (chỉ phiếu phát lần đầu — phiên bản sau khi trả lại không phải phiếu mới).
UPDATE asxh_publications pub SET
  unit_count = (SELECT count(DISTINCT r.unit_id) FROM asxh_input_reports r
                WHERE r.publication_id = pub.id),
  report_count = (SELECT count(*) FROM asxh_input_reports r
                  WHERE r.publication_id = pub.id AND r.revision_no = 1),
  sheet_count = (SELECT count(*) FROM asxh_input_report_sheets s
                 JOIN asxh_input_reports r ON r.id = s.report_id
                 WHERE r.publication_id = pub.id AND r.revision_no = 1)
WHERE pub.period_id IN (SELECT p.id FROM asxh_report_periods p
                        JOIN asxh_report_calendars c ON c.id = p.calendar_id
                        WHERE c.year_no = 2026);

--rollback DELETE FROM asxh_input_report_sheets WHERE report_id IN (SELECT r.id FROM asxh_input_reports r JOIN asxh_report_periods p ON p.id = r.period_id JOIN asxh_report_calendars c ON c.id = p.calendar_id WHERE c.year_no = 2026);
--rollback UPDATE asxh_input_reports SET previous_revision_id = NULL WHERE period_id IN (SELECT p.id FROM asxh_report_periods p JOIN asxh_report_calendars c ON c.id = p.calendar_id WHERE c.year_no = 2026);
--rollback DELETE FROM asxh_input_reports WHERE period_id IN (SELECT p.id FROM asxh_report_periods p JOIN asxh_report_calendars c ON c.id = p.calendar_id WHERE c.year_no = 2026);
--rollback DELETE FROM asxh_publications WHERE period_id IN (SELECT p.id FROM asxh_report_periods p JOIN asxh_report_calendars c ON c.id = p.calendar_id WHERE c.year_no = 2026);
--rollback DELETE FROM asxh_period_assignments WHERE period_id IN (SELECT p.id FROM asxh_report_periods p JOIN asxh_report_calendars c ON c.id = p.calendar_id WHERE c.year_no = 2026);
--rollback UPDATE asxh_report_periods SET status = 'DRAFT' WHERE code IN ('Q1', 'Q3', 'Q4') AND calendar_id IN (SELECT id FROM asxh_report_calendars WHERE year_no = 2026);
