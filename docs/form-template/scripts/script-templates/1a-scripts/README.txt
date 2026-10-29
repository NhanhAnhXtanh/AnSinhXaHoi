BỘ SCRIPT CHUẨN CHO BIỂU 1a (Phụ lục 01a) — flow script-first, không sổ tạm
==========================================================================
Nguồn cấu trúc: form-template/1a.xlsx (sheet '1a', A1:I49).

  1-khoa-o-nhap-lieu.txt        displayOrder = 1  (onLoad khoá + beforeEdit/Commit/Paste)
  2-validate-khi-nop.txt        displayOrder = 2  (validate — trình duyệt, khi bấm NỘP)
  3-getinputdata-khi-duyet.txt  displayOrder = 3  (getInputData — máy chủ, khi Sở DUYỆT)
  4-tonghop-theo-ky.txt         displayOrder = 4  (afterInject — màn Tổng hợp theo kỳ)
  5-so-cai-so.txt               displayOrder = 5  (guard mode summary-edit + getSummaryData — sổ cái Sở)

  MỘT bộ script cho mọi màn: dán cả 5 file vào CÙNG phiên bản mẫu. Guard màn nhập (file 1) không ý kiến
  ở ctx.mode = 'summary-edit'; guard Sở (file 5) chỉ có hiệu lực ở mode đó.

BỐ CỤC (0-based):
  - A1:B1 (r0) đơn vị | B3 (r2,c1) tháng/năm.
  - Cột C (c2) Số đối tượng — 15 DÒNG LÁ: 9,12,13,14,15,16,17,18,19,20,23,24,25,27,28.
    Các dòng tiểu tổng C8,C9,C11,C12,C22,C23,C27 là công thức (giữ khoá).
  - Cột D (c3) Kinh phí — CÔNG THỨC toàn bộ =ROUND(SoĐT × mức, 0) (giữ khoá).
  - Cột E (c4) Ghi chú — E8:E29 (r7..r28).
  - Tham số C33:C37 (r32..r36): mức CP học tập / miễn HP / HP đại học / HP nghệ thuật.

QUY TẮC ĐÃ CHỐT:
  - MỨC C33:C37 và SỐ THÁNG (=5, nhúng trong công thức) là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị
    CHỈ nhập Số đối tượng (C, dòng lá) + ghi chú (E).
  - getInputData chỉ lưu SỐ ĐỐI TƯỢNG (C). Cột D (kinh phí) là công thức → BỎ (amount = null).
    Màn Tổng hợp tự tính lại kinh phí = Số đối tượng × mức template × 5 tháng.
  - measureKind = NGUOI mặc định (số người → MAX qua kỳ). Không cần set tay.

LƯU Ý:
  - 15 mã chỉ tiêu 1A.* TỰ đăng ký QtCriterion từ BINDINGS khi lưu template; cùng code phải
    cùng name ở mọi biểu (kể cả biểu 01) — khác → chặn lưu.
  - SHEET = '1a' là TÊN sheet trong workbook (không phải sheetCode BM-xxxxxx).
