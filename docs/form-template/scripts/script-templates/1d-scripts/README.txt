BỘ SCRIPT CHUẨN CHO BIỂU 1d (Phụ lục 01d — hỗ trợ học sinh khuyết tật)
======================================================================
Nguồn cấu trúc: form-template/1d.xlsx (sheet '1d', A1:O23).

  1-khoa-o-nhap-lieu.txt        displayOrder = 1
  2-validate-khi-nop.txt        displayOrder = 2
  3-getinputdata-khi-duyet.txt  displayOrder = 3

BẢNG NGANG một dòng (row 7, 0-based):
  C(c2) Số đối tượng | D(c3) Số tháng hỗ trợ
  E(c4) Kinh phí =ROUND(F+G) | F(c5) Học bổng =ROUND(C17*C*D*C16) | G(c6) Mua sắm =C*C18
  H(c7) Tổng kinh phí =ROUND(E) | I(c8) Ghi chú                          [E,F,G,H là công thức]
  Tham số: C16 lương cơ sở, C17 tỷ lệ học bổng, C18 mức mua sắm.

QUY TẮC ĐÃ CHỐT:
  - SỐ THÁNG (D) = 5 CỐ ĐỊNH và tham số C16:C18 là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị chỉ nhập
    C (số đối tượng) + I (ghi chú).
    ‼ File Excel mẫu phải để sẵn D8 = 5, nếu không công thức kinh phí ra 0.
  - getInputData LƯU 1 chỉ tiêu: 1D.HS_KHUYET_TAT.SO_DOI_TUONG (q=C). BỎ ô công thức E,F,G,H.
    Không lưu số tháng/tham số. Tổng hợp tính lại kinh phí = tỷ lệ×sốĐT×5×lương (C16,C17) +
    sốĐT×mức mua sắm (C18).
  - measureKind = NGUOI mặc định.

LƯU Ý:
  - Mã 1D.* tự đăng ký từ BINDINGS; cùng code phải cùng name ở mọi biểu.
  - File mẫu chỉ 1 DÒNG dữ liệu; nếu 1d thực tế nhiều dòng → chuyển sang duyệt theo danh sách.
