BỘ SCRIPT CHO BIỂU 1i (Phụ lục 01i — ưu tiên tuyển sinh + hỗ trợ học tập DTTS rất ít người)
==========================================================================================
Nguồn cấu trúc: form-template/1i.xlsx (sheet '1i', A1:I15). DỌC 5 DÒNG LÁ (r7..r11, 0-based):
  r7 Trẻ mẫu giáo | r8 HS tiểu học-THCS-THPT | r9 HS PTDT bán trú | r10 HS PTDT nội trú | r11 HSSV các trường.
Cột: C(2)=Đối tượng | D(3)=Mức hỗ trợ | E(4)=Số tháng | F(5)=C*D*E*C15 ← CT | G(6)=F ← CT | H(7)=Ghi chú.
Tham số C15 = lương cơ sở (2,53) — khoá.

  1-khoa-o-nhap-lieu.txt / 2-validate-khi-nop.txt / 3-getinputdata-khi-duyet.txt  (displayOrder 1/2/3)

QUY TẮC (mức + số tháng CỐ ĐỊNH, khoá; chỉ nhập số đối tượng):
  - Đơn vị chỉ nhập C (số đối tượng) + H (ghi chú). D (mức), E (số tháng), C15 (lương) KHOÁ.
  - getInputData lưu SỐ ĐỐI TƯỢNG (q=C) 5 dòng (mã 1I.*). BỎ ô công thức F,G. amount = null.
  - Tổng hợp tính lại kinh phí = số ĐT × mức × số tháng × lương. measureKind = NGUOI.

TRẠNG THÁI (form mới, 2026-08) — ĐÃ CHỐT: mức D + số tháng E CỐ ĐỊNH điền sẵn Excel, KHOÁ.
  - MỨC D đã điền sẵn: 0,3 / 0,4 / 0,6 / 1 / 1 (30/40/60/100/100%) — khoá. ✅
  - SỐ THÁNG E: NGƯỜI DÙNG TỰ ĐIỀN vào Excel rồi update template sau (cố định, script tự khoá).
    → KHÔNG dùng cột 'months' sổ cái cho 1i (số tháng không nhập động). Nếu E trống thì KP = 0.
  - Script đã đúng: chỉ mở C (số đối tượng) + H (ghi chú); D, E, C15 khoá; getInputData lưu số ĐT.
