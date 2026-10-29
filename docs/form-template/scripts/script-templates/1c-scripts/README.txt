BỘ SCRIPT CHUẨN CHO BIỂU 1c (Phụ lục 01c — chế độ giáo viên mầm non)
====================================================================
Nguồn cấu trúc: form-template/1c.xlsx (sheet '1c', A1:Z10).

  1-khoa-o-nhap-lieu.txt        displayOrder = 1
  2-validate-khi-nop.txt        displayOrder = 2
  3-getinputdata-khi-duyet.txt  displayOrder = 3

BẢNG NGANG một dòng (row 7, 0-based):
  C(c2) Số giáo viên | D(c3) Mức hỗ trợ | E(c4) Thời gian hưởng | F(c5) Tổng kinh phí =ROUND(C*D*E,0) [công thức] | G(c6) Ghi chú

QUY TẮC ĐÃ CHỐT:
  - MỨC (D) và THỜI GIAN (E) là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị chỉ nhập C (số GV) + G (ghi chú).
  - getInputData LƯU 1 chỉ tiêu: 1C.GV_MN.SO_GV (q=C). BỎ ô công thức F. Không lưu mức/thời gian.
    Tổng hợp tính lại kinh phí = số GV × mức template × 5 tháng.
  - measureKind = NGUOI mặc định.

LƯU Ý:
  - Mã 1C.* tự đăng ký từ BINDINGS; cùng code phải cùng name ở mọi biểu.
  - File mẫu chỉ 1 DÒNG dữ liệu; nếu 1c thực tế nhiều dòng → chuyển sang duyệt theo danh sách.
