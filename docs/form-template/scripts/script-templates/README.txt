SCRIPT CHUẨN CHO 18 BIỂU — đồng bộ từ DB ngày 2026-08-22 (bản ĐÃ KIỂM THỬ)
=========================================================================

MỖI BIỂU CÓ 4 SCRIPT (thư mục <biểu>-scripts/):
  1-khoa-o-nhap-lieu.txt      onLoad,beforeEdit,beforeCommit,beforePaste — khoá mọi ô, mở đúng ô nhập
  2-validate-khi-nop.txt      validate      — chặn nộp khi thiếu/sai số
  3-getinputdata-khi-duyet.txt getInputData — chạy TRÊN MÁY CHỦ khi Sở duyệt, ghi ReportLedger
                                              (lưu CẢ số lượng lẫn kinh phí; KHÔNG dùng ctx.cell.getFormula
                                               vì facade máy chủ không hỗ trợ -> rollback phiếu)
  4-tonghop-theo-ky.txt       afterInject   — màn "Tổng hợp theo biểu (kỳ)", đổ số theo ĐÚNG kỳ đang chọn

HAI KIỂU HIỂN THỊ CỦA 4-tonghop-theo-ky.txt
-------------------------------------------
A. MỖI ĐƠN VỊ MỘT DÒNG  (biểu có 1 dòng dữ liệu, cột B = "Chỉ tiêu / Đơn vị"):
     1b, 1c, 1d, 1e, 1f, 1h, 1j, 1k, 1o, 1s
   Dòng gốc thành "Tổng cộng", mỗi đơn vị ĐƯỢC GIAO BIỂU ĐÓ trong kỳ thêm một dòng bên dưới (tên đơn vị ở
   cột B, STT ở cột A). Đơn vị chưa nộp vẫn có dòng, số để trống; đơn vị không được giao biểu thì không có
   dòng. Nguồn đơn vị: GET /rest/qt/summary/period-organizations?periodId=...&sourceSheetCode=<ctx.shared.sheetCode>
   (lọc theo tờ biểu đã phát hành cho đơn vị) ; số liệu: /summary/data?periodId=...&groupByOrg=true

B. CỘNG GỘP MỘT BẢNG  (biểu mà mỗi DÒNG là một CHỈ TIÊU, không có chỗ cho đơn vị):
     1a, 1g, 1i, 1l, 1m, 1n, 1p, 1q
   Cộng mọi đơn vị thành một bảng; nguồn: /summary/data?periodId=... (không groupByOrg).

QUY TẮC BẤT BIẾN
----------------
* KHÔNG ghi đè ô có công thức (kinh phí = số lượng x mức x số tháng do template tự tính).
* Ô tham số (mức hỗ trợ, số tháng) phải KHAI SẴN trong workbook mẫu — bị khoá nên đơn vị không nhập được;
  để trống thì kinh phí luôn = 0 (lỗi từng gặp ở 1b bản PB-000002 và 1c).
* Script phải có ở MỌI phiên bản PUBLISHED của cùng chuỗi biểu: màn tổng hợp theo kỳ resolve bản mẫu
  theo NGÀY của kỳ, kỳ quá khứ sẽ mượn bản ban hành sớm nhất — bản đó thiếu script thì biểu trống trơn.

script-summariez/ : script afterInject của BIỂU TỔNG HỢP NĂM (20 tab-sheet), gom theo NĂM DƯƠNG LỊCH
  nửa đầu T1-6 (Kì II) + nửa cuối T7-12 (Kì I). Không dùng khoảng chéo năm học nữa.
  Tab theo đơn vị (1b, 1c, 1d, 1e, 1f, 1h, 1i phần B, 1k) chỉ lấy đơn vị ĐƯỢC GIAO biểu trong năm:
  GET /rest/qt/summary/period-organizations?from=<năm>-01-01&to=<năm>-12-31&reportType=<1b…> — KHÔNG
  lấy /rest/qt/master/organization-units làm danh sách dòng (chỉ dùng tra tên/loại đơn vị có số).


--- README cũ ---
SCRIPT CHUẨN CHO BIỂU 1a–1e (theo form-template)  —  flow script-first, không sổ tạm
====================================================================================
Sinh từ bố cục thật của form-template/*.xlsx (đọc bằng openpyxl, đối chiếu từng ô).
Tham khảo văn phong: ../../scripts/.

MỖI BIỂU = 1 thư mục, 3 script rời (mỗi file = 1 bản ghi QtTemplateScript trong Designer,
gắn đúng reportType, enabled = true, chạy theo displayOrder):
  1-khoa-o-nhap-lieu.txt        (1) onLoad: lockAll → mở đúng ô nhập; beforeEdit/Commit/Paste
  2-validate-khi-nop.txt        (2) validate — trình duyệt, khi bấm NỘP (ERROR chặn)
  3-getinputdata-khi-duyet.txt  (3) getInputData — máy chủ (GraalJS), khi Sở DUYỆT → ghi QT_REPORT_LEDGER

NGUYÊN TẮC CHUNG (bản đã chốt — hệ thống tổng hợp đa kỳ mọi biểu về kỳ/năm):
  • MỨC hỗ trợ và SỐ THÁNG (= 5) là HẰNG SỐ CHÍNH SÁCH → KHOÁ, đơn vị KHÔNG chỉnh. Đơn vị
    chỉ nhập SỐ NGƯỜI (+ kinh phí NHẬP TAY nếu có) + ghi chú.
  • "CÔNG THỨC THÌ KHÔNG LƯU": ô kinh phí =ROUND(...) → BỎ (không lưu, tránh đóng băng sai số
    làm tròn khi cộng nhiều đơn vị/kỳ). Ô NHẬP TAY (kể cả kinh phí đơn vị tự nhập, KHÔNG công
    thức) → LƯU, vì là số gốc không tính lại được. Ô tổng/tiểu tổng → không lưu.
  • Sổ cái mỗi chỉ tiêu = SỐ NGƯỜI (quantity) [+ kinh phí nhập tay (amount) nếu có]. Mức/số
    tháng KHÔNG vào sổ (là tham số template). Kinh phí công thức do biểu 01/TỔNG HỢP tính lại
    = số người × mức_template × 5 tháng.
  • measureKind: TẤT CẢ để NGUOI mặc định (số người → MAX qua kỳ, tiền → SUM) → KHÔNG phải
    set tay, KHÔNG phải mở rộng registration. (Vì mức & số tháng đã khoá, hết loại DON_GIA/LUOT.)
  • organizationCode = '' (1 đơn vị/phiếu; backend gắn đơn vị của phiếu). KHÔNG phải nhập hộ như 1g.
  • ctx.mode !== 'input' → onLoad không khoá (để màn Tổng hợp dùng script afterInject riêng).

MÔ HÌNH TỪNG BIỂU (sau khi khoá mức + số tháng):
  1a  1 đơn vị, dọc theo chỉ tiêu   → 15 dòng lá, lưu SỐ ĐỐI TƯỢNG (C). D (kinh phí) là công thức, bỏ. Tham số C33:C37 khoá.
  1b  1 đơn vị, 1 dòng ngang        → 4 chỉ tiêu: đối tượng ăn trưa (q), định suất nấu ăn (q), KP nấu ăn (a, nhập tay), KP GV lớp ghép (a, nhập tay). Mức D / thời gian E khoá.
  1c  1 đơn vị, 1 dòng              → 1 chỉ tiêu: số GV (q). Mức/thời gian khoá; F (kinh phí) công thức, bỏ.
  1d  1 đơn vị, 1 dòng              → 1 chỉ tiêu: số đối tượng (q). D8 số tháng = 5 khoá; tham số C16:C18 khoá; E/F/G/H công thức, bỏ.
  1e  1 đơn vị, 1 dòng nhiều thành phần → 6 chỉ tiêu: 3 số HS (q) + 3 kinh phí nhập tay N/O/P (a). C19 số tháng = 5 khoá; mức C15:C18 khoá.

CẦN LÀM TRƯỚC KHI PUBLISH:
  1. Mã chỉ tiêu TỰ ĐĂNG KÝ từ literal BINDINGS trong getInputData khi lưu template
     (TemplateIndicatorRegistrationService). Không tạo QtCriterion tay. Cùng code phải cùng name
     ở mọi script/biểu (kể cả biểu 01) — khác → chặn lưu.
  2. File Excel mẫu phải để sẵn SỐ THÁNG = 5: 1d ô D8, 1e ô C19 (nếu trống → công thức nhân
     số tháng ra 0). Các mức C33:C37 (1a), C16:C18 (1d), C15:C18 (1e) là giá trị chính sách.
  3. Kiểm tên SHEET đúng ('1a'..'1e').
  4. Biểu 01/TỔNG HỢP phải chép ĐÚNG từng dạng công thức của biểu con (1a có 8 dạng: ×5,
     4×/1000, 0.7×/1000×4, 0.5×…) để tính lại kinh phí khớp — điểm dễ sai nhất.
  5. Nếu biểu nào thực tế có NHIỀU dòng đối tượng → đổi getInputData/validate sang quét danh sách
     dòng như 1a.

CHƯA BAO GỒM (làm sau nếu cần): script TỔNG HỢP (afterInject) cho màn "Xem tổng hợp" —
xem mẫu ../../scripts/TongHop/ (1a, 1b).
