--liquibase formatted sql

--changeset dth:103-seed-report-calendars
--comment Quyền của report_calendars và report_periods, cấp cho các role, và lịch mẫu năm 2026 kèm đủ kỳ.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('report_calendars:read',   'Xem lịch báo cáo',          'Xem lịch báo cáo năm và khung xem trước kỳ',            TRUE),
  ('report_calendars:write',  'Tạo và sửa lịch báo cáo',   'Tạo lịch năm (kèm sinh kỳ), đổi loại kỳ và hạn nộp',    TRUE),
  ('report_calendars:delete', 'Xoá lịch báo cáo',          'Xoá lịch năm chưa có kỳ nào được gán cho đơn vị',       TRUE),
  ('report_periods:read',     'Xem kỳ báo cáo',            'Xem danh sách và chi tiết kỳ báo cáo',                  TRUE),
  ('report_periods:write',    'Sửa kỳ báo cáo',            'Tinh chỉnh cửa sổ nhận nhập liệu của kỳ chưa mở đợt',   TRUE),
  ('report_periods:delete',   'Xoá kỳ báo cáo',            'Xoá kỳ chưa thiết lập',                                 TRUE);

-- ADMIN phải được ghi rõ: 005 chỉ cấp cho ADMIN những quyền tồn tại lúc nó chạy.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'report_calendars:read', 'report_calendars:write', 'report_calendars:delete',
  'report_periods:read', 'report_periods:write', 'report_periods:delete')
WHERE r.code = 'ADMIN';

-- Kỳ hiện ở mọi màn nhập liệu / tổng hợp, nên MANAGER và USER được xem.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('report_calendars:read', 'report_periods:read')
WHERE r.code IN ('MANAGER', 'USER');

-- Lịch mẫu 2026: đủ bốn loại kỳ, hạn nộp 5 ngày sau khi hết kỳ.
INSERT INTO asxh_report_calendars (year_no, deadline_days, kinds, created_at) VALUES
  (2026, 5, 'THANG,QUY,SAU_THANG,NAM', TIMESTAMP WITH TIME ZONE '2026-01-02 08:00:00+07');

-- Kỳ sinh đúng như PeriodPlanner: khoảng số liệu phủ trọn tháng, cửa sổ mở từ ngày đầu
-- kỳ, hạn nộp = ngày cuối kỳ + 5. Tất cả ở "Chưa thiết lập" (DRAFT); seed của slice
-- thiết lập kỳ (120+) chuyển trạng thái cho khớp với thiết lập / đợt nó tạo.
WITH cal AS (
  SELECT id, year_no FROM asxh_report_calendars WHERE year_no = 2026
), plan AS (
  -- Tháng 1..12
  SELECT 'THANG' AS kind, m AS seq, 'T' || m AS code, 'Tháng ' || m || '/2026' AS name,
         m AS first_month, m AS last_month
  FROM generate_series(1, 12) AS m
  UNION ALL
  -- Quý I..IV
  SELECT 'QUY', q, 'Q' || q,
         'Quý ' || (ARRAY['I', 'II', 'III', 'IV'])[q] || '/2026',
         q * 3 - 2, q * 3
  FROM generate_series(1, 4) AS q
  UNION ALL
  SELECT 'SAU_THANG', 1, '6TĐN', '6 tháng đầu năm 2026', 1, 6
  UNION ALL
  SELECT 'SAU_THANG', 2, '6TCN', '6 tháng cuối năm 2026', 7, 12
  UNION ALL
  SELECT 'NAM', 1, 'NAM', 'Năm 2026', 1, 12
), dated AS (
  SELECT p.kind, p.seq, p.code, p.name,
         make_date(c.year_no, p.first_month, 1) AS from_date,
         (make_date(c.year_no, p.last_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS to_date,
         c.id AS calendar_id
  FROM plan p CROSS JOIN cal c
)
INSERT INTO asxh_report_periods
  (calendar_id, kind, seq, code, name, from_date, to_date, open_from, deadline, status, created_at)
SELECT calendar_id, kind, seq, code, name, from_date, to_date,
       from_date, to_date + 5, 'DRAFT', TIMESTAMP WITH TIME ZONE '2026-01-02 08:00:00+07'
FROM dated;

--rollback DELETE FROM asxh_report_periods WHERE calendar_id IN (SELECT id FROM asxh_report_calendars WHERE year_no = 2026);
--rollback DELETE FROM asxh_report_calendars WHERE year_no = 2026;
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'report_calendars:%' OR code LIKE 'report_periods:%');
--rollback DELETE FROM permissions WHERE code LIKE 'report_calendars:%' OR code LIKE 'report_periods:%';
