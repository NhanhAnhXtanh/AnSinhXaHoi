-- CHỈ ĐỌC — chạy TRƯỚC khi triển khai changeset 170-split-asxh-template-scripts lên một CSDL đã có dữ liệu,
-- để người duyệt thấy trước changeset sẽ tách bao nhiêu kịch bản cho từng phiên bản mẫu.
--
--   psql -h <máy> -U postgres -d <csdl> -f docs/form-template/sql/170-dem-khoi-truoc-khi-tach.sql
--
-- Luật tách (giống ScriptTextSplitter.java):
--   * script_text rỗng                         -> 0 kịch bản;
--   * có dòng "// ===== [Khối Jmix k/n] ... =====" -> mỗi dòng đánh dấu một kịch bản;
--   * mảng JSON [{ code, ... }]                -> mỗi phần tử có "code" một kịch bản;
--   * còn lại                                   -> 1 kịch bản "Script của mẫu" (cả đoạn mã).
-- Phiên bản nào đã có kịch bản trong bảng asxh_template_scripts thì changeset BỎ QUA (chạy lại không nhân đôi).
-- Cột "khoi_khai_bao" là n trong "k/n" của dòng đánh dấu đầu; khác "so_kich_ban" là dấu hiệu thiếu khối.

WITH v AS (
    SELECT tv.id,
           t.code        AS ma_bieu,
           t.short_name  AS ten_bieu,
           tv.version_no AS phien_ban,
           tv.status     AS trang_thai,
           coalesce(tv.script_text, '') AS script_text
    FROM asxh_template_versions tv
    JOIN asxh_templates t ON t.id = tv.template_id
),
dem AS (
    SELECT v.*,
           (SELECT count(*) FROM regexp_matches(v.script_text, '^// ===== \[Khối Jmix [0-9]+/[0-9]+\]', 'gn')) AS so_dong_danh_dau,
           substring(v.script_text FROM '// ===== \[Khối Jmix [0-9]+/([0-9]+)\]') AS khoi_khai_bao
    FROM v
)
SELECT d.id,
       d.ma_bieu,
       d.ten_bieu,
       d.phien_ban,
       d.trang_thai,
       length(d.script_text) AS do_dai,
       CASE
           WHEN btrim(d.script_text) = '' THEN 'rong'
           WHEN d.so_dong_danh_dau > 0 THEN 'khoi-jmix'
           WHEN left(btrim(d.script_text), 1) = '[' THEN 'mang-json'
           ELSE 'mot-doan'
       END AS dang,
       CASE
           WHEN btrim(d.script_text) = '' THEN 0
           WHEN d.so_dong_danh_dau > 0 THEN d.so_dong_danh_dau
           ELSE 1   -- mảng JSON: đếm thật bằng tay; mọi CSDL hiện có đều không dùng dạng này
       END AS so_kich_ban,
       d.khoi_khai_bao
FROM dem d
ORDER BY d.ma_bieu, d.phien_ban;

-- Tổng
SELECT count(*) FILTER (WHERE btrim(coalesce(script_text, '')) <> '') AS so_phien_ban_co_script,
       count(*)                                                       AS tong_phien_ban
FROM asxh_template_versions;
