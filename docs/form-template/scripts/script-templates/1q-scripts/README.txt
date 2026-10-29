BỘ SCRIPT CHO BIỂU 1q (Phụ lục 01q — người có uy tín trong đồng bào DTTS)
=========================================================================
Nguồn cấu trúc: form-template/1q.xlsx (sheet '1q', A1:R24) — CẤU TRÚC MỚI, 2 KHỐI DỌC.

KHỐI A — "Chế độ cung cấp thông tin" (7 dòng lá r8..r14, 0-based): dùng nhóm 5 (cột O/P/Q).
  O(14)=Số đối tượng (NHẬP) | P(15)=Mức (KHOÁ =0,5) | Q(16)=O*P ← CT. Q8(r7)=SUM tổng.
  7 dòng: Báo Dân tộc / Báo Đồng Nai / Báo Bình Phước / Bản tin DTTS / Họp mặt / Tập huấn / Học tập.
KHỐI B — "Hỗ trợ vật chất, động viên tinh thần" (1 dòng r15): dùng nhóm 1–4 (cột C..N).
  Tết C(2)/D(3)/E=C*D*C19 · Ốm đau F(5)/G(6)/H=F*G · Khó khăn I(8)/J(9)/K=I*J · Qua đời L(11)/M(12)/N=L*M.
  Số đối tượng (C/F/I/L) NHẬP; Mức (D/G/J/M) KHOÁ =0,5. Tham số C19 = số lần/năm (Tết) = 2.

QUY TẮC (ĐÃ CHỐT — mức KHOÁ 0,5, chỉ nhập số đối tượng):
  - MỨC (P; D/G/J/M) = 0,5 điền sẵn + KHOÁ; tham số C19 khoá. Đơn vị chỉ nhập SỐ ĐỐI TƯỢNG + ghi chú (R).
    (Khớp ô bôi màu trong Excel: xám = khoá, trắng = nhập.)
  - getInputData lưu 11 chỉ tiêu SỐ ĐỐI TƯỢNG (q): 7 khối A (1Q.TT.*) + 4 khối B (1Q.TET/OM_DAU/KHO_KHAN/QUA_DOI).
    BỎ ô công thức kinh phí (Q; E/H/K/N). Mức + C19 khoá → không lưu. measureKind = NGUOI.
  - Tổng hợp tính lại: khối A = số ĐT × 0,5; khối B Tết = số ĐT × 0,5 × 2 (C19), còn lại = số ĐT × 0,5.

LƯU Ý: mức 0,5 hiện điền đồng loạt (theo yêu cầu). Nếu sau này mức khác nhau theo hoạt động/cấp
  (note cũ: Quyết định 12/2018, "0,5 cấp tỉnh/huyện") thì chỉ cần chỉnh giá trị ô mức trong template.
