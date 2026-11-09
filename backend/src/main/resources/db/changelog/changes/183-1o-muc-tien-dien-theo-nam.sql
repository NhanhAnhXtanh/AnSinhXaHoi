--liquibase formatted sql

-- Biểu 1o (tiền điện hộ nghèo, hộ chính sách xã hội) — mức hỗ trợ theo NĂM của kỳ báo cáo, đợt soát 09/11/2026.
-- Trước đây biểu nhập tính kinh phí = số hộ × 65.472 đ × 12 tháng cho mọi năm (H8 61.333 đ, I8 không công thức
-- nào dùng), còn tab 1o của Tổng hợp năm cố định 61.333 đ × 4 + 64.282 đ × 8 tháng (đúng cho 2025) — năm 2026
-- biểu nhập cao hơn ~1,85%, Tổng hợp năm thấp hơn ~1,5%. Theo ghi chú văn bản ngay trong biểu:
--   2025 = 61.333 đ × 4 tháng (QĐ 2699/QĐ-BTC, giá 1.893) + 64.282 đ × 8 tháng (QĐ 1279/QĐ-BTC, giá 1.984, VAT 8%);
--   2026 = 64.282 đ × 12 tháng (VAT 8% tới 31/12/2026, NĐ 174/2025); từ 2027 = 65.472 đ × 12 tháng (VAT 10%).
-- Mỗi đợt báo cáo vẫn tính cả năm 12 tháng như file gốc; Tổng hợp năm lấy số hộ lớn nhất giữa các đợt.
--   * Biểu nhập 1o: M8, N8 = ROUND(hộ × (H8 × I8 + J8 × K8), 0); I8, J8, K8 thành ô giá trị (trước là =$C$18,
--     =$C$17); bỏ tham số C17, C18 (không còn dùng), ghi chú cách điền ở B17.
--   * Ba kịch bản dùng chung bảng BIEU_GIA và điền H, I, J, K + tiêu đề "Mức hỗ trợ (… đồng)" theo năm:
--     khoá ô (onLoad, chỉ phiếu DRAFT/RETURNED có công thức mới — phiếu đã nộp/đã duyệt giữ số đã lưu),
--     tổng hợp theo kỳ và Sổ cái Sở (cả hai đọc năm của kỳ ở ctx.shared.year do màn đặt sẵn), khối "1o"
--     Tổng hợp năm (năm a, dòng 9; H9, J9 thành ô giá trị).
-- Bản đầy đủ: docs/form-template/scripts/script-templates/1o-scripts/{1-khoa-o-nhap-lieu,4-tonghop-theo-ky}.txt và
-- docs/form-template/scripts/script-summariez/1o-tonghop-afterinject.txt.
-- Chỉ đụng bản còn đúng bản đối soát (md5 kịch bản cũ, công thức cũ); chạy lại không đổi gì. KHÔNG đụng phiếu đã
-- lưu (asxh_input_report_sheets.data_json): bản sao của phiếu giữ công thức cũ, kịch bản khoá ô thấy M8 không có
-- $H$8 thì không điền mức, nên phiếu cũ tính như trước (65.472 đ × 12). Phiếu chưa có bản sao lấy biểu mới.

--changeset dth:183-1o-bieu-nhap-hai-muc splitStatements:false
--comment Biểu nhập 1o: kinh phí = hộ × (H8 × I8 + J8 × K8); I8, J8, K8 thành ô giá trị; bỏ tham số C17, C18
UPDATE asxh_template_versions v
SET workbook_json = ((((jsonb_set(jsonb_set(jsonb_set(jsonb_set(((jsonb_set(jsonb_set(jsonb_set((jsonb_set((jsonb_set((jsonb_set(v.workbook_json::jsonb,
    '{sheets,1o,data,dataTable,7,7,value}', '0.0642816'::jsonb)
    #- '{sheets,1o,data,dataTable,7,8,formula}'),
    '{sheets,1o,data,dataTable,7,8,value}', '12'::jsonb)
    #- '{sheets,1o,data,dataTable,7,9,formula}'),
    '{sheets,1o,data,dataTable,7,9,value}', '0'::jsonb)
    #- '{sheets,1o,data,dataTable,7,10,formula}'),
    '{sheets,1o,data,dataTable,7,10,value}', '0'::jsonb),
    '{sheets,1o,data,dataTable,7,12,formula}', to_jsonb('ROUND(D8*($H$8*$I$8+$J$8*$K$8),0)'::text)),
    '{sheets,1o,data,dataTable,7,13,formula}', to_jsonb('ROUND(E8*($H$8*$I$8+$J$8*$K$8),0)'::text))
    #- '{sheets,1o,sharedFormulas,1}')
    #- '{sheets,1o,sharedFormulas,2}'),
    '{sheets,1o,data,dataTable,4,7,value}', to_jsonb('Mức hỗ trợ (64.282 đồng)'::text)),
    '{sheets,1o,data,dataTable,4,9,value}', to_jsonb('Mức hỗ trợ (không áp dụng năm 2026)'::text)),
    '{sheets,1o,data,dataTable,15,1,value}', to_jsonb('THAM SỐ TÍNH TOÁN'::text)),
    '{sheets,1o,data,dataTable,16,1,value}', to_jsonb('Mức và số tháng hỗ trợ ở H8:K8 tự điền theo năm của kỳ báo cáo: 2025 = 61.333 đ × 4 tháng + 64.282 đ × 8 tháng; 2026 = 64.282 đ × 12 tháng; từ 2027 = 65.472 đ × 12 tháng.'::text))
    #- '{sheets,1o,data,dataTable,16,2,value}')
    #- '{sheets,1o,data,dataTable,17,1,value}')
    #- '{sheets,1o,data,dataTable,17,2,value}'))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000017')
  AND v.workbook_json::jsonb #>> '{sheets,1o,data,dataTable,7,9,formula}' = '$C$17'
  AND v.workbook_json::jsonb #>> '{sheets,1o,sharedFormulas,2,formula}' = 'ROUND(D8*$J$8*$K$8,0)'
  AND v.workbook_json::jsonb #>> '{sheets,1o,sharedFormulas,1,formula}' = '$C$18';
--rollback SELECT 1;

--changeset dth:183-tonghop-1o-gia-tri splitStatements:false
--comment Tổng hợp năm, tab 1o-snnmt-95xp: H9, J9 thành ô giá trị (kịch bản điền theo năm)
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(jsonb_set(jsonb_set((jsonb_set(jsonb_set((v.workbook_json::jsonb
    #- '{sheets,1o-snnmt-95xp,data,dataTable,8,7,formula}'),
    '{sheets,1o-snnmt-95xp,data,dataTable,8,7,value}', '0.0642816'::jsonb),
    '{sheets,1o-snnmt-95xp,data,dataTable,8,8,value}', '12'::jsonb)
    #- '{sheets,1o-snnmt-95xp,data,dataTable,8,9,formula}'),
    '{sheets,1o-snnmt-95xp,data,dataTable,8,9,value}', '0'::jsonb),
    '{sheets,1o-snnmt-95xp,data,dataTable,8,10,value}', '0'::jsonb),
    '{sheets,1o-snnmt-95xp,data,dataTable,4,7,value}', to_jsonb('Mức hỗ trợ (64.282 đồng)'::text)),
    '{sheets,1o-snnmt-95xp,data,dataTable,4,9,value}', to_jsonb('Mức hỗ trợ (không áp dụng năm 2026)'::text)))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,1o-snnmt-95xp,data,dataTable,8,7,formula}' = '1893*1.08*30/1000000'
  AND v.workbook_json::jsonb #>> '{sheets,1o-snnmt-95xp,data,dataTable,8,9,formula}' = '1984*30*1.08/1000000';
--rollback SELECT 1;

--changeset dth:183-1o-khoa-o splitStatements:false stripComments:false
--comment Biểu 1o, kịch bản khoá ô: điền mức + số tháng theo năm của kỳ khi mở phiếu còn sửa được
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

// ---- Mức hỗ trợ tiền điện theo NĂM của kỳ (changeset 183) ----
// Mức (triệu đồng/hộ/tháng) = 30 kWh × giá điện bậc 1 × (1 + VAT), theo ghi chú văn bản trong biểu:
//   QĐ 2699/QĐ-BTC (giá 1.893 đ) cho 4 tháng đầu 2025; QĐ 1279/QĐ-BTC (giá 1.984 đ) từ tháng 5/2025;
//   VAT 8% tới 31/12/2026 (NĐ 174/2025/NĐ-CP), 10% từ 2027. Mỗi năm tối đa hai mức: kinh phí = hộ × (H × I + J × K).
//   Giá điện đổi thì thêm một dòng vào BIEU_GIA ở CẢ BA kịch bản 1o (khoá ô, tổng hợp theo kỳ, tổng hợp năm).
const mucHoTro = (gia, vat) => Math.round(30 * gia * (1 + vat) * 10) / 1e7; // triệu đồng/hộ/tháng, 7 số lẻ
const BIEU_GIA = [
  { tuNam: 0, muc: [[mucHoTro(1893, 0.08), 4, '61.333'], [mucHoTro(1984, 0.08), 8, '64.282']] },
  { tuNam: 2026, muc: [[mucHoTro(1984, 0.08), 12, '64.282']] },
  { tuNam: 2027, muc: [[mucHoTro(1984, 0.10), 12, '65.472']] },
];
const GIA_ROW = 7;        // dòng chứa H (mức 1), I (số tháng 1), J (mức 2), K (số tháng 2) — 0-based
const GIA_HEADER_ROW = 4; // dòng tiêu đề "Mức hỗ trợ (… đồng)" — 0-based
function datBieuGia(ctx, nam) {
  let g = BIEU_GIA[0];
  for (const x of BIEU_GIA) if (nam >= x.tuNam) g = x;
  [[7, 8], [9, 10]].forEach(function (cot, k) {
    const m = g.muc[k];
    ctx.cell.set(SHEET, GIA_ROW, cot[0], m ? m[0] : 0);
    ctx.cell.set(SHEET, GIA_ROW, cot[1], m ? m[1] : 0);
    ctx.cell.set(SHEET, GIA_HEADER_ROW, cot[0],
      m ? 'Mức hỗ trợ (' + m[2] + ' đồng)' : 'Mức hỗ trợ (không áp dụng năm ' + nam + ')');
  });
}
function namCuaKy(ctx) {   // màn nhập và màn tổng hợp đặt sẵn ctx.shared.year = năm của kỳ
  const y = Number(ctx.shared && ctx.shared.year);
  return Number.isFinite(y) && y > 0 ? y : NaN;
}

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
    // Mức + số tháng theo năm của kỳ — chỉ khi phiếu còn sửa được; phiếu đã nộp / đã duyệt giữ số đã lưu.
    const st = ctx.report && ctx.report.status ? String(ctx.report.status) : '';
    // Phiếu lưu từ trước 183 giữ công thức cũ M8 = D8 × J8 × K8 (không có H8): để nguyên, không thì kinh phí về 0.
    const congThucMoi = String(ctx.cell.getFormula(SHEET, DATA_ROW, 12) || '').indexOf('$H$8') >= 0;
    const nam = namCuaKy(ctx);
    if ((st === 'DRAFT' || st === 'RETURNED') && congThucMoi && Number.isFinite(nam)) datBieuGia(ctx, nam);
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
    updated_by = 'liquibase-183'
FROM s
WHERE t.name = 'Script 1' AND t.sheet_code = 'BM-000017'
  AND md5(replace(t.code, chr(13), '')) = '22f27663baac14b7ae9d4919f6c3e8c7';
--rollback SELECT 1;

--changeset dth:183-1o-tonghop-ky splitStatements:false stripComments:false
--comment Biểu 1o, tổng hợp theo kỳ: điền mức + số tháng theo năm của kỳ đang xem
WITH s AS (SELECT replace($js$// ==== 1o - AFTERINJECT: TONG HOP THEO KY (tab "Tong hop theo bieu (ky)") ====
// Bieu nay moi dong la MOT DON VI. Script do so cua KY dang chon (ctx.shared.periodId):
//   - dong 8 = TONG CONG (cong moi don vi),
//   - moi don vi duoc GIAO BIEU NAY trong ky them mot dong ben duoi, ten don vi ghi o cot B.
//     Don vi khong duoc giao bieu nay thi KHONG co dong (loc theo ma bieu ctx.shared.sheetCode).
// Don vi duoc giao ma chua nop -> van co dong, so de trong (nhin ra ai con thieu).
// O cong thuc (kinh phi = so luong x muc x thang) KHONG ghi de - bieu tu tinh.
// Man NHAP LIEU khong co ctx.shared.periodId nen script tu bo qua.

const SHEET = '1o';
const ROW0 = 7;          // dong du lieu goc (0-based)
const ORG_COL = 1;            // cot B: "Chi tieu / Don vi"
const BINDINGS = [{"code": "1O.TIEN_DIEN.HO_NGHEO", "qty": 3, "amt": 12}, {"code": "1O.TIEN_DIEN.HO_CS_TCXH_KHAC", "qty": 5, "amt": null}, {"code": "1O.TIEN_DIEN.HO_CS_TCXH_QUY_DINH", "qty": 6, "amt": null}, {"code": "1O.TIEN_DIEN.HO_CS.KINH_PHI", "qty": null, "amt": 13}];
const CK = 'indi' + 'catorCode';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
// ---- Mức hỗ trợ tiền điện theo NĂM của kỳ (changeset 183) ----
// Mức (triệu đồng/hộ/tháng) = 30 kWh × giá điện bậc 1 × (1 + VAT), theo ghi chú văn bản trong biểu:
//   QĐ 2699/QĐ-BTC (giá 1.893 đ) cho 4 tháng đầu 2025; QĐ 1279/QĐ-BTC (giá 1.984 đ) từ tháng 5/2025;
//   VAT 8% tới 31/12/2026 (NĐ 174/2025/NĐ-CP), 10% từ 2027. Mỗi năm tối đa hai mức: kinh phí = hộ × (H × I + J × K).
//   Giá điện đổi thì thêm một dòng vào BIEU_GIA ở CẢ BA kịch bản 1o (khoá ô, tổng hợp theo kỳ, tổng hợp năm).
const mucHoTro = (gia, vat) => Math.round(30 * gia * (1 + vat) * 10) / 1e7; // triệu đồng/hộ/tháng, 7 số lẻ
const BIEU_GIA = [
  { tuNam: 0, muc: [[mucHoTro(1893, 0.08), 4, '61.333'], [mucHoTro(1984, 0.08), 8, '64.282']] },
  { tuNam: 2026, muc: [[mucHoTro(1984, 0.08), 12, '64.282']] },
  { tuNam: 2027, muc: [[mucHoTro(1984, 0.10), 12, '65.472']] },
];
const GIA_ROW = 7;        // dòng chứa H (mức 1), I (số tháng 1), J (mức 2), K (số tháng 2) — 0-based
const GIA_HEADER_ROW = 4; // dòng tiêu đề "Mức hỗ trợ (… đồng)" — 0-based
function datBieuGia(ctx, nam) {
  let g = BIEU_GIA[0];
  for (const x of BIEU_GIA) if (nam >= x.tuNam) g = x;
  [[7, 8], [9, 10]].forEach(function (cot, k) {
    const m = g.muc[k];
    ctx.cell.set(SHEET, GIA_ROW, cot[0], m ? m[0] : 0);
    ctx.cell.set(SHEET, GIA_ROW, cot[1], m ? m[1] : 0);
    ctx.cell.set(SHEET, GIA_HEADER_ROW, cot[0],
      m ? 'Mức hỗ trợ (' + m[2] + ' đồng)' : 'Mức hỗ trợ (không áp dụng năm ' + nam + ')');
  });
}
function namCuaKy(ctx) {   // màn nhập và màn tổng hợp đặt sẵn ctx.shared.year = năm của kỳ
  const y = Number(ctx.shared && ctx.shared.year);
  return Number.isFinite(y) && y > 0 ? y : NaN;
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
    // Mức + số tháng theo năm của kỳ đang xem (dòng 8 dùng chung cho mọi dòng đơn vị).
    const nam = namCuaKy(ctx);
    if (Number.isFinite(nam)) datBieuGia(ctx, nam);
    const scope = (ctx.shared && ctx.shared.scopeKind) ? '&scopeKind=' + ctx.shared.scopeKind : '';
    const src = (ctx.shared && ctx.shared.sourceSheet)
      ? '&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet) : '';

    async function get(path) {
      try { return (await ctx.api.get(path)) || []; }
      catch (e) { ctx.ui.message('Loi lay so 1o: ' + e.message); return []; }
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
    // Thu tu: don vi duoc giao truoc (theo ma), roi don vi CO SO CUA BIEU NAY (ma trong BINDINGS) ma
    // khong nam trong danh sach giao (du lieu cu) - ten nhom sau tra danh muc. So bieu khac KHONG tinh.
    const codes = [];
    for (const u of units) if (codes.indexOf(u.code) < 0) codes.push(u.code);
    const nameOf = {};
    for (const u of units) nameOf[u.code] = u.name || u.code;
    const extra = [];
    for (const c in byOrg) {
      if (c && c !== 'TONG_HOP' && codes.indexOf(c) < 0 && BINDINGS.some((b) => byOrg[c][b.code])) extra.push(c);
    }
    if (extra.length > 0) {
      for (const u of await get('/rest/qt/master/organization-units')) if (!nameOf[u.code]) nameOf[u.code] = u.name || u.code;
      for (const c of extra.sort()) codes.push(c);
    }
    if (codes.length === 0) { ctx.ui.message('1o: ky nay chua giao bieu cho don vi nao.'); return; }

    // Chen du dong: dong ROW0 giu lam TONG CONG, moi don vi mot dong ben duoi
    if (codes.length > 0) ctx.rows.clone(SHEET, ROW0, codes.length);

    const total = {};
    codes.forEach(function (code, i) {
      const r0 = ROW0 + 1 + i;
      setText(ctx, r0, ORG_COL, nameOf[code] || code);
      setText(ctx, r0, 0, String(i + 1));
      const data = byOrg[code] || {};
      for (const b of BINDINGS) {
        const row = data[b.code];
        if (!row) continue;
        const q = num(row.quantity), a = num(row.amount);
        put(ctx, r0, b.qty, q);
        put(ctx, r0, b.amt, a);
        const t = total[b.code] || (total[b.code] = { q: null, a: null });
        if (q != null) t.q = (t.q || 0) + q;
        if (a != null) t.a = (t.a || 0) + a;
      }
    });
    // Dong TONG CONG
    setText(ctx, ROW0, ORG_COL, 'Tong cong');
    setText(ctx, ROW0, 0, '');
    for (const b of BINDINGS) {
      const t = total[b.code];
      if (!t) continue;
      put(ctx, ROW0, b.qty, t.q);
      put(ctx, ROW0, b.amt, t.a);
    }
    ctx.ui.message('Da do 1o: ' + codes.length + ' don vi + dong tong cong (theo ky dang chon).');
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-183'
FROM s
WHERE t.name = 'Tong hop theo ky' AND t.sheet_code = 'BM-000017'
  AND md5(replace(t.code, chr(13), '')) = '3598328564db52cf417891a34ee9160e';
--rollback SELECT 1;

--changeset dth:183-tonghop-1o-script splitStatements:false stripComments:false
--comment Tổng hợp năm, khối 1o: điền mức + số tháng theo năm vào dòng 9
WITH s AS (SELECT replace($js$// ============================================================================
//  SCRIPT TỔNG HỢP · BIỂU 1o (1o-snnmt-95xp)  —  hook afterInject  (THEO ĐƠN VỊ động · 1 KỲ NĂM)
//  Hỗ trợ tiền điện hộ nghèo + hộ chính sách. 95 xã phường báo cáo — MỖI ĐƠN VỊ 1 DÒNG (danh sách
//  phẳng). Clone dòng mẫu r9 cho từng đơn vị có dữ liệu.
//  3 chỉ tiêu SỐ HỘ = 3 cột: D=3 hộ nghèo · F=5 hộ CS (TCXH khác) · G=6 hộ CS (TCXH quy định).
//  CHỈ đổ số hộ (quantity). Tổng C(=D+E), E(=F+G), kinh phí M/N (=hộ×$H$9×$I$9 + hộ×$J$9×$K$9 — mức
//  điện + số tháng CỐ ĐỊNH ở dòng r9, mọi đơn vị chung) + tổng L là CÔNG THỨC → tự tính khi clone dịch.
//  Chỉ tiêu HO_CS.KINH_PHI KHÔNG đổ. Tổng cộng r8 = SUM(C9:C10) RANGE ĐỘNG (mẫu r9 + đệm r10, clone
//  tự mở). 1 kỳ cả năm. CONSUMER: mã ghép qua CK.
// ============================================================================

const SHEET = '1o-snnmt-95xp';
const CK = 'indi' + 'catorCode';

const COL = {                              // mã chỉ tiêu -> cột 0-based (số hộ)
  '1O.TIEN_DIEN.HO_NGHEO': 3,              // D
  '1O.TIEN_DIEN.HO_CS_TCXH_KHAC': 5,       // F
  '1O.TIEN_DIEN.HO_CS_TCXH_QUY_DINH': 6,   // G
};
const DATA_ROW = 9;                        // dòng mẫu (1-based) — điểm clone
const B = 1;

// ---- Mức hỗ trợ tiền điện theo NĂM của kỳ (changeset 183) ----
// Mức (triệu đồng/hộ/tháng) = 30 kWh × giá điện bậc 1 × (1 + VAT), theo ghi chú văn bản trong biểu:
//   QĐ 2699/QĐ-BTC (giá 1.893 đ) cho 4 tháng đầu 2025; QĐ 1279/QĐ-BTC (giá 1.984 đ) từ tháng 5/2025;
//   VAT 8% tới 31/12/2026 (NĐ 174/2025/NĐ-CP), 10% từ 2027. Mỗi năm tối đa hai mức: kinh phí = hộ × (H × I + J × K).
//   Giá điện đổi thì thêm một dòng vào BIEU_GIA ở CẢ BA kịch bản 1o (khoá ô, tổng hợp theo kỳ, tổng hợp năm).
const mucHoTro = (gia, vat) => Math.round(30 * gia * (1 + vat) * 10) / 1e7; // triệu đồng/hộ/tháng, 7 số lẻ
const BIEU_GIA = [
  { tuNam: 0, muc: [[mucHoTro(1893, 0.08), 4, '61.333'], [mucHoTro(1984, 0.08), 8, '64.282']] },
  { tuNam: 2026, muc: [[mucHoTro(1984, 0.08), 12, '64.282']] },
  { tuNam: 2027, muc: [[mucHoTro(1984, 0.10), 12, '65.472']] },
];
const GIA_ROW = 8;        // dòng chứa H (mức 1), I (số tháng 1), J (mức 2), K (số tháng 2) — 0-based
const GIA_HEADER_ROW = 4; // dòng tiêu đề "Mức hỗ trợ (… đồng)" — 0-based
function datBieuGia(ctx, nam) {
  let g = BIEU_GIA[0];
  for (const x of BIEU_GIA) if (nam >= x.tuNam) g = x;
  [[7, 8], [9, 10]].forEach(function (cot, k) {
    const m = g.muc[k];
    ctx.cell.set(SHEET, GIA_ROW, cot[0], m ? m[0] : 0);
    ctx.cell.set(SHEET, GIA_ROW, cot[1], m ? m[1] : 0);
    ctx.cell.set(SHEET, GIA_HEADER_ROW, cot[0],
      m ? 'Mức hỗ trợ (' + m[2] + ' đồng)' : 'Mức hỗ trợ (không áp dụng năm ' + nam + ')');
  });
}
function namCuaKy(ctx) {   // màn nhập và màn tổng hợp đặt sẵn ctx.shared.year = năm của kỳ
  const y = Number(ctx.shared && ctx.shared.year);
  return Number.isFinite(y) && y > 0 ? y : NaN;
}

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
    const b = (ctx.shared && ctx.shared.b != null) ? Number(ctx.shared.b) : (a + 1);
    const src = (ctx.shared && ctx.shared.sourceSheet) ? ('&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet)) : '';
    datBieuGia(ctx, a);   // mức + số tháng của năm a ở dòng 9 (mọi dòng đơn vị dùng $H$9…$K$9)
    async function apiGet(path) { try { return (await ctx.api.get(path)) || []; } catch (e) { ctx.ui.message('Lỗi 1o: ' + e.message); return []; } }

    const units = await apiGet('/rest/qt/master/organization-units');
    const nameOf = {}; for (const u of units) nameOf[u.code] = u.name || u.code;

    const byOrg = {};
    for (const r of await apiGet('/rest/qt/summary/data?from=' + a + '-01-01&to=' + a + '-12-31&groupByOrg=true' + src)) {
      const col = COL[r[CK]]; if (col == null) continue;
      const code = r.organizationCode || '';
      (byOrg[code] || (byOrg[code] = {}))[col] = num(r.quantity);
    }
    const orgs = Object.keys(byOrg);
    if (orgs.length === 0) { ctx.ui.message('1o: chưa có đơn vị nào nộp.'); return; }

    if (orgs.length > 1) ctx.rows.clone(SHEET, DATA_ROW - 1, orgs.length - 1);

    orgs.forEach((code, i) => {
      const r0 = DATA_ROW - 1 + i;
      setText(ctx, r0, B, nameOf[code] || code);
      const cols = byOrg[code];
      for (const c in cols) put(ctx, r0, Number(c), cols[c]);   // chỉ đổ số hộ
    });

    ctx.ui.message('Đã đổ 1o: ' + orgs.length + ' đơn vị. Kinh phí + tổng + tab 01 tự tính.');
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-183'
FROM s
WHERE t.name = '1o' AND t.sheet_code = 'BM-000009'
  AND md5(replace(t.code, chr(13), '')) = '8ec732fd4ab5e52d019da15c3e95a565';
--rollback SELECT 1;
