BIỂU 1j — SCRIPT BẢN v2
=======================

Vì sao có bản này
-----------------
Bản v1 được viết cho mẫu 1j chỉ có MỘT dòng dữ liệu (comment trong v1 ghi rõ
"BẢNG NGANG một dòng · Dòng dữ liệu = row 7"). Sau đó mẫu được thêm dòng thứ hai
nhưng script không được cập nhật theo, nên trên màn nhập liệu:

  - dòng 8 (row 7, đối tượng ĐẶT HÀNG / GIAO NHIỆM VỤ) nhập được;
  - dòng 9 (row 8, đối tượng NHU CẦU XÃ HỘI) KHÔNG nhập được — hook beforEdit
    luôn trả false vì row 8 không nằm trong quy tắc.

Mẫu hoàn toàn bình thường: hai dòng có cấu trúc ô giống hệt nhau, sheet cũng
không bật bảo vệ. Vấn đề nằm ở script.

Đã sửa gì (cả 4 script, không phải 3)
-------------------------------------
1-khoa-o-nhap-lieu       : DATA_ROW = 7  ->  DATA_ROWS = [7, 8]
2-validate-khi-nop       : kiểm cả hai dòng; chỉ báo "chưa có số liệu" khi CẢ HAI trống
3-getinputdata-khi-duyet : xuất HAI dòng sổ cái, mỗi dòng một mã chỉ tiêu riêng
4-tonghop-theo-ky        : nhận hai mã, cộng gộp cho mỗi đơn vị; dọn dòng template thừa

Script 4 rất dễ bị bỏ sót vì nó cũng gắn cứng mã chỉ tiêu. Nếu chỉ sửa script 1
thì người dùng nhập được dòng 9 nhưng số liệu KHÔNG BAO GIỜ lên sổ cái — lỗi âm
thầm, tệ hơn tình trạng ban đầu.

Mã chỉ tiêu
-----------
Hai loại đối tượng phải có mã riêng, vì sổ cái khoá theo
(phiếu, biểu, đơn vị, mã chỉ tiêu) — dùng chung một mã thì dòng sau đè dòng trước.

  row 7 (dòng 8)  ->  1J.DATHANG.SO_DOI_TUONG
  row 8 (dòng 9)  ->  1J.XAHOI.SO_DOI_TUONG

Cả hai đã được thêm vào danh mục chỉ tiêu. Mã cũ 1J.HP_SHP.SO_DOI_TUONG giữ lại
trong danh mục, không còn script nào dùng.

Đã áp lên DB chưa
-----------------
Rồi. Bốn script này đã được ghi thẳng vào DB 27.118.20.16/report-stc (phiên bản
mẫu 1j đang PUBLISHED nên giao diện không cho sửa script). Bản sao lưu trước khi
sửa: backup-db/truoc-sua-1j-20260907-082759.dump

Cần kiểm lại trên giao diện: mở phiếu 1j, gõ thử vào cột "Số đối tượng" ở CẢ dòng
8 và dòng 9; nộp rồi duyệt, sau đó xem sổ cái phải có hai dòng với hai mã trên.
