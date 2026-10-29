BỘ SCRIPT CHO BIỂU 1j (Phụ lục 01j — hỗ trợ tiền đóng học phí + sinh hoạt phí)
==============================================================================
Nguồn cấu trúc: form-template/1j.xlsx (sheet '1j', A1:I17). Dòng dữ liệu = row 7 (0-based).
  C(2)=Đối tượng | D(3)=Mức thu học phí | E(4)=Số tháng (=10)
  F(5)=G+H · G(6)=ROUND(C*D) hỗ trợ học phí · H(7)=ROUND(C*C12*E) SHP  ← CÔNG THỨC | I(8)=Ghi chú

QUY TẮC (ĐÃ CHỐT — mức + số tháng GẮN TEMPLATE, khoá; chỉ nhập đối tượng + ghi chú):
  - MỨC THU HỌC PHÍ (D), SỐ THÁNG (E=10), mức SHP (C12=3,63) gắn template → KHOÁ, đơn vị KHÔNG sửa.
    ‼ File Excel để sẵn D (mức thu học phí) + E8 = 10.
  - Đơn vị CHỈ nhập C (số đối tượng) + I (ghi chú).
  - getInputData lưu 1 chỉ tiêu: 1J.HP_SHP.SO_DOI_TUONG (q=C). BỎ ô công thức F,G,H.
  - Tổng hợp tính lại kinh phí = số ĐT × mức thu học phí (template) + số ĐT × 3,63 × 10.
  - measureKind = NGUOI mặc định.

KHÔNG cần cột 'rate'/DON_GIA nữa: mức thu học phí GẮN TEMPLATE (cố định), không nhập động → không
  lưu vào sổ cái. (Bản trước cho nhập động nên tính thêm cột rate — nay đã bỏ.)

LƯU Ý NGHIỆP VỤ: mức thu học phí gắn template là MỘT mức chung. Nếu học phí thực tế khác nhau giữa
  các trường thì mức chung không phản ánh đúng — cần xác nhận mức này áp chung được cho mọi đơn vị.
