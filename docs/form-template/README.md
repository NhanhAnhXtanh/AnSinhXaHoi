# Biểu mẫu và script ASXH (bản đang chạy)

Thư mục này là **bản sao của script mà DB đang giữ** (`asxh_template_versions.script_text`, phiên bản
PUBLISHED mới nhất của từng biểu), kèm file Excel gốc của các biểu.

- `form-org/form-templates/` — Excel gốc biểu nhập 1a…1s; `form-org/form-sumariez/` — Excel gốc biểu tổng hợp.
- `scripts/script-templates/<biểu>-scripts/` — script biểu nhập, mỗi file một khối, đánh số theo thứ tự chạy:
  `1-khoa-o-nhap-lieu` (onLoad/beforeEdit…), `2-validate-khi-nop`, `3-getinputdata-khi-duyet`,
  `4-tonghop-theo-ky` (afterInject), `5-so-cai-so` (sổ cái Sở, chỉ 1a/1b).
  Biểu **1j** chạy bản trong `1j-scripts/v2/` (bản v1 ở thư mục cha chỉ để tham khảo).
- `scripts/script-summariez/` — 15 khối afterInject của biểu tổng hợp `01-TONGHOP`, mỗi file một khối.
- `scan-donvi.txt`, `scan-tonghop.txt` — bảng quét cấu trúc ô của các biểu.

Trong DB, `script_text` của một phiên bản là các khối trên ghép lại, mỗi khối mở đầu bằng dòng
`// ===== [Khối Jmix k/n] <tên> — hook: … =====` và bọc trong `(function () { … })();`.

## Quy tắc đồng bộ

**Sửa script ở DB thì sửa file tương ứng ở đây trong cùng commit, và ngược lại** — hai bên phải luôn trùng
nội dung (bỏ qua dòng ghi chú đầu file). DB local `asxh-react-dn` là bản chuẩn; DB trên máy chủ sẽ đồng bộ
sau khi triển khai.

Đối soát lần cuối: 29/10/2026 — 89/89 khối khớp với `asxh-react-dn`.
