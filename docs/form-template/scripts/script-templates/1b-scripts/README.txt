BỘ SCRIPT CHUẨN CHO BIỂU 1b (Phụ lục 01b — GDMN theo NĐ 105/2020)
=================================================================
Nguồn cấu trúc: form-template/1b.xlsx (sheet '1b', A1:O10).

  1-khoa-o-nhap-lieu.txt        displayOrder = 1
  2-validate-khi-nop.txt        displayOrder = 2
  3-getinputdata-khi-duyet.txt  displayOrder = 3
  4-tonghop-theo-ky.txt         displayOrder = 4  (afterInject — màn Tổng hợp theo kỳ)
  5-so-cai-so.txt               displayOrder = 5  (guard mode summary-edit + getSummaryData — sổ cái Sở)

  MỘT bộ script cho mọi màn: dán cả 5 file vào CÙNG phiên bản mẫu. Guard màn nhập (file 1) không ý kiến
  ở ctx.mode = 'summary-edit'; guard Sở (file 5) chỉ có hiệu lực ở mode đó.

BẢNG NGANG một dòng (row 7, 0-based). Nhóm cột:
  C(c2) Đối tượng ăn trưa | D(c3) Mức | E(c4) Thời gian | F(c5) Kinh phí =ROUND(C*D*E,0) [công thức]
  G(c6) Số định suất nấu ăn | H(c7) Kinh phí nấu ăn | I(c8) Kinh phí GV lớp ghép
  J(c9) Tổng =ROUND(F+H+I,0) [công thức] | K(c10) Ghi chú

QUY TẮC ĐÃ CHỐT:
  - MỨC (D) và THỜI GIAN (E) là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị nhập: C (đối tượng), G (định
    suất), H, I (kinh phí NHẬP TAY, không công thức), K (ghi chú).
  - getInputData LƯU 4 chỉ tiêu:
      1B.AN_TRUA.DOI_TUONG (q=C)  ·  1B.NAU_AN.DINH_SUAT (q=G)
      1B.NAU_AN.KINH_PHI (a=H)    ·  1B.GV_LOP_GHEP.KINH_PHI (a=I)
    BỎ ô công thức F (kinh phí ăn trưa), J (tổng). Không lưu mức/thời gian (khoá). Ghi chú K → dòng đầu.
  - H, I là kinh phí đơn vị TỰ NHẬP (không công thức) → lưu nguyên, tổng hợp SUM qua kỳ.
    Kinh phí ăn trưa (F) do biểu 01 tính lại = đối tượng × mức template × thời gian(5).
  - measureKind = NGUOI mặc định cho mọi mã.

LƯU Ý:
  - Mã 1B.* tự đăng ký từ BINDINGS; cùng code phải cùng name ở mọi biểu.
  - File mẫu chỉ 1 DÒNG dữ liệu; nếu 1b thực tế nhiều dòng → chuyển sang duyệt theo danh sách dòng như 1a.
