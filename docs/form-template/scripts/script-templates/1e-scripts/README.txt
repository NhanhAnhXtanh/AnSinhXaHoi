BỘ SCRIPT CHUẨN CHO BIỂU 1e (Phụ lục 01e — HS & trường PTDTBT)
==============================================================
Nguồn cấu trúc: form-template/1e.xlsx (sheet '1e', A1:AD27). Dòng dữ liệu = row 10 (0-based).

  1-khoa-o-nhap-lieu.txt        displayOrder = 1
  2-validate-khi-nop.txt        displayOrder = 2
  3-getinputdata-khi-duyet.txt  displayOrder = 3

BẢNG NGANG một dòng, tiêu đề nhiều tầng. Ô NHẬP TAY:
  D(c3) Số HS bán trú | E(c4) Số HS hỗ trợ thêm tiền nghỉ trọ | F(c5) Số trẻ nhà trẻ
  N(c13) Mua sắm dụng cụ VH/TDTT | O(c14) Lập tủ thuốc | P(c15) Đồ dùng cá nhân trẻ | R(c17) Ghi chú
Ô CÔNG THỨC (khoá): C tổng số HS; G,H,I,J tiền ăn/nhà ở; K định mức nấu ăn; L kinh phí nấu ăn;
  M hỗ trợ bán trú; Q tổng cộng.
Tham số C15:C18 (mức tiền ăn/nhà ở, định mức & mức KP nấu ăn) + C19 số tháng.

QUY TẮC ĐÃ CHỐT:
  - MỨC C15:C18 và SỐ THÁNG C19 = 5 là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị nhập: số HS (D,E,F),
    3 kinh phí NHẬP TAY (N,O,P), ghi chú (R).
    ‼ File Excel mẫu phải để sẵn C19 = 5, nếu không mọi công thức nhân số tháng ra 0.
  - getInputData LƯU 6 chỉ tiêu:
      1E.AN_O.HS_BAN_TRU (q=D) · 1E.AN_O.HS_NGHI_TRO (q=E) · 1E.AN_O.TRE_NHA_TRE (q=F)
      1E.BAN_TRU.DUNG_CU (a=N) · 1E.BAN_TRU.TU_THUOC (a=O) · 1E.DO_DUNG_CA_NHAN (a=P)
    BỎ mọi ô công thức C,G,H,I,J,K,L,M,Q. Không lưu số tháng/mức. N,O,P là kinh phí NHẬP TAY →
    lưu nguyên (SUM qua kỳ). Ăn/ở/nấu ăn do biểu 01 tính lại = số HS × mức template × 5 tháng.
  - measureKind = NGUOI mặc định.

LƯU Ý:
  - 6 mã 1E.* tự đăng ký từ BINDINGS; cùng code phải cùng name ở mọi biểu.
  - File mẫu chỉ 1 DÒNG dữ liệu; nếu 1e thực tế nhiều dòng → chuyển sang duyệt theo danh sách.
