--liquibase formatted sql

-- Biểu 1a, kịch bản "Validate" (hook validate, chạy khi đơn vị bấm Kiểm tra & hoàn tất / Nộp phiếu):
--   * số đối tượng phải là số nguyên, không quá 10 triệu (trước đây 2.5 người, 1e20 người vẫn qua);
--   * kinh phí không âm, không quá 1 triệu tỷ đồng;
--   * mỗi lỗi ghi `source` (ô gây lỗi) để màn nhập tô đỏ đúng ô cần sửa.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/1a-scripts/2-validate-khi-nop.txt (cùng nội dung,
-- bỏ dòng ghi chú đầu file).
--
-- Chỉ ghi đè dòng còn đúng bản cũ (md5 df4498d8…, bản đối soát 29/10/2026): kịch bản ai đó đã sửa ở màn
-- Thiết kế mẫu thì giữ nguyên. Bỏ ký tự CR để nội dung không đổi theo cách git lấy file trên Windows. CSDL không có biểu 1a thật (CSDL thử dth-framework) thì không đổi dòng nào.

--changeset dth:172-update-1a-validate-whole-number splitStatements:false
--comment Biểu 1a: kiểm số đối tượng là số nguyên, trần số liệu, ghi ô lỗi để tô đỏ
UPDATE asxh_template_scripts
SET code = replace($js$// ==== 1a · Script 2/3: VALIDATE KHI NỘP ====
// displayOrder = 2, enabled = true, gắn biểu reportType = "1a".
// Chạy trong TRÌNH DUYỆT khi bấm NỘP. issue 'ERROR' chặn nộp; 'WARNING' cảnh báo. Chỉ ĐỌC ô.
//
// KIỂM: Số đối tượng (cột C) VÀ Kinh phí (cột D) đều phải LÀ SỐ (nếu có nhập/ tính ra).
//   - Số đối tượng: số nguyên, không âm, không quá MAX_QUANTITY (2.5 người, 1e20 người bị chặn).
//   - Kinh phí là ô CÔNG THỨC → đọc giá trị đã tính; kiểm "là số" bắt luôn lỗi công thức;
//     không âm, không quá MAX_AMOUNT đồng.
//   - Mỗi lỗi ghi `source` = ô gây lỗi để màn nhập tô đỏ ô đó (2/11/2026).
// KHÔNG kiểm Ghi chú (cột E) — ghi gì cũng được.
//
// THÔNG BÁO (message) dùng TÊN chỉ tiêu (không in MÃ). `code` chỉ để host gom nhóm;
// `businessKey` (mã) chỉ để tra cứu nội bộ — banner hiển thị `message`.

const SHEET = '1a';
const MAX_QUANTITY = 10000000;          // 10 triệu người — vượt xa dân số toàn tỉnh
const MAX_AMOUNT = 1000000000000000;    // 1 triệu tỷ đồng

// Mỗi dòng lá: mã (nội bộ) + tên (hiển thị) + ô Số đối tượng (C) + ô Kinh phí (D). Ghi chú (E) không kiểm.
const BINDINGS = [
  { code: '1A.HT_CPHT.CHUNG', name: 'Hỗ trợ chi phí học tập', quantity: { row: 9, col: 2 }, amount: { row: 9, col: 3 } },
  { code: '1A.MIEN_HP.TN_THCS_TRUNG_CAP', name: 'Miễn học phí – Tốt nghiệp THCS học lên trung cấp', quantity: { row: 12, col: 2 }, amount: { row: 12, col: 3 } },
  { code: '1A.MIEN_HP.NGUOI_CO_CONG', name: 'Miễn học phí – Đối tượng theo Pháp lệnh Ưu đãi người có công', quantity: { row: 13, col: 2 }, amount: { row: 13, col: 3 } },
  { code: '1A.MIEN_HP.MO_COI', name: 'Miễn học phí – HSSV mồ côi cả cha lẫn mẹ', quantity: { row: 14, col: 2 }, amount: { row: 14, col: 3 } },
  { code: '1A.MIEN_HP.DTTS_NGHEO', name: 'Miễn học phí – HSSV dân tộc thiểu số hộ nghèo/cận nghèo', quantity: { row: 15, col: 2 }, amount: { row: 15, col: 3 } },
  { code: '1A.MIEN_HP.KHUYET_TAT', name: 'Miễn học phí – HSSV khuyết tật', quantity: { row: 16, col: 2 }, amount: { row: 16, col: 3 } },
  { code: '1A.MIEN_HP.SO_GDDT', name: 'Miễn học phí – Đối tượng thuộc Sở GD&ĐT', quantity: { row: 17, col: 2 }, amount: { row: 17, col: 3 } },
  { code: '1A.MIEN_HP.XA_PHUONG', name: 'Miễn học phí – Đối tượng thuộc các xã, phường', quantity: { row: 18, col: 2 }, amount: { row: 18, col: 3 } },
  { code: '1A.MIEN_HP.NCL_SO_GD', name: 'Miễn học phí – Hỗ trợ học phí HS ngoài công lập khối Sở GD', quantity: { row: 19, col: 2 }, amount: { row: 19, col: 3 } },
  { code: '1A.MIEN_HP.NCL_XA_PHUONG', name: 'Miễn học phí – Hỗ trợ học phí HS ngoài công lập khối xã, phường', quantity: { row: 20, col: 2 }, amount: { row: 20, col: 3 } },
  { code: '1A.GIAM_HP.70.NGHE_NANG_NHOC', name: 'Giảm 70% học phí – HSSV học nghề nặng nhọc, độc hại, nguy hiểm', quantity: { row: 23, col: 2 }, amount: { row: 23, col: 3 } },
  { code: '1A.GIAM_HP.70.NGHE_THUAT', name: 'Giảm 70% học phí – HSSV học ngành nghệ thuật truyền thống, đặc thù', quantity: { row: 24, col: 2 }, amount: { row: 24, col: 3 } },
  { code: '1A.GIAM_HP.70.DTTS_VUNG_KK', name: 'Giảm 70% học phí – Trẻ MG/HSSV dân tộc thiểu số vùng đặc biệt khó khăn', quantity: { row: 25, col: 2 }, amount: { row: 25, col: 3 } },
  { code: '1A.GIAM_HP.50.TNLD_BNN', name: 'Giảm 50% học phí – Con cha/mẹ bị TNLĐ hoặc bệnh nghề nghiệp hưởng trợ cấp thường xuyên', quantity: { row: 27, col: 2 }, amount: { row: 27, col: 3 } },
  { code: '1A.GIAM_HP.50.CAN_NGHEO', name: 'Giảm 50% học phí – Hộ cận nghèo theo quy định của Thủ tướng Chính phủ', quantity: { row: 28, col: 2 }, amount: { row: 28, col: 3 } },
];

function toNumber(value) {
  if (value == null || value === '') return null;  // trống: bỏ qua
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN; // NaN = có nhập/tính nhưng không phải số
}

return defineScript({
  validate(ctx) {
    const issues = [];
    let filledRows = 0;

    for (const b of BINDINGS) {
      const qty = toNumber(ctx.cell.get(SHEET, b.quantity.row, b.quantity.col));
      const amt = toNumber(ctx.cell.get(SHEET, b.amount.row, b.amount.col));

      const qtyCell = { sheetName: SHEET, row: b.quantity.row, column: b.quantity.col };
      const amtCell = { sheetName: SHEET, row: b.amount.row, column: b.amount.col };

      if (Number.isNaN(qty)) {
        issues.push({ severity: 'ERROR', code: 'QTY_NOT_NUMBER', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng phải là số.` });
      } else if (typeof qty === 'number' && qty < 0) {
        issues.push({ severity: 'ERROR', code: 'QTY_NEGATIVE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng không được âm.` });
      } else if (typeof qty === 'number' && !Number.isInteger(qty)) {
        issues.push({ severity: 'ERROR', code: 'QTY_NOT_WHOLE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng phải là số nguyên (không có phần lẻ).` });
      } else if (typeof qty === 'number' && qty > MAX_QUANTITY) {
        issues.push({ severity: 'ERROR', code: 'QTY_TOO_LARGE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng lớn bất thường, bạn kiểm tra lại số đã nhập.` });
      }

      if (Number.isNaN(amt)) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_NOT_NUMBER', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí phải là số (kiểm tra công thức/tham số).` });
      } else if (typeof amt === 'number' && amt < 0) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_NEGATIVE', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí không được âm.` });
      } else if (typeof amt === 'number' && amt > MAX_AMOUNT) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_TOO_LARGE', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí lớn bất thường, bạn kiểm tra lại số đã nhập.` });
      }

      if ((typeof qty === 'number' && qty > 0) || (typeof amt === 'number' && amt > 0)) filledRows += 1;
    }

    if (filledRows === 0) {
      issues.push({ severity: 'ERROR', code: 'EMPTY_1A',
        message: 'Biểu 1a chưa có số liệu nào để nộp.' });
    }
    return issues;
  },
});$js$, chr(13), ''),
    script_hash = encode(sha256(convert_to(replace($js$// ==== 1a · Script 2/3: VALIDATE KHI NỘP ====
// displayOrder = 2, enabled = true, gắn biểu reportType = "1a".
// Chạy trong TRÌNH DUYỆT khi bấm NỘP. issue 'ERROR' chặn nộp; 'WARNING' cảnh báo. Chỉ ĐỌC ô.
//
// KIỂM: Số đối tượng (cột C) VÀ Kinh phí (cột D) đều phải LÀ SỐ (nếu có nhập/ tính ra).
//   - Số đối tượng: số nguyên, không âm, không quá MAX_QUANTITY (2.5 người, 1e20 người bị chặn).
//   - Kinh phí là ô CÔNG THỨC → đọc giá trị đã tính; kiểm "là số" bắt luôn lỗi công thức;
//     không âm, không quá MAX_AMOUNT đồng.
//   - Mỗi lỗi ghi `source` = ô gây lỗi để màn nhập tô đỏ ô đó (2/11/2026).
// KHÔNG kiểm Ghi chú (cột E) — ghi gì cũng được.
//
// THÔNG BÁO (message) dùng TÊN chỉ tiêu (không in MÃ). `code` chỉ để host gom nhóm;
// `businessKey` (mã) chỉ để tra cứu nội bộ — banner hiển thị `message`.

const SHEET = '1a';
const MAX_QUANTITY = 10000000;          // 10 triệu người — vượt xa dân số toàn tỉnh
const MAX_AMOUNT = 1000000000000000;    // 1 triệu tỷ đồng

// Mỗi dòng lá: mã (nội bộ) + tên (hiển thị) + ô Số đối tượng (C) + ô Kinh phí (D). Ghi chú (E) không kiểm.
const BINDINGS = [
  { code: '1A.HT_CPHT.CHUNG', name: 'Hỗ trợ chi phí học tập', quantity: { row: 9, col: 2 }, amount: { row: 9, col: 3 } },
  { code: '1A.MIEN_HP.TN_THCS_TRUNG_CAP', name: 'Miễn học phí – Tốt nghiệp THCS học lên trung cấp', quantity: { row: 12, col: 2 }, amount: { row: 12, col: 3 } },
  { code: '1A.MIEN_HP.NGUOI_CO_CONG', name: 'Miễn học phí – Đối tượng theo Pháp lệnh Ưu đãi người có công', quantity: { row: 13, col: 2 }, amount: { row: 13, col: 3 } },
  { code: '1A.MIEN_HP.MO_COI', name: 'Miễn học phí – HSSV mồ côi cả cha lẫn mẹ', quantity: { row: 14, col: 2 }, amount: { row: 14, col: 3 } },
  { code: '1A.MIEN_HP.DTTS_NGHEO', name: 'Miễn học phí – HSSV dân tộc thiểu số hộ nghèo/cận nghèo', quantity: { row: 15, col: 2 }, amount: { row: 15, col: 3 } },
  { code: '1A.MIEN_HP.KHUYET_TAT', name: 'Miễn học phí – HSSV khuyết tật', quantity: { row: 16, col: 2 }, amount: { row: 16, col: 3 } },
  { code: '1A.MIEN_HP.SO_GDDT', name: 'Miễn học phí – Đối tượng thuộc Sở GD&ĐT', quantity: { row: 17, col: 2 }, amount: { row: 17, col: 3 } },
  { code: '1A.MIEN_HP.XA_PHUONG', name: 'Miễn học phí – Đối tượng thuộc các xã, phường', quantity: { row: 18, col: 2 }, amount: { row: 18, col: 3 } },
  { code: '1A.MIEN_HP.NCL_SO_GD', name: 'Miễn học phí – Hỗ trợ học phí HS ngoài công lập khối Sở GD', quantity: { row: 19, col: 2 }, amount: { row: 19, col: 3 } },
  { code: '1A.MIEN_HP.NCL_XA_PHUONG', name: 'Miễn học phí – Hỗ trợ học phí HS ngoài công lập khối xã, phường', quantity: { row: 20, col: 2 }, amount: { row: 20, col: 3 } },
  { code: '1A.GIAM_HP.70.NGHE_NANG_NHOC', name: 'Giảm 70% học phí – HSSV học nghề nặng nhọc, độc hại, nguy hiểm', quantity: { row: 23, col: 2 }, amount: { row: 23, col: 3 } },
  { code: '1A.GIAM_HP.70.NGHE_THUAT', name: 'Giảm 70% học phí – HSSV học ngành nghệ thuật truyền thống, đặc thù', quantity: { row: 24, col: 2 }, amount: { row: 24, col: 3 } },
  { code: '1A.GIAM_HP.70.DTTS_VUNG_KK', name: 'Giảm 70% học phí – Trẻ MG/HSSV dân tộc thiểu số vùng đặc biệt khó khăn', quantity: { row: 25, col: 2 }, amount: { row: 25, col: 3 } },
  { code: '1A.GIAM_HP.50.TNLD_BNN', name: 'Giảm 50% học phí – Con cha/mẹ bị TNLĐ hoặc bệnh nghề nghiệp hưởng trợ cấp thường xuyên', quantity: { row: 27, col: 2 }, amount: { row: 27, col: 3 } },
  { code: '1A.GIAM_HP.50.CAN_NGHEO', name: 'Giảm 50% học phí – Hộ cận nghèo theo quy định của Thủ tướng Chính phủ', quantity: { row: 28, col: 2 }, amount: { row: 28, col: 3 } },
];

function toNumber(value) {
  if (value == null || value === '') return null;  // trống: bỏ qua
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN; // NaN = có nhập/tính nhưng không phải số
}

return defineScript({
  validate(ctx) {
    const issues = [];
    let filledRows = 0;

    for (const b of BINDINGS) {
      const qty = toNumber(ctx.cell.get(SHEET, b.quantity.row, b.quantity.col));
      const amt = toNumber(ctx.cell.get(SHEET, b.amount.row, b.amount.col));

      const qtyCell = { sheetName: SHEET, row: b.quantity.row, column: b.quantity.col };
      const amtCell = { sheetName: SHEET, row: b.amount.row, column: b.amount.col };

      if (Number.isNaN(qty)) {
        issues.push({ severity: 'ERROR', code: 'QTY_NOT_NUMBER', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng phải là số.` });
      } else if (typeof qty === 'number' && qty < 0) {
        issues.push({ severity: 'ERROR', code: 'QTY_NEGATIVE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng không được âm.` });
      } else if (typeof qty === 'number' && !Number.isInteger(qty)) {
        issues.push({ severity: 'ERROR', code: 'QTY_NOT_WHOLE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng phải là số nguyên (không có phần lẻ).` });
      } else if (typeof qty === 'number' && qty > MAX_QUANTITY) {
        issues.push({ severity: 'ERROR', code: 'QTY_TOO_LARGE', businessKey: b.code, source: qtyCell,
          message: `${b.name}: số đối tượng lớn bất thường, bạn kiểm tra lại số đã nhập.` });
      }

      if (Number.isNaN(amt)) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_NOT_NUMBER', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí phải là số (kiểm tra công thức/tham số).` });
      } else if (typeof amt === 'number' && amt < 0) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_NEGATIVE', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí không được âm.` });
      } else if (typeof amt === 'number' && amt > MAX_AMOUNT) {
        issues.push({ severity: 'ERROR', code: 'AMOUNT_TOO_LARGE', businessKey: b.code, source: amtCell,
          message: `${b.name}: kinh phí lớn bất thường, bạn kiểm tra lại số đã nhập.` });
      }

      if ((typeof qty === 'number' && qty > 0) || (typeof amt === 'number' && amt > 0)) filledRows += 1;
    }

    if (filledRows === 0) {
      issues.push({ severity: 'ERROR', code: 'EMPTY_1A',
        message: 'Biểu 1a chưa có số liệu nào để nộp.' });
    }
    return issues;
  },
});$js$, chr(13), ''), 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-172'
WHERE md5(code) = 'df4498d89140bfe05c31e200de35177a';
--rollback SELECT 1;
