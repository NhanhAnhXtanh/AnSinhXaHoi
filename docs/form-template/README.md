# Biểu mẫu và script ASXH (bản đang chạy)

Thư mục này là **bản sao của các kịch bản mà DB đang giữ** (bảng `asxh_template_scripts`, phiên bản
PUBLISHED mới nhất của từng biểu), kèm file Excel gốc của các biểu.

- `form-org/form-templates/` — Excel gốc biểu nhập 1a…1s; `form-org/form-sumariez/` — Excel gốc biểu tổng hợp.
- `scripts/script-templates/<biểu>-scripts/` — script biểu nhập, mỗi file một khối, đánh số theo thứ tự chạy:
  `1-khoa-o-nhap-lieu` (onLoad/beforeEdit…), `2-validate-khi-nop`, `3-getinputdata-khi-duyet`,
  `4-tonghop-theo-ky` (afterInject), `5-so-cai-so` (sổ cái Sở, chỉ 1a/1b).
  Biểu **1j** chạy bản trong `1j-scripts/v2/` (bản v1 ở thư mục cha chỉ để tham khảo).
- `scripts/script-summariez/` — các khối afterInject của biểu tổng hợp `01-TONGHOP`, mỗi file một khối
  (16 khối từ changeset 179 ngày 09/11/2026: thêm `1l`; 17 khối từ changeset 180: thêm `1j`; 18 khối từ changeset 181: thêm `1q` — đủ mọi tab
  trừ `01` (chỉ công thức) và `1r` (không có biểu nhập)).
  Biểu **1j** từ changeset 180 có 5 kịch bản: thêm `5-so-cai-so` (Sổ cái Sở), `4-tonghop-theo-ky` v3 mỗi đơn
  vị hai dòng (đặt hàng, nhu cầu xã hội) để Sở sửa và lưu số theo từng mã chỉ tiêu.
- `scan-donvi.txt`, `scan-tonghop.txt` — bảng quét cấu trúc ô của các biểu.

Trong DB, mỗi phiên bản có NHIỀU kịch bản (như `qt_template_script` của bản Jmix): mỗi file ở trên là
MỘT dòng `asxh_template_scripts` (tên, mô tả, phạm vi biểu, bật/tắt, thứ tự chạy `display_order`), mã
kết thúc bằng `return defineScript({...})`. Thứ tự file (1-, 2-, …) là thứ tự chạy.

Trước changeset 171 (30/10/2026) mọi kịch bản của một phiên bản ghép chung trong cột
`asxh_template_versions.script_text`, mỗi khối mở đầu bằng dòng `// ===== [Khối Jmix k/n] <tên> — hook: … =====`
và bọc trong `(function () { … })();`. Changeset 171 tách mỗi khối thành một kịch bản (tên và hook lấy từ
dòng đánh dấu, gỡ lớp bọc); cột `script_text` còn giữ làm đường lùi nhưng **không còn được đọc / ghi** —
sửa kịch bản thì sửa bảng `asxh_template_scripts` (màn Thiết kế mẫu → Soạn kịch bản của biểu).
Trước khi chạy 171 trên một DB đã có dữ liệu, đếm trước bằng `sql/170-dem-khoi-truoc-khi-tach.sql` (chỉ đọc).

- `sql/170-dem-khoi-truoc-khi-tach.sql` — câu SELECT chỉ đọc: số kịch bản sẽ tách cho từng phiên bản.

Thay đổi gần nhất (11/11/2026): changeset 186 — kịch bản khoá ô (`1-khoa-o-nhap-lieu`) của 18 biểu nhập điền năm vào cuối
tiêu đề và tên kỳ vào dòng "Kết quả thực hiện" khi hai ô còn là chữ mẫu (changeset 188 chuyển đoạn này lên trước dòng
kiểm chế độ để màn Tổng hợp theo kỳ cũng được điền); changeset 187 — nhãn dòng tổng của
`4-tonghop-theo-ky` ghi "Tổng cộng" có dấu.

## Quy tắc đồng bộ

**Sửa kịch bản ở DB thì sửa file tương ứng ở đây trong cùng commit, và ngược lại** — hai bên phải luôn trùng
nội dung (bỏ qua dòng ghi chú đầu file). Đối chiếu: cột `code` của dòng `asxh_template_scripts` cùng tên
khối, thuộc phiên bản PUBLISHED mới nhất của biểu. DB local `asxh-react-dn` là bản chuẩn; DB trên máy chủ sẽ đồng bộ
sau khi triển khai.

Đối soát lần cuối: 29/10/2026 — 89/89 khối khớp với `asxh-react-dn` (khi còn ở dạng `script_text` gộp).
Đếm chỉ đọc 30/10/2026 trên `asxh-react-dn`: 25 phiên bản có script, 147 khối sẽ tách (biểu 01-TongHop
15 khối/phiên bản, 1a và 1b 5, các biểu còn lại 4); mọi khối có dòng đánh dấu và lớp bọc đúng khuôn.
Changeset 171 **chưa chạy** trên `asxh-react-dn` / máy chủ.
