--liquibase formatted sql

-- Biểu 1j (sinh viên sư phạm) — đợt soát script ngày 09/11/2026:
--   * Sổ cái Sở: 1j có hai mã chỉ tiêu (đặt hàng, nhu cầu xã hội) mà kịch bản "Tong hop theo ky" v2 cộng
--     gộp vào MỘT dòng mỗi đơn vị, nên changeset 177 phải chừa 1j. Nay:
--       - "Tong hop theo ky" v3: mỗi đơn vị HAI dòng (một dòng một mã), tên đơn vị ở cột B cả hai dòng,
--         loại đối tượng ở cột I; dòng 8, 9 là dòng tổng từng loại;
--       - thêm kịch bản "Sổ cái Sở" (displayOrder 4): Sở sửa cột C dòng đơn vị, getSummaryData đọc lại
--         từng dòng theo cặp (số SV cột C, kinh phí cột F);
--       - kịch bản khoá ô ("Script 1"): 3 guard bỏ qua mode 'summary-edit' như 1a–1s.
--   * Biểu Tổng hợp năm (BM-000009), tab 1j-dhdn-cdbp: thêm kịch bản "1j" (afterInject) — trước đây tab
--     không có khối nào đổ số, chỉ có số liệu mẫu của file gốc (1.085 và 5.365 sinh viên…) nên tab 01
--     dòng 47–48 hiện số mẫu. Xoá số mẫu ở dòng 12, 14; F14 thành =SUM(G14:H14) như F12.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/1j-scripts/v2/{1-khoa-o-nhap-lieu,4-tonghop-theo-ky,
-- 5-so-cai-so}.txt và docs/form-template/scripts/script-summariez/1j-tonghop-afterinject.txt.
--
-- Chỉ đụng bản còn đúng bản đối soát (md5 kịch bản cũ, ô mẫu còn số 1085); chạy lại không đổi gì.
-- stripComments:false vì Liquibase mặc định xoá chú thích /* */ trong mã JS. CSDL không có các biểu này
-- (CSDL thử dth-framework) thì không đổi dòng nào.

--changeset dth:180-1j-khoa-o-bo-qua-so splitStatements:false stripComments:false
--comment Biểu 1j: kịch bản khoá ô bỏ qua mode Sở sửa
WITH s AS (SELECT replace($js$// ==== 1j · Script 1/4 (v2): KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1j".
// Nguồn: form-template/1j.xlsx (sheet '1j', A1:I17). Tọa độ 0-based.
//
// ‼ THAY ĐỔI SO VỚI v1: biểu có HAI dòng dữ liệu, không phải một.
//   row 7 (dòng 8 trên màn hình) = đối tượng đào tạo theo ĐẶT HÀNG / GIAO NHIỆM VỤ
//   row 8 (dòng 9 trên màn hình) = đối tượng đào tạo theo NHU CẦU XÃ HỘI
// v1 chỉ khai DATA_ROW = 7 nên dòng 9 gõ không vào — beforeEdit luôn trả false cho nó.
//
// Biểu 1j (Phụ lục 01j — hỗ trợ tiền đóng học phí + sinh hoạt phí):
//   C(2)=Số đối tượng | D(3)=Mức thu học phí | E(4)=Số tháng
//   F(5)=G+H · G(6)=ROUND(C*D) hỗ trợ học phí · H(7)=ROUND(C*C12*E) SHP ← CÔNG THỨC | I(8)=Ghi chú
// MỨC THU HỌC PHÍ (D), SỐ THÁNG (E), mức SHP (C12) gắn template → KHOÁ (đơn vị không sửa).
// Đơn vị CHỈ nhập C (số đối tượng) + I (ghi chú), trên CẢ HAI dòng.

const SHEET = '1j';
const DATA_ROWS = [7, 8];
const INPUT_COLS = [2, 8]; // C số đối tượng, I ghi chú

function isEditable(row, col) {
  if (row === 2 && col === 1) return true;
  return DATA_ROWS.indexOf(row) >= 0 && INPUT_COLS.indexOf(col) >= 0;
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 2, 1, false);
  DATA_ROWS.forEach(function (row) {
    INPUT_COLS.forEach(function (col) { ctx.cell.lock(SHEET, row, col, false); });
  });
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
  // Guard của màn NHẬP: ở sổ cái Sở ('summary-edit') không ý kiến — kịch bản "Sổ cái Sở" quyết ô Sở sửa.
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
    updated_by = 'liquibase-180'
FROM s
WHERE t.name = 'Script 1'
  AND md5(replace(t.code, chr(13), '')) = '1557dce9724424adec821910a1ceb5dd';
--rollback SELECT 1;

--changeset dth:180-1j-tonghop-ky-v3 splitStatements:false stripComments:false
--comment Biểu 1j: tổng hợp theo kỳ mỗi đơn vị hai dòng (một dòng một mã chỉ tiêu)
WITH s AS (SELECT replace($js$// ==== 1j - Script 4/5 (v3) - AFTERINJECT: TONG HOP THEO KY (tab "Tong hop theo bieu (ky)") ====
// Script do so cua KY dang chon (ctx.shared.periodId) vao chinh bieu 1j:
//   - dong 8 (0-based 7) = TONG loai DAT HANG / GIAO NHIEM VU (cong moi don vi),
//   - dong 9 (0-based 8) = TONG loai NHU CAU XA HOI,
//   - moi don vi duoc GIAO BIEU NAY trong ky them HAI dong ben duoi: dong dau = dat hang, dong sau =
//     nhu cau xa hoi; ten don vi o cot B (ca hai dong), loai doi tuong ghi o cot I.
//     Don vi khong duoc giao bieu nay thi KHONG co dong (loc theo ma bieu ctx.shared.sheetCode).
// Don vi duoc giao ma chua nop -> van co hai dong, so de trong (nhin ra ai con thieu).
// Kinh phi (F = G + H, G = so SV x muc hoc phi, H = so SV x sinh hoat phi x so thang) la cong thuc cua
// bieu, KHONG ghi de; script ghi so SV (C) va muc (D), so thang (E) cho tung dong.
// Man NHAP LIEU khong co ctx.shared.periodId nen script tu bo qua.
//
// ‼ THAY DOI SO VOI v2 (changeset 180, 09/11/2026): v2 CONG GOP hai ma chi tieu vao MOT dong don vi nen
//   So cai So khong tach lai duoc theo tung ma. v3 de MOI DON VI HAI DONG (mot dong mot ma) — kich ban
//   "So cai So" doc lai tung dong theo cap.

const SHEET = '1j';
const ROW_DH = 7;            // dong mau dat hang (= dong TONG dat hang)
const ROW_XH = 8;            // dong mau nhu cau xa hoi (= dong TONG nhu cau xa hoi)
const FIRST_UNIT_ROW = 9;    // dong dau tien cua don vi
const ORG_COL = 1;           // cot B: ten don vi
const QTY_COL = 2;           // C: so doi tuong
const MUC_COL = 3;           // D: muc thu hoc phi
const THANG_COL = 4;         // E: so thang ho tro
const NOTE_COL = 8;          // I: ghi chu → ghi loai doi tuong
const LOAI = [
  { code: '1J.DATHANG.SO_DOI_TUONG', row: ROW_DH, label: 'Đặt hàng, giao nhiệm vụ' },
  { code: '1J.XAHOI.SO_DOI_TUONG', row: ROW_XH, label: 'Nhu cầu xã hội' },
];
const CK = 'indi' + 'catorCode';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function put(ctx, r, c, v) {
  if (c == null || v == null) return;
  try {
    const f = ctx.cell.getFormula(SHEET, r, c);
    if (f && String(f).trim() !== '') return;   // o cong thuc: de bieu tu tinh
    ctx.cell.set(SHEET, r, c, v);
  } catch (e) { /* o khoa/cong thuc */ }
}
function setText(ctx, r, c, v) { try { ctx.cell.set(SHEET, r, c, v); } catch (e) {} }

return defineScript({
  async afterInject(ctx) {
    const periodId = ctx.shared && ctx.shared.periodId;
    if (!periodId) return;
    const scope = (ctx.shared && ctx.shared.scopeKind) ? '&scopeKind=' + ctx.shared.scopeKind : '';
    const src = (ctx.shared && ctx.shared.sourceSheet)
      ? '&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet) : '';

    async function get(path) {
      try { return (await ctx.api.get(path)) || []; }
      catch (e) { ctx.ui.message('Loi lay so 1j: ' + e.message); return []; }
    }
    // 1) Don vi DUOC GIAO BIEU NAY trong ky (ke ca chua nop) + 2) so lieu theo tung don vi
    const bieu = (ctx.shared && ctx.shared.sheetCode)
      ? '&sourceSheetCode=' + encodeURIComponent(ctx.shared.sheetCode) : '';
    const units = await get('/rest/qt/summary/period-organizations?periodId=' + periodId + bieu);
    const rows = await get('/rest/qt/summary/data?periodId=' + periodId + '&groupByOrg=true' + scope + src);

    const byOrg = {};
    for (const r of rows) {
      const code = r.organizationCode || '';
      (byOrg[code] || (byOrg[code] = {}))[r[CK]] = r;
    }
    // Thu tu: don vi duoc giao truoc (theo ma), roi don vi CO SO CUA BIEU NAY ma khong nam trong danh sach
    // giao (du lieu cu) - ten nhom sau tra danh muc. So bieu khac KHONG tinh.
    const codes = [];
    for (const u of units) if (codes.indexOf(u.code) < 0) codes.push(u.code);
    const nameOf = {};
    for (const u of units) nameOf[u.code] = u.name || u.code;
    const extra = [];
    for (const c in byOrg) {
      if (c && c !== 'TONG_HOP' && codes.indexOf(c) < 0 && LOAI.some((l) => byOrg[c][l.code])) extra.push(c);
    }
    if (extra.length > 0) {
      for (const u of await get('/rest/qt/master/organization-units')) if (!nameOf[u.code]) nameOf[u.code] = u.name || u.code;
      for (const c of extra.sort()) codes.push(c);
    }
    if (codes.length === 0) { ctx.ui.message('1j: ky nay chua giao bieu cho don vi nao.'); return; }

    // Muc va so thang cua tung loai lay tu dong mau TRUOC khi nhan dong (clone khong chep so).
    const muc = LOAI.map((l) => num(ctx.cell.get(SHEET, l.row, MUC_COL)));
    const thang = LOAI.map((l) => num(ctx.cell.get(SHEET, l.row, THANG_COL)));

    // Hai dong moi don vi, chen ngay duoi dong mau nhu cau xa hoi.
    ctx.rows.clone(SHEET, ROW_XH, codes.length * LOAI.length);

    const total = LOAI.map(() => null);
    codes.forEach(function (code, i) {
      const data = byOrg[code] || {};
      LOAI.forEach(function (l, k) {
        const r0 = FIRST_UNIT_ROW + i * LOAI.length + k;
        setText(ctx, r0, 0, k === 0 ? String(i + 1) : '');
        setText(ctx, r0, ORG_COL, nameOf[code] || code);
        setText(ctx, r0, NOTE_COL, l.label);
        put(ctx, r0, MUC_COL, muc[k]);
        put(ctx, r0, THANG_COL, thang[k]);
        const row = data[l.code];
        const q = row ? num(row.quantity) : null;
        put(ctx, r0, QTY_COL, q);
        if (q != null) total[k] = (total[k] || 0) + q;
      });
    });

    // Dong TONG tung loai (giu ten loai o cot B, muc/so thang cua mau)
    LOAI.forEach(function (l, k) { put(ctx, l.row, QTY_COL, total[k]); });

    ctx.ui.message('Da do 1j: ' + codes.length + ' don vi x 2 loai doi tuong + 2 dong tong (theo ky dang chon).');
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-180'
FROM s
WHERE t.name = 'Tong hop theo ky'
  AND md5(replace(t.code, chr(13), '')) = 'fa004caf72adcea3c3d700487ebcb418';
--rollback SELECT 1;

--changeset dth:180-1j-so-cai-so splitStatements:false stripComments:false
--comment Biểu 1j: thêm kịch bản "Sổ cái Sở"
WITH s AS (SELECT replace($js$// Hàm cho SỔ CÁI SỞ — biểu 1j. Nằm CHUNG bộ script của biểu (displayOrder = 4).
// Hook: beforeEdit, beforeCommit, beforePaste (chỉ có hiệu lực ở mode 'summary-edit'), getSummaryData
// (máy chủ chạy mỗi lần Sở bấm Lưu sổ).
//
// Bảng tổng hợp kỳ của 1j (kịch bản "Tong hop theo ky" v3): mỗi đơn vị HAI dòng liền nhau từ dòng 10
// (0-based 9) — dòng đầu = đặt hàng / giao nhiệm vụ, dòng sau = nhu cầu xã hội; tên đơn vị ở cột B
// của cả hai dòng. Hai dòng 8, 9 là dòng TỔNG từng loại (không sửa).
// - Guard: Sở chỉ sửa cột C (số sinh viên) ở dòng đơn vị; kinh phí F = G + H là công thức tự tính.
// - getSummaryData: đọc lại cột C (số SV) + cột F (kinh phí đã tính) của từng dòng, theo cặp.

const SHEET = '1j';
const FIRST_UNIT_ROW = 9;
const NAME_COL = 1;
const QTY_COL = 2;
const AMOUNT_COL = 5;
const MAX_UNITS = 2000;
const LOAI = [
  { code: '1J.DATHANG.SO_DOI_TUONG', name: 'SV sư phạm đào tạo theo đặt hàng/giao nhiệm vụ › Số đối tượng' },
  { code: '1J.XAHOI.SO_DOI_TUONG', name: 'SV sư phạm đào tạo theo nhu cầu xã hội › Số đối tượng' },
];

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
  return sheetName === SHEET && row >= FIRST_UNIT_ROW && col === QTY_COL && unitName(ctx, row) !== '';
}

return defineScript({
  // Ngoài sổ cái Sở (màn nhập, tổng hợp) không ý kiến — guard của màn nhập ở kịch bản khoá ô.
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
      const first = FIRST_UNIT_ROW + i * LOAI.length;
      const name = unitName(ctx, first);
      if (name === '') break;
      const code = codeByName[name];
      if (!code) {
        ctx.issues.add({ severity: 'ERROR', code: 'UNKNOWN_UNIT',
          message: 'Biểu 1j: không xác định được mã của đơn vị "' + name + '" (dòng ' + (first + 1) + ').' });
        continue;
      }
      for (let k = 0; k < LOAI.length; k += 1) {
        const row = first + k;
        if (unitName(ctx, row) !== name) {
          ctx.issues.add({ severity: 'ERROR', code: 'ROW_PAIR',
            message: 'Biểu 1j: dòng ' + (row + 1) + ' phải cùng đơn vị "' + name + '" với dòng ' + (first + 1) + '.' });
          continue;
        }
        const quantity = num(ctx.cell.get(SHEET, row, QTY_COL));
        const amount = num(ctx.cell.get(SHEET, row, AMOUNT_COL));
        if (quantity == null && amount == null) continue;
        rows.push({ organizationCode: code, indicatorCode: LOAI[k].code, indicatorName: LOAI[k].name,
          quantity: quantity, amount: amount, orderNo: i });
      }
    }
    return rows;
  },
});$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT g.template_version_id, tp.code, 'Sổ cái Sở', 'Sở sửa số trực tiếp trên sổ cái Sở: ô được sửa + trích số khi Lưu (getSummaryData)', s.code, 'beforeEdit,beforeCommit,beforePaste,getSummaryData',
       4, TRUE, encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-180'
FROM asxh_template_scripts g
JOIN asxh_template_versions v ON v.id = g.template_version_id
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE g.display_order = 2
  AND md5(replace(g.code, chr(13), '')) = '63a48e0aa40f49263f1c703bfea52936'
  AND EXISTS (SELECT 1 FROM asxh_template_scripts k WHERE k.template_version_id = g.template_version_id
              AND md5(replace(k.code, chr(13), '')) = 'b684531fd0980e207d27ed8bdec15ee6')
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e
                  WHERE e.template_version_id = g.template_version_id
                    AND (e.declared_hooks LIKE '%getSummaryData%' OR e.display_order = 4));
--rollback SELECT 1;

--changeset dth:180-tonghop-1j-mau splitStatements:false
--comment Tổng hợp năm, tab 1j-dhdn-cdbp: xoá số liệu mẫu dòng 12, 14; F14 =SUM(G14:H14)
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(jsonb_set((((((((((((v.workbook_json::jsonb
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,11,2,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,11,3,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,11,4,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,11,6,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,11,7,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,2,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,3,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,4,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,5,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,6,value}')
    #- '{sheets,1j-dhdn-cdbp,data,dataTable,13,7,value}'),
    '{sheets,1j-dhdn-cdbp,data,dataTable,13,5,formula}', to_jsonb('SUM(G14:H14)'::text)),
    '{sheets,1j-dhdn-cdbp,data,dataTable,13,5,value}', '0'::jsonb),
    '{sheets,1j-dhdn-cdbp,data,dataTable,11,5,value}', '0'::jsonb))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,1j-dhdn-cdbp,data,dataTable,11,2,value}' = '1085'
  AND v.workbook_json::jsonb #>> '{sheets,1j-dhdn-cdbp,data,dataTable,13,2,value}' = '5365'
  AND v.workbook_json::jsonb #>> '{sheets,1j-dhdn-cdbp,data,dataTable,13,5,formula}' IS NULL;
--rollback SELECT 1;

--changeset dth:180-tonghop-1j-script splitStatements:false stripComments:false
--comment Tổng hợp năm: thêm kịch bản "1j" đổ số vào tab 1j-dhdn-cdbp
WITH s AS (SELECT replace($js$// ============================================================================
//  SCRIPT TỔNG HỢP · BIỂU 1j (1j-dhdn-cdbp)  —  hook afterInject  (THEO LOẠI ĐỐI TƯỢNG · CẢ NĂM)
//  Hỗ trợ học phí, sinh hoạt phí sinh viên sư phạm (NĐ 116/2020). Tab có hai nhóm:
//    I  (dòng 11) đặt hàng / giao nhiệm vụ  → dòng số liệu 12
//    II (dòng 13) nhu cầu xã hội             → dòng số liệu 14
//  Mỗi dòng số liệu = CỘNG mọi đơn vị (năm dương lịch from=Y-01-01 to=Y-12-31); cột B ghi tên các đơn vị
//  có số. C = số sinh viên, D = mức thu học phí, G = hỗ trợ học phí = ROUND(C × D),
//  H = hỗ trợ sinh hoạt phí = kinh phí sổ cái − G, F = G + H (công thức của tab).
//  ‼ Sổ cái 1j lưu MỘT kinh phí (= học phí + sinh hoạt phí) cho mỗi mã; tách lại bằng mức học phí của
//    biểu nhập 1j (D8 = 17, D9 = 14 triệu đồng). Đổi mức ở biểu nhập thì sửa MUC_HOC_PHI ở đây.
//  Tab 01 dòng 47 (học phí) lấy C10, G10; dòng 48 (sinh hoạt phí) lấy C10, H10.
// ============================================================================

const SHEET = '1j-dhdn-cdbp';
const CK = 'indi' + 'catorCode';
const LOAI = [
  { code: '1J.DATHANG.SO_DOI_TUONG', row: 12, mucHocPhi: 17 },
  { code: '1J.XAHOI.SO_DOI_TUONG', row: 14, mucHocPhi: 14 },
];
const B = 1, C = 2, D = 3, G = 6, H = 7;

function num(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function put(ctx, r, c, v) {
  if (v == null) return;
  try { const f = ctx.cell.getFormula(SHEET, r, c); if (f && String(f).trim() !== '') return; ctx.cell.set(SHEET, r, c, v); }
  catch (e) { /* bỏ qua */ }
}
function setText(ctx, r, c, v) { try { ctx.cell.set(SHEET, r, c, v); } catch (e) { /* bỏ qua */ } }

return defineScript({
  async afterInject(ctx) {
    const a = (ctx.shared && ctx.shared.a != null) ? Number(ctx.shared.a)
      : ((ctx.shared && ctx.shared.year) ? Number(ctx.shared.year) : 2025);
    const scope = (ctx.shared && ctx.shared.scopeKind) ? ('&scopeKind=' + ctx.shared.scopeKind) : '';
    const src = (ctx.shared && ctx.shared.sourceSheet) ? ('&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet)) : '';
    async function apiGet(path) { try { return (await ctx.api.get(path)) || []; } catch (e) { ctx.ui.message('Lỗi 1j: ' + e.message); return []; } }

    const rows = await apiGet('/rest/qt/summary/data?from=' + a + '-01-01&to=' + a + '-12-31&groupByOrg=true' + scope + src);
    const sum = LOAI.map(() => ({ q: null, kp: null, orgs: [] }));
    for (const r of rows) {
      const k = LOAI.findIndex((l) => l.code === r[CK]);
      if (k < 0) continue;
      const q = num(r.quantity), kp = num(r.amount);
      if (q == null && kp == null) continue;
      const s = sum[k];
      if (q != null) s.q = (s.q || 0) + q;
      if (kp != null) s.kp = (s.kp || 0) + kp;
      // TONG_HOP = dòng Sở điều chỉnh chung: cộng số, không ghi tên.
      if (r.organizationCode && r.organizationCode !== 'TONG_HOP' && s.orgs.indexOf(r.organizationCode) < 0) s.orgs.push(r.organizationCode);
    }
    let names = {};
    if (sum.some((s) => s.orgs.length > 0)) {
      for (const u of await apiGet('/rest/qt/master/organization-units')) names[u.code] = u.name || u.code;
    }
    let filled = 0;
    LOAI.forEach(function (l, k) {
      const s = sum[k];
      const r0 = l.row - 1;
      if (s.q == null && s.kp == null) return;
      setText(ctx, r0, B, s.orgs.map((c) => names[c] || c).join('; '));
      put(ctx, r0, C, s.q);
      put(ctx, r0, D, l.mucHocPhi);
      const hocPhi = s.q == null ? null : Math.round(s.q * l.mucHocPhi);
      put(ctx, r0, G, hocPhi);
      if (s.kp != null) put(ctx, r0, H, s.kp - (hocPhi || 0));
      filled += 1;
    });
    ctx.ui.message('Đã đổ 1j (năm ' + a + '): ' + filled + ' loại đối tượng. Tổng + tab 01 tự tính.');
  },
});$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT v.id, tp.code, '1j', NULL, s.code, 'afterInject', 16, TRUE,
       encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-180'
FROM asxh_template_versions v
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE tp.code = 'BM-000009'
  AND EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1k')
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1j');
--rollback SELECT 1;
