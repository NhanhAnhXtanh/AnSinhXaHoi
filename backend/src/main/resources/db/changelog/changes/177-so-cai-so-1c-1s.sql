--liquibase formatted sql

-- Sổ cái Sở cho biểu 1c → 1s (trừ 1j — bảng tổng hợp gộp hai mã chỉ tiêu vào một dòng đơn vị, chưa tách được): trước đây chỉ 1a, 1b có kịch bản "Sổ cái Sở" (getSummaryData + guard ô ở
-- mode 'summary-edit'), các biểu còn lại Sở không sửa / không lưu được số ở màn Tổng hợp. Mỗi biểu:
--   * kịch bản 1 (khoá ô nhập liệu): 3 guard beforeEdit / beforeCommit / beforePaste bỏ qua mode
--     'summary-edit' — ô sổ cái Sở do kịch bản "Sổ cái Sở" quyết (giống 1a, 1b);
--   * thêm kịch bản "Sổ cái Sở" (displayOrder 4) vào MỌI phiên bản của biểu: cùng ô, cùng mã chỉ tiêu
--     với kịch bản đọc số liệu (getInputData); Sở chỉ sửa ô đơn vị nhập (không công thức).
-- Bản đầy đủ: docs/form-template/scripts/script-templates/<biểu>-scripts/1-khoa-o-nhap-lieu.txt và
-- 5-so-cai-so.txt (cùng nội dung, bỏ các dòng ghi chú đầu file).
--
-- Chỉ đụng phiên bản còn đúng bản đối soát 2026-11-04: kịch bản 1 so md5 bản cũ, kịch bản "Sổ cái Sở" chỉ
-- thêm vào phiên bản có kịch bản đọc số liệu đúng md5 và chưa có getSummaryData. CSDL không có các
-- biểu này (CSDL thử dth-framework) thì không đổi dòng nào. Bỏ ký tự CR để nội dung không đổi theo
-- cách git lấy file trên Windows.

--changeset dth:177-so-cai-so-1c splitStatements:false
--comment Biểu 1c: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1c · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1c".
// Nguồn: form-template/1c_DATA.xlsx (sheet '1c', A1:Z10). Tọa độ 0-based.
//
// Biểu 1c (Phụ lục 01c — chế độ giáo viên mầm non) — BẢNG NGANG một dòng (row 7):
//   C(c2)=Số giáo viên hưởng chính sách | D(c3)=Mức hỗ trợ | E(c4)=Thời gian hưởng
//   F(c5)=Tổng kinh phí =ROUND(C*D*E,0)  ← CÔNG THỨC | G(c6)=Ghi chú
// Mức (D) và thời gian (E) là HẰNG SỐ CHÍNH SÁCH → KHOÁ. Đơn vị chỉ nhập C (số GV) + G (ghi chú).

const SHEET = '1c';
const DATA_ROW = 7;
const INPUT_COLS = [2, 6];

function isEditable(row, col) {
  if (row === 0 && col === 0) return true;  // A1 đơn vị (gộp A1:B1)
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 0, 0, false);
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tên đơn vị của phiếu (app đưa vào ctx.shared.orgName): ghi vào ô "Chỉ tiêu / Đơn vị"
    // của dòng nhập + dòng ĐƠN VỊ đầu biểu (A1), giống các biểu 1g–1s.
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) {
      ctx.cell.set(SHEET, DATA_ROW, 1, _org);
      ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    }
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'f1c15d8a078f7a7318fde17bb7446353';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1c. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1c là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 8 (0-based 7) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1c";
const TOTAL_ROW = 7;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1C.GV_MN.SO_GV", name: "Chế độ giáo viên mầm non › Số giáo viên", qty: 2, amt: 5 },
];
const INPUT_COLS = [2];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1c: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '3f5fcccf600c8f81969fcb0ed38470b2'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1d splitStatements:false
--comment Biểu 1d: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1d · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1d".
// Nguồn: form-template/1d_DATA.xlsx (sheet '1d', A1:O23). Tọa độ 0-based.
//
// Biểu 1d (Phụ lục 01d — hỗ trợ học sinh khuyết tật) — BẢNG NGANG một dòng (row 7):
//   C(c2)=Số đối tượng | D(c3)=Số tháng hỗ trợ
//   E(c4)=Kinh phí tổng =ROUND(F+G,0)        ← CÔNG THỨC
//   F(c5)=Học bổng =ROUND(C17*C*D*C16,0)     ← CÔNG THỨC
//   G(c6)=Mua sắm đồ dùng =C*C18             ← CÔNG THỨC
//   H(c7)=Tổng kinh phí thực hiện =ROUND(E,0)← CÔNG THỨC
//   I(c8)=Ghi chú
// Số tháng (D) = 5 CỐ ĐỊNH và tham số C16:C18 (lương/tỷ lệ/mức mua sắm) là HẰNG SỐ CHÍNH SÁCH
// → KHOÁ. Đơn vị chỉ nhập C (số đối tượng) + I (ghi chú).
//   ‼ File Excel mẫu phải để sẵn D8 = 5 (số tháng), nếu không công thức kinh phí ra 0.

const SHEET = '1d';
const DATA_ROW = 7;
const INPUT_COLS = [2, 8];      // C số đối tượng, I ghi chú

function isEditable(row, col) {
  if (row === 0 && col === 0) return true;                       // A1 đơn vị (gộp A1:B1)
  if (row === 2 && col === 1) return true;                       // B3 tháng/năm
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 0, 0, false);
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tên đơn vị của phiếu (app đưa vào ctx.shared.orgName): ghi vào ô "Chỉ tiêu / Đơn vị"
    // của dòng nhập + dòng ĐƠN VỊ đầu biểu (A1), giống các biểu 1g–1s.
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) {
      ctx.cell.set(SHEET, DATA_ROW, 1, _org);
      ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    }
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'e01245ffc9d268bb0a663fef09c18c03';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1d. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1d là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 8 (0-based 7) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1d";
const TOTAL_ROW = 7;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1D.HS_KHUYET_TAT.SO_DOI_TUONG", name: "Hỗ trợ học sinh khuyết tật › Số đối tượng", qty: 2, amt: 7 },
];
const INPUT_COLS = [2];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1d: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = 'edb19ea4a152d5036b24d93d70412261'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1e splitStatements:false
--comment Biểu 1e: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1e · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1e".
// Nguồn: form-template/1e_DATA.xlsx (sheet '1e', A1:AD27). Tọa độ 0-based. Dòng dữ liệu = row 10.
//
// Biểu 1e (Phụ lục 01e — HS & trường PTDTBT) — BẢNG NGANG một dòng, nhiều thành phần:
//   D(c3)=Số HS bán trú | E(c4)=Số HS hỗ trợ thêm tiền nghỉ trọ | F(c5)=Số trẻ nhà trẻ   ← NHẬP
//   N(c13)=Mua sắm dụng cụ VH/TDTT | O(c14)=Lập tủ thuốc | P(c15)=Đồ dùng cá nhân trẻ    ← NHẬP (kinh phí NHẬP TAY)
//   R(c17)=Ghi chú                                                                       ← NHẬP
//   C,G,H,I,J,K,L,M,Q = CÔNG THỨC (số HS tổng, các kinh phí tính theo tham số).
// Tham số C15:C18 (mức) và C19 (số tháng) là HẰNG SỐ CHÍNH SÁCH → KHOÁ, đơn vị không chỉnh.
//   ‼ File Excel mẫu phải để sẵn C19 = 5 (số tháng), nếu không mọi công thức nhân số tháng ra 0.

const SHEET = '1e';
const DATA_ROW = 10;
const INPUT_COLS = [3, 4, 5, 13, 14, 15, 17]; // D,E,F (số HS) · N,O,P (kinh phí nhập tay) · R (ghi chú)

function isEditable(row, col) {
  if (row === 0 && col === 0) return true;                       // A1 đơn vị (gộp A1:B1)
  if (row === 2 && col === 1) return true;                       // B3 tháng/năm
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 0, 0, false);
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tên đơn vị của phiếu (app đưa vào ctx.shared.orgName): ghi vào ô "Chỉ tiêu / Đơn vị"
    // của dòng nhập + dòng ĐƠN VỊ đầu biểu (A1), giống các biểu 1g–1s.
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) {
      ctx.cell.set(SHEET, DATA_ROW, 1, _org);
      ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    }
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '561188cf35a254753112014b62bf55b1';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1e. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1e là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 11 (0-based 10) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [3,4,5,13,14,15], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1e";
const TOTAL_ROW = 10;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1E.AN_O.HS_BAN_TRU", name: "Hỗ trợ tiền ăn và nhà ở › Số HS bán trú", qty: 3, amt: 7 },
  { code: "1E.AN_O.HS_NGHI_TRO", name: "Hỗ trợ tiền ăn và nhà ở › Số HS hỗ trợ thêm tiền nghỉ trọ", qty: 4, amt: 9 },
  { code: "1E.AN_O.TRE_NHA_TRE", name: "Hỗ trợ tiền ăn và nhà ở › Số trẻ em nhà trẻ", qty: 5, amt: 8 },
  { code: "1E.NAU_AN.KINH_PHI", name: "Phục vụ nấu ăn cho học sinh › Kinh phí", qty: null, amt: 11 },
  { code: "1E.BAN_TRU.DUNG_CU", name: "Hỗ trợ bán trú › Mua sắm dụng cụ văn hóa, TDTT", qty: null, amt: 13 },
  { code: "1E.BAN_TRU.TU_THUOC", name: "Hỗ trợ bán trú › Lập tủ thuốc dùng chung", qty: null, amt: 14 },
  { code: "1E.DO_DUNG_CA_NHAN", name: "Hỗ trợ mua đồ dùng cá nhân trẻ em nhà trẻ", qty: null, amt: 15 },
];
const INPUT_COLS = [3,4,5,13,14,15];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1e: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = 'b449d0fd6f4db69b1e2acf1fdd32c792'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1f splitStatements:false
--comment Biểu 1f: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1f · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1f".
// Nguồn: form-template/1f.xlsx (sheet '1f', A1:I18). Tọa độ 0-based. Dòng dữ liệu = row 7.
//
// Biểu 1f (Phụ lục 01f — CP học tập SV người DTTS) — BẢNG NGANG một dòng:
//   C(c2)=Số đối tượng | D(c3)=Kinh phí =ROUND(C13*C12*C*C14,0) ← CT | E(c4)=Tổng =ROUND(D) ← CT | F(c5)=Ghi chú
// Tham số C12:C14 (lương / tỷ lệ 60% / số tháng=5) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị chỉ nhập C (số đối tượng) + F (ghi chú).

const SHEET = '1f';
const DATA_ROW = 7;
const INPUT_COLS = [2, 5]; // C số đối tượng, F ghi chú

function isEditable(row, col) {
  if (row === 0 && col === 0) return true;
  if (row === 2 && col === 1) return true;
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 0, 0, false);
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tên đơn vị của phiếu (app đưa vào ctx.shared.orgName): ghi vào ô "Chỉ tiêu / Đơn vị"
    // của dòng nhập + dòng ĐƠN VỊ đầu biểu (A1), giống các biểu 1g–1s.
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) {
      ctx.cell.set(SHEET, DATA_ROW, 1, _org);
      ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    }
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'bf540e7b565b1e0cfc842321bc3381df';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1f. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1f là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 8 (0-based 7) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1f";
const TOTAL_ROW = 7;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1F.CP_HOC_TAP_DTTS.SO_DOI_TUONG", name: "Hỗ trợ chi phí học tập SV người DTTS › Số đối tượng", qty: 2, amt: 4 },
];
const INPUT_COLS = [2];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1f: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '034dcd77ffeeb7fcfa186e233d58d2c1'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1h splitStatements:false
--comment Biểu 1h: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1h · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1h".
// Nguồn: form-template/1h.xlsx (sheet '1h', A1:H18). Tọa độ 0-based. Dòng dữ liệu = row 7.
//
// Biểu 1h (Phụ lục 01h — học bổng HS dân tộc nội trú) — BẢNG NGANG một dòng:
//   C(c2)=Đối tượng | D(c3)=Kinh phí =ROUND(C*C12*C13*C14,0)  ← CÔNG THỨC | E(c4)=Ghi chú
// Tham số C12:C14 (lương / tỷ lệ học bổng / số tháng=5) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị chỉ nhập C (số đối tượng) + E (ghi chú).

const SHEET = '1h';
const DATA_ROW = 7;
const INPUT_COLS = [2, 4]; // C số đối tượng, E ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    // + ô "Chỉ tiêu / Đơn vị" của dòng nhập (cùng tên đơn vị).
    if (_org) ctx.cell.set(SHEET, DATA_ROW, 1, _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'ff29e8fc4f246337d322c70e6b08bfae';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1h. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1h là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 8 (0-based 7) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1h";
const TOTAL_ROW = 7;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1H.HOC_BONG_DTNT.SO_DOI_TUONG", name: "Học bổng học sinh dân tộc nội trú › Số đối tượng", qty: 2, amt: 3 },
];
const INPUT_COLS = [2];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1h: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '3f483041627bf7840a5fd1e884392bdd'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1k splitStatements:false
--comment Biểu 1k: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1k · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1k".
// Nguồn: form-template/1k.xlsx (sheet '1k', A1:N22). Tọa độ 0-based. Dòng dữ liệu = row 8.
//
// Biểu 1k (Phụ lục 01k — phổ cập GDMN 3–5 tuổi) — BẢNG NGANG một dòng (row 8):
//   C(c2)=ĐT phổ cập | D(c3)=ĐT điểm a k2 | E(c4)=ĐT điểm a k1
//   F(c5)=G+H+I · G=ROUND(C*C13*C16) · H=ROUND(D*C14*C16) · I=ROUND(E*C15*C16)  ← CÔNG THỨC
//   J(c9)=ĐT tuyển dụng một lần | K(c10)=KP tuyển dụng (NHẬP TAY) | L(c11)=Tổng ← CT | M(c12)=Ghi chú
// Mức C13:C15 + số tháng C16(=5) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị nhập: C,D,E (đối tượng), J (đối tượng tuyển dụng), K (kinh phí tuyển dụng nhập tay), M (ghi chú).

const SHEET = '1k';
const DATA_ROW = 8;
const INPUT_COLS = [2, 3, 4, 9, 10, 12];

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    // + ô "Chỉ tiêu / Đơn vị" của dòng nhập (cùng tên đơn vị).
    if (_org) ctx.cell.set(SHEET, DATA_ROW, 1, _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '1973108311cbf98e5c4028db1de19b41';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1k. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1k là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 9 (0-based 8) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2,3,4,9,10], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1k";
const TOTAL_ROW = 8;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1K.PHO_CAP.DOI_TUONG", name: "Phổ cập GDMN 3–5 tuổi › Đối tượng phổ cập giáo dục", qty: 2, amt: 6 },
  { code: "1K.AN_TRUA.DOI_TUONG", name: "Phổ cập GDMN 3–5 tuổi › Đối tượng hỗ trợ ăn trưa (điểm a khoản 2)", qty: 3, amt: 7 },
  { code: "1K.CP_HOC_TAP.DOI_TUONG", name: "Phổ cập GDMN 3–5 tuổi › Đối tượng hỗ trợ CP học tập (điểm a khoản 1)", qty: 4, amt: 8 },
  { code: "1K.TUYEN_DUNG.DOI_TUONG", name: "Phổ cập GDMN 3–5 tuổi › Đối tượng tuyển dụng một lần", qty: 9, amt: null },
  { code: "1K.TUYEN_DUNG.KINH_PHI", name: "Phổ cập GDMN 3–5 tuổi › Kinh phí tuyển dụng một lần", qty: null, amt: 10 },
];
const INPUT_COLS = [2,3,4,9,10];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1k: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '6fcf252f112cabc7344e255b60ef3203'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1o splitStatements:false
--comment Biểu 1o: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1o · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1o".
// Nguồn: form-template/1o.xlsx (sheet '1o', A1:Z25). Tọa độ 0-based. Dòng dữ liệu = row 7.
//
// Biểu 1o (Phụ lục 01o — hỗ trợ tiền điện hộ nghèo & hộ chính sách) — BẢNG NGANG một dòng (row 7):
//   C(c2)=Tổng hộ =D+E ← CT | D(c3)=Số hộ nghèo | E(c4)=Số hộ CSXH =F+G ← CT
//   F(c5)=Hộ TCXH khác | G(c6)=Hộ TCXH theo quy định
//   H..K, L,M,N = mức/số tháng/kinh phí (CÔNG THỨC & tham số) | O(c14)=Ghi chú
// Mức C17 và SỐ THÁNG C18 (= 12, cả năm — KHÁC các biểu giáo dục) là hằng số → KHOÁ.
// Đơn vị nhập: D (hộ nghèo), F, G (2 loại hộ chính sách), O (ghi chú). E,C là tổng công thức.

const SHEET = '1o';
const DATA_ROW = 7;
const INPUT_COLS = [3, 5, 6, 14]; // D số hộ nghèo, F/G hộ chính sách, O ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    // + ô "Chỉ tiêu / Đơn vị" của dòng nhập (cùng tên đơn vị).
    if (_org) ctx.cell.set(SHEET, DATA_ROW, 1, _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'e363fa7f81d572059090fccc168a0eae';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1o. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1o là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 8 (0-based 7) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [3,5,6], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1o";
const TOTAL_ROW = 7;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1O.TIEN_DIEN.HO_NGHEO", name: "Hỗ trợ tiền điện › Số hộ nghèo", qty: 3, amt: 12 },
  { code: "1O.TIEN_DIEN.HO_CS_TCXH_KHAC", name: "Hỗ trợ tiền điện › Hộ hưởng trợ cấp xã hội hằng tháng (khác)", qty: 5, amt: null },
  { code: "1O.TIEN_DIEN.HO_CS_TCXH_QUY_DINH", name: "Hỗ trợ tiền điện › Hộ hưởng trợ cấp xã hội theo quy định", qty: 6, amt: null },
  { code: "1O.TIEN_DIEN.HO_CS.KINH_PHI", name: "Hỗ trợ tiền điện › Kinh phí hộ chính sách xã hội (chung)", qty: null, amt: 13 },
];
const INPUT_COLS = [3,5,6];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1o: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '44bf7a80590af30dbe51093235c2412f'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1s splitStatements:false
--comment Biểu 1s: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1s · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1s".
// Nguồn: form-template/1s.xlsx (sheet '1s', A1:J20). Tọa độ 0-based. Dòng dữ liệu = row 8.
//
// Biểu 1s (Phụ lục 01s — hỗ trợ đất trồng lúa, NĐ112/2024) — BẢNG NGANG một dòng (row 8):
//   C(c2)=DT đất chuyên trồng lúa | D(c3)=Trong đó vùng QH | E(c4)=DT đất trồng lúa còn lại (ha)
//   F(c5)=ROUND(C*C13) · G(c6)=ROUND(D*C13) · H(c7)=ROUND(E*C14) · I(c8)=ROUND(F+G+H) ← CÔNG THỨC
//   J(c9)=Ghi chú
// Định mức C13,C14 (đất lúa thường / khác) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị nhập 3 diện tích C,D,E + J (ghi chú).

const SHEET = '1s';
const DATA_ROW = 8;
const INPUT_COLS = [2, 3, 4, 9]; // C,D,E diện tích · J ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;
  return row === DATA_ROW && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, DATA_ROW, col, false));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
    // + ô "Chỉ tiêu / Đơn vị" của dòng nhập (cùng tên đơn vị).
    if (_org) ctx.cell.set(SHEET, DATA_ROW, 1, _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '36f387b2839a9bcc23312adaca76cae4';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1s. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1s là biểu MỖI ĐƠN VỊ MỘT DÒNG: 4-tonghop-theo-ky để dòng 9 (0-based 8) làm TỔNG CỘNG và
// thêm mỗi đơn vị một dòng bên dưới, tên đơn vị ở cột B.
// - Guard: Sở chỉ sửa ô nhập (cột [2,3,4], trùng ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức) của
//   các dòng ĐƠN VỊ; dòng Tổng cộng, cột mức / thời gian và ô công thức khoá.
// - getSummaryData: mỗi dòng đơn vị → các chỉ tiêu có số (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode dịch từ TÊN ở cột B qua ctx.shared.orgCodeByName (máy chủ cấp). Tên không dịch được
//   ⇒ báo lỗi, không đoán.

const SHEET = "1s";
const TOTAL_ROW = 8;
const NAME_COL = 1;
const MAX_UNITS = 2000;
const BINDINGS = [
  { code: "1S.DAT_CHUYEN_TRONG_LUA", name: "Hỗ trợ đất trồng lúa › Diện tích đất chuyên trồng lúa", qty: 2, amt: 5 },
  { code: "1S.DAT_CHUYEN_VUNG_QH", name: "Hỗ trợ đất trồng lúa › Trong đó vùng quy hoạch năng suất/chất lượng cao", qty: 3, amt: 6 },
  { code: "1S.DAT_TRONG_LUA_CON_LAI", name: "Hỗ trợ đất trồng lúa › Diện tích đất trồng lúa còn lại", qty: 4, amt: 7 },
];
const INPUT_COLS = [2,3,4];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unitName(ctx, row) {
  const value = ctx.cell.get(SHEET, row, NAME_COL);
  return value == null ? '' : String(value).trim();
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && row > TOTAL_ROW && INPUT_COLS.indexOf(col) >= 0 && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const codeByName = (ctx.shared && ctx.shared.orgCodeByName) || {};
    const rows = [];
    for (let i = 0; i < MAX_UNITS; i += 1) {
      const row = TOTAL_ROW + 1 + i;
      const name = unitName(ctx, row);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1s: không xác định được mã của đơn vị "' + name + '" (dòng ' + (row + 1) + ').' });
        continue;
      }
      for (const b of BINDINGS) {
        const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, row, b.qty));
        const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, row, b.amt));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: b.code, indicatorName: b.name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '9e2920ceb7eaadd7e843a296891c69c8'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1g splitStatements:false
--comment Biểu 1g: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1g · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1g".
// Nguồn: form-template/1g.xlsx (sheet '1g', A1:O21). Tọa độ 0-based. DỌC 3 DÒNG LOẠI (r9,r10,r11).
//
// Biểu 1g (Phụ lục 01g — chính sách nội trú HSSV) theo CƠ CHẾ BIỂU MỚI: 3 LOẠI cố định
//   (I = HSSV DTTS hộ nghèo | II = tốt nghiệp PTDT nội trú | III = Kinh hộ nghèo), 1 đơn vị/phiếu.
//   C(2)=Mức học bổng | D(3)=Mức đồ dùng | E(4)=Mức ở lại Tết | F(5)=Đối tượng học bổng
//   G(6)=Thời gian | H(7)=KP học bổng =ROUND(C*F*G*C15) ← CT
//   I(8)=Đối tượng đồ dùng | J(9)=Đi lại 0,2 | K(10)=Đi lại 0,3 | L(11)=Đối tượng ở lại Tết
//   M(12)=KP khác =SUM(I:L) ← CT | N(13)=Tổng ← CT | O(14)=Ghi chú
// Mức C/D/E + thời gian G (đã điền sẵn theo loại) + lương C15 là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị nhập: F, I, J, K, L (số đối tượng) + O (ghi chú) ở 3 dòng loại.

const SHEET = '1g';
const LEAF_ROWS = [9, 10, 11];
const INPUT_COLS = [5, 8, 9, 10, 11, 14]; // F, I, J, K, L (đối tượng) + O (ghi chú)

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '56a082c15b3474b97832eec60bc2209c';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1g. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1g là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1g";
const BINDINGS = [
  { code: "1G.I.HOC_BONG.DOI_TUONG", name: "Nội trú › HSSV DTTS hộ nghèo › Đối tượng hỗ trợ học bổng", row: 9, qty: 5, amt: 7 },
  { code: "1G.I.DO_DUNG.DOI_TUONG", name: "Nội trú › HSSV DTTS hộ nghèo › Đối tượng hỗ trợ đồ dùng cá nhân", row: 9, qty: 8, amt: null },
  { code: "1G.I.DI_LAI.M02", name: "Nội trú › HSSV DTTS hộ nghèo › Đối tượng hỗ trợ tiền đi lại mức 0,2", row: 9, qty: 9, amt: null },
  { code: "1G.I.DI_LAI.M03", name: "Nội trú › HSSV DTTS hộ nghèo › Đối tượng hỗ trợ tiền đi lại mức 0,3", row: 9, qty: 10, amt: null },
  { code: "1G.I.O_LAI_TET.DOI_TUONG", name: "Nội trú › HSSV DTTS hộ nghèo › Đối tượng hỗ trợ ở lại trường dịp Tết", row: 9, qty: 11, amt: null },
  { code: "1G.I.HO_TRO_KHAC.KINH_PHI", name: "Nội trú › HSSV DTTS hộ nghèo › Kinh phí hỗ trợ khác", row: 9, qty: null, amt: 12 },
  { code: "1G.II.HOC_BONG.DOI_TUONG", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Đối tượng hỗ trợ học bổng", row: 10, qty: 5, amt: 7 },
  { code: "1G.II.DO_DUNG.DOI_TUONG", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Đối tượng hỗ trợ đồ dùng cá nhân", row: 10, qty: 8, amt: null },
  { code: "1G.II.DI_LAI.M02", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Đối tượng hỗ trợ tiền đi lại mức 0,2", row: 10, qty: 9, amt: null },
  { code: "1G.II.DI_LAI.M03", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Đối tượng hỗ trợ tiền đi lại mức 0,3", row: 10, qty: 10, amt: null },
  { code: "1G.II.O_LAI_TET.DOI_TUONG", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Đối tượng hỗ trợ ở lại trường dịp Tết", row: 10, qty: 11, amt: null },
  { code: "1G.II.HO_TRO_KHAC.KINH_PHI", name: "Nội trú › HSSV tốt nghiệp PTDT nội trú › Kinh phí hỗ trợ khác", row: 10, qty: null, amt: 12 },
  { code: "1G.III.HOC_BONG.DOI_TUONG", name: "Nội trú › HSSV Kinh hộ nghèo › Đối tượng hỗ trợ học bổng", row: 11, qty: 5, amt: 7 },
  { code: "1G.III.DO_DUNG.DOI_TUONG", name: "Nội trú › HSSV Kinh hộ nghèo › Đối tượng hỗ trợ đồ dùng cá nhân", row: 11, qty: 8, amt: null },
  { code: "1G.III.DI_LAI.M02", name: "Nội trú › HSSV Kinh hộ nghèo › Đối tượng hỗ trợ tiền đi lại mức 0,2", row: 11, qty: 9, amt: null },
  { code: "1G.III.DI_LAI.M03", name: "Nội trú › HSSV Kinh hộ nghèo › Đối tượng hỗ trợ tiền đi lại mức 0,3", row: 11, qty: 10, amt: null },
  { code: "1G.III.O_LAI_TET.DOI_TUONG", name: "Nội trú › HSSV Kinh hộ nghèo › Đối tượng hỗ trợ ở lại trường dịp Tết", row: 11, qty: 11, amt: null },
  { code: "1G.III.HO_TRO_KHAC.KINH_PHI", name: "Nội trú › HSSV Kinh hộ nghèo › Kinh phí hỗ trợ khác", row: 11, qty: null, amt: 12 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["9:5","9:8","9:9","9:10","9:11","10:5","10:8","10:9","10:10","10:11","11:5","11:8","11:9","11:10","11:11"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '7ca1e99f13e382376849635265928019'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1i splitStatements:false
--comment Biểu 1i: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1i · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1i".
// Nguồn: form-template/1i.xlsx (sheet '1i', A1:I15). Tọa độ 0-based. DỌC 5 DÒNG LÁ (r7..r11).
//
// Biểu 1i (Phụ lục 01i — ưu tiên tuyển sinh + hỗ trợ học tập DTTS rất ít người):
//   C(2)=Đối tượng | D(3)=Mức hỗ trợ | E(4)=Số tháng | F(5)=C*D*E*C15 ← CT | G(6)=F ← CT | H(7)=Ghi chú
//   5 dòng lá: trẻ mẫu giáo / HS tiểu học-THCS-THPT / HS PTDT bán trú / HS PTDT nội trú / HSSV các trường.
// MỨC (D, đã điền sẵn 0,3/0,4/0,6/1/1) và SỐ THÁNG (E) là HẰNG SỐ CHÍNH SÁCH → KHOÁ (đơn vị không sửa).
//   ‼ File Excel mẫu còn phải điền sẵn E (số tháng) cho 5 dòng, nếu không công thức kinh phí ra 0.
// Đơn vị chỉ nhập C (số đối tượng) + H (ghi chú) ở mỗi dòng lá.

const SHEET = '1i';
const LEAF_ROWS = [7, 8, 9, 10, 11];
const INPUT_COLS = [2, 7]; // C số đối tượng, H ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'eb8ca0e31f9a4f752f64c44659848cfc';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1i. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1i là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1i";
const BINDINGS = [
  { code: "1I.TRE_MG", name: "Ưu tiên tuyển sinh & hỗ trợ học tập DTTS rất ít người › Trẻ mẫu giáo", row: 7, qty: 2, amt: 5 },
  { code: "1I.HS_PHO_THONG", name: "Ưu tiên tuyển sinh & hỗ trợ học tập DTTS rất ít người › HS tiểu học, THCS, THPT", row: 8, qty: 2, amt: 5 },
  { code: "1I.HS_PTDT_BAN_TRU", name: "Ưu tiên tuyển sinh & hỗ trợ học tập DTTS rất ít người › HS trường PTDT bán trú", row: 9, qty: 2, amt: 5 },
  { code: "1I.HS_PTDT_NOI_TRU", name: "Ưu tiên tuyển sinh & hỗ trợ học tập DTTS rất ít người › HS trường PTDT nội trú", row: 10, qty: 2, amt: 5 },
  { code: "1I.HSSV_CAC_TRUONG", name: "Ưu tiên tuyển sinh & hỗ trợ học tập DTTS rất ít người › HSSV tại các trường", row: 11, qty: 2, amt: 5 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["7:2","8:2","9:2","10:2","11:2"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '47d8d840e56f9457c4a5436220d48339'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1l splitStatements:false
--comment Biểu 1l: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1l · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1l".
// Nguồn: form-template/1l.xlsx (sheet '1l', A1:I36). Tọa độ 0-based.
//
// Biểu 1l (Phụ lục 01l — NSNN đóng & hỗ trợ đóng BHYT) — DỌC 24 DÒNG LÁ, 2 nhóm:
//   C(2)=Số đối tượng | D(3)=Kinh phí (NHẬP TAY, không công thức) | E(4)=Ghi chú
//   Dòng tổng/nhóm/cha (=SUM...) là công thức → giữ khoá, KHÔNG lưu.
// Kinh phí đơn vị tự tính (số người × mệnh giá thẻ theo nhóm) rồi nhập → lưu nguyên.

const SHEET = '1l';
// 24 dòng lá (0-based). Bỏ tổng r7, nhóm r8/r23, cha trẻ em <6t r10, cha cận nghèo r24.
const LEAF_ROWS = [9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
                   25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];
const INPUT_COLS = [2, 3, 4]; // C số đối tượng, D kinh phí, E ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '1baec97e1f6f4ac510a1cc78a5d5ed4d';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1l. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1l là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1l";
const BINDINGS = [
  { code: "1L.HO_NGHEO_DTTS", name: "NSNN đóng BHYT › Hộ gia đình nghèo; người dân tộc thiểu số", row: 9, qty: 2, amt: 3 },
  { code: "1L.TRE_EM_6T.MENH_GIA", name: "NSNN đóng BHYT › Trẻ em dưới 6 tuổi — kinh phí theo mệnh giá thẻ", row: 11, qty: 2, amt: 3 },
  { code: "1L.TRE_EM_6T.TRUY_LINH", name: "NSNN đóng BHYT › Trẻ em dưới 6 tuổi — kinh phí truy lĩnh", row: 12, qty: 2, amt: 3 },
  { code: "1L.NGUOI_CO_CONG", name: "NSNN đóng BHYT › Người có công với cách mạng", row: 13, qty: 2, amt: 3 },
  { code: "1L.CUU_CHIEN_BINH_TNXP", name: "NSNN đóng BHYT › Cựu chiến binh, thanh niên xung phong", row: 14, qty: 2, amt: 3 },
  { code: "1L.BTXH", name: "NSNN đóng BHYT › Đối tượng BTXH, người hưởng trợ cấp nuôi dưỡng", row: 15, qty: 2, amt: 3 },
  { code: "1L.HIEN_TANG", name: "NSNN đóng BHYT › Người hiến tạng", row: 16, qty: 2, amt: 3 },
  { code: "1L.NGUOI_75_TUOI", name: "NSNN đóng BHYT › Người 75 tuổi trở lên đang hưởng trợ cấp tuất", row: 17, qty: 2, amt: 3 },
  { code: "1L.XA_ATK", name: "NSNN đóng BHYT › Người dân các xã ATK, vùng ATK cách mạng", row: 18, qty: 2, amt: 3 },
  { code: "1L.HUU_TRI_XH", name: "NSNN đóng BHYT › Người hưởng trợ cấp hưu trí xã hội hằng tháng", row: 19, qty: 2, amt: 3 },
  { code: "1L.DAI_BIEU_QH_HDND", name: "NSNN đóng BHYT › Đại biểu Quốc hội, đại biểu Hội đồng nhân dân", row: 20, qty: 2, amt: 3 },
  { code: "1L.CAN_BO_XA_NGHI", name: "NSNN đóng BHYT › Cán bộ xã, phường, thị trấn đã nghỉ việc", row: 21, qty: 2, amt: 3 },
  { code: "1L.DAN_QUAN", name: "NSNN đóng BHYT › Dân quân thường trực", row: 22, qty: 2, amt: 3 },
  { code: "1L.CAN_NGHEO_100", name: "NSNN hỗ trợ mức đóng › Hộ cận nghèo được hỗ trợ 100%", row: 25, qty: 2, amt: 3 },
  { code: "1L.CAN_NGHEO_70", name: "NSNN hỗ trợ mức đóng › Hộ cận nghèo được hỗ trợ 70%", row: 26, qty: 2, amt: 3 },
  { code: "1L.HSSV_50", name: "NSNN hỗ trợ mức đóng › Học sinh, sinh viên (50%)", row: 27, qty: 2, amt: 3 },
  { code: "1L.HO_NONG_LAM_NGU", name: "NSNN hỗ trợ mức đóng › Hộ làm nông, lâm, ngư, diêm nghiệp", row: 28, qty: 2, amt: 3 },
  { code: "1L.DTTS_DIA_BAN", name: "NSNN hỗ trợ mức đóng › Người DTTS đang sinh sống tại địa bàn", row: 29, qty: 2, amt: 3 },
  { code: "1L.DTTS_XA", name: "NSNN hỗ trợ mức đóng › Người DTTS tại các xã được xác định", row: 30, qty: 2, amt: 3 },
  { code: "1L.LUC_LUONG_ANTT", name: "NSNN hỗ trợ mức đóng › Lực lượng tham gia bảo vệ an ninh trật tự", row: 31, qty: 2, amt: 3 },
  { code: "1L.Y_TE_THON_BAN", name: "NSNN hỗ trợ mức đóng › Nhân viên y tế thôn, bản; cô đỡ thôn, bản", row: 32, qty: 2, amt: 3 },
  { code: "1L.KHONG_CHUYEN_TRACH", name: "NSNN hỗ trợ mức đóng › Người hoạt động không chuyên trách ở thôn, tổ dân phố", row: 33, qty: 2, amt: 3 },
  { code: "1L.NAN_NHAN", name: "NSNN hỗ trợ mức đóng › Nạn nhân theo Luật Phòng, chống mua bán người", row: 34, qty: 2, amt: 3 },
  { code: "1L.NQ_RIENG", name: "NSNN hỗ trợ mức đóng › Hỗ trợ mức đóng BHYT các đối tượng theo Nghị quyết riêng", row: 35, qty: 2, amt: 3 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["9:2","9:3","11:2","11:3","12:2","12:3","13:2","13:3","14:2","14:3","15:2","15:3","16:2","16:3","17:2","17:3","18:2","18:3","19:2","19:3","20:2","20:3","21:2","21:3","22:2","22:3","25:2","25:3","26:2","26:3","27:2","27:3","28:2","28:3","29:2","29:3","30:2","30:3","31:2","31:3","32:2","32:3","33:2","33:3","34:2","34:3","35:2","35:3"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = 'ff1630b126fa9f35d0586c3b4faeab30'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1m splitStatements:false
--comment Biểu 1m: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1m · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1m".
// Nguồn: form-template/1m.xlsx (sheet '1m', A1:I91). Tọa độ 0-based. DỌC ~49 DÒNG LÁ, cây 3–4 tầng.
//
// Biểu 1m (Phụ lục 01m — trợ giúp đối tượng bảo trợ xã hội, NĐ20/2021):
//   C(2)=Hệ số | D(3)=Mức chuẩn TW (0,5) | E(4)=C*D ← CT | F(5)=Đối tượng | G(6)=Kinh phí ← CT | H(7)=Ghi chú
//   Hệ số C + mức chuẩn D (điền sẵn) + SỐ THÁNG C85(=6) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
//   Dòng tổng/nhóm/cha (=SUM.../=A+B) là công thức → giữ khoá, KHÔNG lưu.
// Đơn vị chỉ nhập F (số đối tượng) + H (ghi chú) ở các dòng lá.
//   Lưu ý: mai táng (r80) chi 1 lần — công thức G không nhân số tháng (biểu 01 xử lý riêng).

const SHEET = '1m';
// ~49 dòng lá (0-based) — dòng có hệ số C + công thức E=C*D. Bỏ mọi dòng tổng/nhóm/cha.
const LEAF_ROWS = [
  // A.I — Trợ cấp xã hội hàng tháng
  11, 12, 14, 16, 17, 18, 20, 21, 22, 23, 24, 25,
  28, 29, 30, 31, 32, 35, 36, 37, 39, 40, 41, 42,
  // A.II — Nhận nuôi dưỡng tại cộng đồng
  45, 47, 48, 49, 50, 53, 54, 56, 57, 58, 59, 61, 62, 63, 64,
  // A.III — Trợ cấp đối tượng ở cơ sở TGXH
  68, 69, 71, 72, 73, 75, 76, 78, 79,
  // B — Mai táng
  80,
];
const INPUT_COLS = [5, 7]; // F số đối tượng, H ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '6a72360fc77f0e5d0f42b72d6c593583';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1m. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1m là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1m";
const BINDINGS = [
  { code: "1M.A1.01.DUOI4T", name: "BTXH › Trẻ dưới 16 tuổi không nguồn nuôi dưỡng — dưới 4 tuổi", row: 11, qty: 5, amt: 6 },
  { code: "1M.A1.01.4_16T", name: "BTXH › Trẻ dưới 16 tuổi không nguồn nuôi dưỡng — từ đủ 4 đến dưới 16 tuổi", row: 12, qty: 5, amt: 6 },
  { code: "1M.A1.02", name: "BTXH › Người từ 16 đến 22 tuổi đang học phổ thông/học nghề", row: 14, qty: 5, amt: 6 },
  { code: "1M.A1.03.DUOI4T", name: "BTXH › Trẻ nhiễm HIV thuộc hộ nghèo — dưới 4 tuổi", row: 16, qty: 5, amt: 6 },
  { code: "1M.A1.03.4_16T", name: "BTXH › Trẻ nhiễm HIV thuộc hộ nghèo — từ 4 đến dưới 16 tuổi", row: 17, qty: 5, amt: 6 },
  { code: "1M.A1.03.16T_LEN", name: "BTXH › Trẻ nhiễm HIV thuộc hộ nghèo — từ 16 tuổi trở lên", row: 18, qty: 5, amt: 6 },
  { code: "1M.A1.04.1CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 1 con", row: 20, qty: 5, amt: 6 },
  { code: "1M.A1.04.2CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 2 con", row: 21, qty: 5, amt: 6 },
  { code: "1M.A1.04.3CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 3 con", row: 22, qty: 5, amt: 6 },
  { code: "1M.A1.04.4CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 4 con", row: 23, qty: 5, amt: 6 },
  { code: "1M.A1.04.5CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 5 con", row: 24, qty: 5, amt: 6 },
  { code: "1M.A1.04.6CON", name: "BTXH › Người hộ nghèo/cận nghèo một mình nuôi con — đang nuôi 6 con", row: 25, qty: 5, amt: 6 },
  { code: "1M.A1.05_1.60_80T", name: "BTXH › Người cao tuổi hộ nghèo không người phụng dưỡng — 60 đến dưới 80 tuổi", row: 28, qty: 5, amt: 6 },
  { code: "1M.A1.05_1.80T_LEN", name: "BTXH › Người cao tuổi hộ nghèo không người phụng dưỡng — từ đủ 80 tuổi trở lên", row: 29, qty: 5, amt: 6 },
  { code: "1M.A1.05_2", name: "BTXH › Người từ đủ 75 đến 80 tuổi hộ nghèo/cận nghèo vùng khó khăn", row: 30, qty: 5, amt: 6 },
  { code: "1M.A1.05_3", name: "BTXH › Người từ đủ 80 tuổi trở lên không có lương hưu/trợ cấp BHXH", row: 31, qty: 5, amt: 6 },
  { code: "1M.A1.05_4", name: "BTXH › Người cao tuổi hộ nghèo không người phụng dưỡng (diện khác)", row: 32, qty: 5, amt: 6 },
  { code: "1M.A1.06_1.DUOI16T", name: "BTXH › Người khuyết tật đặc biệt nặng — dưới 16 tuổi", row: 35, qty: 5, amt: 6 },
  { code: "1M.A1.06_1.16_60T", name: "BTXH › Người khuyết tật đặc biệt nặng — từ 16 đến 60 tuổi", row: 36, qty: 5, amt: 6 },
  { code: "1M.A1.06_1.60T_LEN", name: "BTXH › Người khuyết tật đặc biệt nặng — từ đủ 60 tuổi trở lên", row: 37, qty: 5, amt: 6 },
  { code: "1M.A1.06_2.DUOI16T", name: "BTXH › Người khuyết tật nặng — dưới 16 tuổi", row: 39, qty: 5, amt: 6 },
  { code: "1M.A1.06_2.16_60T", name: "BTXH › Người khuyết tật nặng — từ 16 đến 60 tuổi", row: 40, qty: 5, amt: 6 },
  { code: "1M.A1.06_2.60T_LEN", name: "BTXH › Người khuyết tật nặng — từ đủ 60 tuổi trở lên", row: 41, qty: 5, amt: 6 },
  { code: "1M.A1.07", name: "BTXH › Trẻ em dưới 3 tuổi hộ nghèo/cận nghèo vùng khó khăn", row: 42, qty: 5, amt: 6 },
  { code: "1M.A2.01_1", name: "BTXH nhận nuôi › Nhận chăm sóc, nuôi dưỡng trẻ em dưới 4 tuổi", row: 45, qty: 5, amt: 6 },
  { code: "1M.A2.01_2.1TRE", name: "BTXH nhận nuôi › Nhận nuôi trẻ 4–16 tuổi — nuôi 1 trẻ", row: 47, qty: 5, amt: 6 },
  { code: "1M.A2.01_2.2TRE", name: "BTXH nhận nuôi › Nhận nuôi trẻ 4–16 tuổi — nuôi 2 trẻ", row: 48, qty: 5, amt: 6 },
  { code: "1M.A2.01_2.3TRE", name: "BTXH nhận nuôi › Nhận nuôi trẻ 4–16 tuổi — nuôi 3 trẻ", row: 49, qty: 5, amt: 6 },
  { code: "1M.A2.02", name: "BTXH nhận nuôi › Nhận nuôi người cao tuổi thuộc hộ nghèo", row: 50, qty: 5, amt: 6 },
  { code: "1M.A2.03_1.A", name: "BTXH nhận nuôi › Hỗ trợ nuôi dưỡng người KT đặc biệt nặng (mức hệ số 1,5)", row: 53, qty: 5, amt: 6 },
  { code: "1M.A2.03_1.B", name: "BTXH nhận nuôi › Hỗ trợ nuôi dưỡng người KT đặc biệt nặng (mức hệ số 2)", row: 54, qty: 5, amt: 6 },
  { code: "1M.A2.03_2.1", name: "BTXH nhận nuôi › Hộ trực tiếp chăm sóc — 1 người khuyết tật", row: 56, qty: 5, amt: 6 },
  { code: "1M.A2.03_2.2", name: "BTXH nhận nuôi › Hộ trực tiếp chăm sóc — 2 người khuyết tật", row: 57, qty: 5, amt: 6 },
  { code: "1M.A2.03_2.3", name: "BTXH nhận nuôi › Hộ trực tiếp chăm sóc — 3 người khuyết tật", row: 58, qty: 5, amt: 6 },
  { code: "1M.A2.03_2.4", name: "BTXH nhận nuôi › Hộ trực tiếp chăm sóc — 4 người khuyết tật", row: 59, qty: 5, amt: 6 },
  { code: "1M.A2.03_3.1NGUOI", name: "BTXH nhận nuôi › Hộ/cá nhân nhận nuôi — 1 người khuyết tật", row: 61, qty: 5, amt: 6 },
  { code: "1M.A2.03_3.2NGUOI", name: "BTXH nhận nuôi › Hộ/cá nhân nhận nuôi — 2 người khuyết tật", row: 62, qty: 5, amt: 6 },
  { code: "1M.A2.03_3.1TRE", name: "BTXH nhận nuôi › Hộ/cá nhân nhận nuôi — 1 trẻ em khuyết tật", row: 63, qty: 5, amt: 6 },
  { code: "1M.A2.03_3.2TRE", name: "BTXH nhận nuôi › Hộ/cá nhân nhận nuôi — 2 trẻ em khuyết tật", row: 64, qty: 5, amt: 6 },
  { code: "1M.A3.01_1.DUOI4T", name: "BTXH cơ sở TGXH › Trẻ không nguồn nuôi dưỡng — dưới 4 tuổi", row: 68, qty: 5, amt: 6 },
  { code: "1M.A3.01_1.4_16T", name: "BTXH cơ sở TGXH › Trẻ không nguồn nuôi dưỡng — từ đủ 4 đến dưới 16 tuổi", row: 69, qty: 5, amt: 6 },
  { code: "1M.A3.01_2.DUOI4T", name: "BTXH cơ sở TGXH › Trẻ nhiễm HIV hộ nghèo — dưới 4 tuổi", row: 71, qty: 5, amt: 6 },
  { code: "1M.A3.01_2.4_16T", name: "BTXH cơ sở TGXH › Trẻ nhiễm HIV hộ nghèo — từ đủ 4 đến dưới 16 tuổi", row: 72, qty: 5, amt: 6 },
  { code: "1M.A3.02", name: "BTXH cơ sở TGXH › Người cao tuổi diện sống ở cơ sở trợ giúp xã hội", row: 73, qty: 5, amt: 6 },
  { code: "1M.A3.03.DUOI4T", name: "BTXH cơ sở TGXH › Người khuyết tật đặc biệt nặng — dưới 4 tuổi", row: 75, qty: 5, amt: 6 },
  { code: "1M.A3.03.4T_LEN", name: "BTXH cơ sở TGXH › Người khuyết tật đặc biệt nặng — từ đủ 4 tuổi trở lên", row: 76, qty: 5, amt: 6 },
  { code: "1M.A3.04.DUOI4T", name: "BTXH cơ sở TGXH › Đối tượng cần bảo vệ khẩn cấp — dưới 4 tuổi", row: 78, qty: 5, amt: 6 },
  { code: "1M.A3.04.4T_LEN", name: "BTXH cơ sở TGXH › Đối tượng cần bảo vệ khẩn cấp — từ đủ 4 tuổi trở lên", row: 79, qty: 5, amt: 6 },
  { code: "1M.B.MAI_TANG", name: "BTXH › Hỗ trợ chi phí mai táng", row: 80, qty: 5, amt: 6 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["11:5","12:5","14:5","16:5","17:5","18:5","20:5","21:5","22:5","23:5","24:5","25:5","28:5","29:5","30:5","31:5","32:5","35:5","36:5","37:5","39:5","40:5","41:5","42:5","45:5","47:5","48:5","49:5","50:5","53:5","54:5","56:5","57:5","58:5","59:5","61:5","62:5","63:5","64:5","68:5","69:5","71:5","72:5","73:5","75:5","76:5","78:5","79:5","80:5"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '5f9c8b260e61fc8003286c53989171d4'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1n splitStatements:false
--comment Biểu 1n: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1n · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1n".
// Nguồn: form-template/1n.xlsx (sheet '1n', A1:I22). Tọa độ 0-based. DỌC 3 DÒNG LÁ (r8,r9,r10).
//
// Biểu 1n (Phụ lục 01n — trợ cấp hưu trí xã hội, NĐ176/2025):
//   C(2)=Hệ số | D(3)=Mức chuẩn TW | E(4)=C*D ← CT | F(5)=Đối tượng | G(6)=Kinh phí ← CT | H(7)=Ghi chú
//   Dòng lá: r8 trợ cấp hưu trí | r9 đối tượng 70–75 tuổi | r10 hỗ trợ mai táng.
//   Nhóm A "TRỢ CẤP HƯU TRÍ" (r7) = công thức tổng → giữ khoá.
// Hệ số C + mức chuẩn D là HẰNG SỐ CHÍNH SÁCH (đã điền sẵn) và số tháng C16(=12) → KHOÁ.
// Đơn vị chỉ nhập F (số đối tượng) + H (ghi chú) ở 3 dòng lá.
//   Lưu ý: mai táng (r10) chi 1 lần — công thức G không nhân số tháng (biểu 01 xử lý riêng).

const SHEET = '1n';
const LEAF_ROWS = [8, 9, 10];
const INPUT_COLS = [5, 7]; // F số đối tượng, H ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '74e0c5fd61be784e2694fe415b62ee76';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1n. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1n là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1n";
const BINDINGS = [
  { code: "1N.HUU_TRI.TRO_CAP", name: "Trợ cấp hưu trí xã hội › Trợ cấp hưu trí xã hội hàng tháng", row: 8, qty: 5, amt: 6 },
  { code: "1N.HUU_TRI.70_75", name: "Trợ cấp hưu trí xã hội › Đối tượng 70–75 tuổi thuộc hộ nghèo/cận nghèo", row: 9, qty: 5, amt: 6 },
  { code: "1N.MAI_TANG", name: "Trợ cấp hưu trí xã hội › Hỗ trợ chi phí mai táng", row: 10, qty: 5, amt: 6 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["8:5","9:5","10:5"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '6c9972efb94bace713e86069198ea8d4'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1p splitStatements:false
--comment Biểu 1p: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1p · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1p".
// Nguồn: form-template/1p.xlsx (sheet '1p', A1:J16). Tọa độ 0-based.
//
// Biểu 1p (Phụ lục 01p — NSNN hỗ trợ đóng BHXH tự nguyện) — DỌC 4 DÒNG đối tượng (row 9..12):
//   C(c2)=Số đối tượng | D(c3)=Kinh phí thực hiện (NHẬP TAY, không công thức) | E(c4)=Ghi chú
//   Tiểu tổng C8,D8 (row 8) là =SUM(...) → giữ khoá.
// Kinh phí do đơn vị TỰ TÍNH & nhập (không có công thức/tham số) → lưu nguyên.

const SHEET = '1p';
const LEAF_ROWS = [8, 9, 10, 11]; // 4 dòng đối tượng (0-based)
const INPUT_COLS = [2, 3, 4];     // C số đối tượng, D kinh phí, E ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  return LEAF_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  LEAF_ROWS.forEach((row) => INPUT_COLS.forEach((col) => ctx.cell.lock(SHEET, row, col, false)));
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = '8bbd3c014f117e1afe2abbe17b1b756b';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1p. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1p là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1p";
const BINDINGS = [
  { code: "1P.BHXH_TN.HO_NGHEO", name: "NSNN hỗ trợ đóng BHXH tự nguyện › Hộ nghèo (50%)", row: 8, qty: 2, amt: 3 },
  { code: "1P.BHXH_TN.CAN_NGHEO", name: "NSNN hỗ trợ đóng BHXH tự nguyện › Hộ cận nghèo (40%)", row: 9, qty: 2, amt: 3 },
  { code: "1P.BHXH_TN.DTTS", name: "NSNN hỗ trợ đóng BHXH tự nguyện › Người dân tộc thiểu số (30%)", row: 10, qty: 2, amt: 3 },
  { code: "1P.BHXH_TN.KHAC", name: "NSNN hỗ trợ đóng BHXH tự nguyện › Các đối tượng khác (20%)", row: 11, qty: 2, amt: 3 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["8:2","8:3","9:2","9:3","10:2","10:3","11:2","11:3"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '062fe10eec2d8aeffbd027481a91eb91'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:177-so-cai-so-1q splitStatements:false
--comment Biểu 1q: kịch bản khoá ô bỏ qua mode Sở sửa; thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// ==== 1q · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1q".
// Nguồn: form-template/1q.xlsx (sheet '1q', A1:R24). Tọa độ 0-based. Cấu trúc MỚI: 2 khối dọc.
//
// KHỐI A — "Chế độ cung cấp thông tin" (7 dòng lá r8..r14): dùng nhóm 5 (cột O/P/Q).
//   O(14)=Số đối tượng (NHẬP) | P(15)=Mức (KHOÁ, =0,5) | Q(16)=O*P ← CÔNG THỨC. Q8(r7)=SUM tổng.
// KHỐI B — "Hỗ trợ vật chất, động viên tinh thần" (1 dòng r15): dùng nhóm 1–4 (cột C..N).
//   Tết: C(2) D(3) E(4)=C*D*C19 | Ốm đau: F(5) G(6) H(7)=F*G | Khó khăn: I(8) J(9) K(10)=I*J
//   Qua đời: L(11) M(12) N(13)=L*M.  Số đối tượng (C/F/I/L) NHẬP; Mức (D/G/J/M) KHOÁ (=0,5).
// Mức (P; D/G/J/M) và tham số C19 (số lần/năm=2) là HẰNG SỐ CHÍNH SÁCH → KHOÁ.
// Đơn vị chỉ nhập SỐ ĐỐI TƯỢNG + ghi chú (R=17). (Khớp ô bôi màu: xám = khoá.)

const SHEET = '1q';
const A_LEAF_ROWS = [8, 9, 10, 11, 12, 13, 14]; // khối A
const A_QTY_COL = 14;                            // O
const B_ROW = 15;                                // khối B
const B_QTY_COLS = [2, 5, 8, 11];                // C, F, I, L
const NOTE_COL = 17;                             // R

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;  // B3 tháng/năm
  if (A_LEAF_ROWS.indexOf(row) >= 0) return col === A_QTY_COL || col === NOTE_COL;
  if (row === B_ROW) return B_QTY_COLS.indexOf(col) >= 0 || col === NOTE_COL;
  return false;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  A_LEAF_ROWS.forEach((row) => {
    ctx.cell.lock(SHEET, row, A_QTY_COL, false);
    ctx.cell.lock(SHEET, row, NOTE_COL, false);
  });
  B_QTY_COLS.forEach((col) => ctx.cell.lock(SHEET, B_ROW, col, false));
  ctx.cell.lock(SHEET, B_ROW, NOTE_COL, false);
}

function containsOnlyEditableCells(range) {
  if (range.sheetName !== SHEET) return false;
  for (let row = range.row; row < range.row + range.rowCount; row += 1) {
    for (let col = range.col; col < range.col + range.colCount; col += 1) {
      if (!isEditable(row, col)) return false;
    }
  }
  return true;
}

return defineScript({
  onLoad(ctx) {
    if (ctx.mode && ctx.mode !== 'input') return;
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tự điền tên đơn vị của phiếu vào ô ĐƠN VỊ (A1) rồi GIỮ KHOÁ (đơn vị không sửa).
    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    if (_org) ctx.cell.set(SHEET, 0, 0, 'ĐƠN VỊ (Xã/phường/Sở ngành/Trường): ' + _org);
  },
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — script 5-so-cai-so quyết ô Sở sửa.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode === 'summary-edit') return;
    return cell.sheetName === SHEET && isEditable(cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode === 'summary-edit') return;
    return containsOnlyEditableCells(range);
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-177'
FROM s
WHERE t.display_order = 0
  AND md5(replace(t.code, chr(13), '')) = 'b98565e287914073320a01080191b3e5';
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1q. Nằm CHUNG bộ script của biểu (displayOrder = 5).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// 1q là biểu GỘP: mỗi dòng là một CHỈ TIÊU, không có dòng theo đơn vị. 4-tonghop-theo-ky đổ số vào
// đúng các ô của 3-getinputdata-khi-duyet.
// - Guard: Sở chỉ sửa ô nhập của dòng chỉ tiêu (ô đơn vị nhập ở 1-khoa-o-nhap-lieu, không công thức);
//   tham số, ghi chú, tiêu đề, ô công thức khoá.
// - getSummaryData: đọc lại từng chỉ tiêu (cùng mã, cùng ô với 3-getinputdata-khi-duyet),
//   organizationCode = '' (dòng gộp). Máy chủ so với tổng các đơn vị trong sổ Sở; phần chênh ghi vào
//   đơn vị Sở chọn ở hộp lý do, hoặc dòng "Sở điều chỉnh chung".

const SHEET = "1q";
const BINDINGS = [
  { code: "1Q.TT.BAO_DAN_TOC", name: "Người có uy tín › Cung cấp thông tin › Báo Dân tộc và phát triển", row: 8, qty: 14, amt: 16 },
  { code: "1Q.TT.BAO_DONG_NAI", name: "Người có uy tín › Cung cấp thông tin › Báo Đồng Nai", row: 9, qty: 14, amt: 16 },
  { code: "1Q.TT.BAO_BINH_PHUOC", name: "Người có uy tín › Cung cấp thông tin › Báo Bình Phước", row: 10, qty: 14, amt: 16 },
  { code: "1Q.TT.BAN_TIN_DTTS", name: "Người có uy tín › Cung cấp thông tin › Bản tin DTTS và miền núi", row: 11, qty: 14, amt: 16 },
  { code: "1Q.TT.HOP_MAT", name: "Người có uy tín › Cung cấp thông tin › Họp mặt, cung cấp thông tin", row: 12, qty: 14, amt: 16 },
  { code: "1Q.TT.TAP_HUAN", name: "Người có uy tín › Cung cấp thông tin › Tập huấn, bồi dưỡng kiến thức", row: 13, qty: 14, amt: 16 },
  { code: "1Q.TT.HOC_TAP", name: "Người có uy tín › Cung cấp thông tin › Học tập, trao đổi kinh nghiệm", row: 14, qty: 14, amt: 16 },
  { code: "1Q.TET.SO_DOI_TUONG", name: "Người có uy tín › Thăm hỏi tặng quà dịp Tết › Số đối tượng", row: 15, qty: 2, amt: 4 },
  { code: "1Q.OM_DAU.SO_DOI_TUONG", name: "Người có uy tín › Thăm hỏi hỗ trợ ốm đau › Số đối tượng", row: 15, qty: 5, amt: 7 },
  { code: "1Q.KHO_KHAN.SO_DOI_TUONG", name: "Người có uy tín › Hỗ trợ gia đình gặp khó khăn › Số đối tượng", row: 15, qty: 8, amt: 10 },
  { code: "1Q.QUA_DOI.SO_DOI_TUONG", name: "Người có uy tín › Thăm viếng khi qua đời › Số đối tượng", row: 15, qty: 11, amt: 13 },
];
// Ô Sở sửa được, dạng "dòng:cột" (0-based).
const EDITABLE = ["8:14","9:14","10:14","11:14","12:14","13:14","14:14","15:2","15:5","15:8","15:11"];

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function editable(ctx, sheetName, row, col) {
  return sheetName === SHEET && EDITABLE.indexOf(row + ':' + col) >= 0;
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở 1-khoa-o-nhap-lieu.
  beforeEdit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforeCommit(ctx, cell) {
    if (ctx.mode !== 'summary-edit') return;
    return editable(ctx, cell.sheetName, cell.row, cell.col);
  },
  beforePaste(ctx, range) {
    if (ctx.mode !== 'summary-edit') return;
    for (let row = range.row; row < range.row + range.rowCount; row += 1) {
      for (let col = range.col; col < range.col + range.colCount; col += 1) {
        if (!editable(ctx, range.sheetName, row, col)) return false;
      }
    }
    return true;
  },
  getSummaryData(ctx) {
    const rows = [];
    BINDINGS.forEach(function (b, index) {
      const quantity = b.qty == null ? null : num(ctx.cell.get(SHEET, b.row, b.qty));
      const amount = b.amt == null ? null : num(ctx.cell.get(SHEET, b.row, b.amt));
      if (quantity == null && amount == null) return;
      rows.push({ organizationCode: '', indicatorCode: b.code, indicatorName: b.name,
        quantity: quantity, amount: amount, orderNo: index });
    });
    return rows;
  },
});
$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-177'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '8a8a74d59cc8c2024b1b2b8212a46806'
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;
