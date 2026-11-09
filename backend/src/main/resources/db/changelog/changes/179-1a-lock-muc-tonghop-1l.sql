--liquibase formatted sql

-- Đợt soát script ↔ file Excel gốc ngày 09/11/2026 (tiếp changeset 178):
--   * 1a, kịch bản "Lock cell": đơn vị không còn sửa được mức tính toán C33:C37 — kinh phí cột D luôn
--     tính theo mức của biểu mẫu Sở giao rồi vào sổ cái khi duyệt (như các biểu 1b–1s); ô ghi chú cột E
--     chỉ mở ở 15 dòng lá (trước mở cả dòng nhóm E8, E9, E11, E12, E22, E23, E27 mà không lưu).
--   * Biểu Tổng hợp năm (BM-000009), tab 1l-bhxh-syt-snn-sgd-sdt: thêm kịch bản "1l" (afterInject) —
--     trước đây tab không có khối nào đổ số nên tab 01 dòng 55–59, 62–76 luôn bằng 0.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/1a-scripts/1-khoa-o-nhap-lieu.txt và
-- docs/form-template/scripts/script-summariez/1l-tonghop-afterinject.txt (cùng nội dung, bỏ dòng ghi chú
-- đầu file).
--
-- 1a chỉ ghi đè dòng còn đúng bản cũ (md5 e0f3e94d86957b826c982bcaf1bfc009); "1l" chỉ thêm vào phiên bản chưa có
-- kịch bản tên "1l". stripComments:false vì Liquibase mặc định xoá chú thích /* */ trong mã JS.
-- CSDL không có các biểu này (CSDL thử dth-framework) thì không đổi dòng nào.

--changeset dth:179-1a-khoa-muc splitStatements:false stripComments:false
--comment Biểu 1a: khoá mức C33:C37 theo biểu mẫu; ghi chú cột E chỉ ở dòng lá
WITH s AS (SELECT replace($js$// ==== 1a · Script 1/3: KHÓA/MỞ Ô NHẬP LIỆU ====
// displayOrder = 1, enabled = true, gắn biểu reportType = "1a".
// Nguồn cấu trúc: form-template/1a_DATA.xlsx (sheet '1a', dims A1:I49). Tọa độ 0-based.
//
// FORM CHUẨN MỚI: cột D (Kinh phí) là Ô CÔNG THỨC =ROUND(SoDoiTuong × mức, 0) — KHÔNG
// mở khoá. Đơn vị chỉ nhập cột C (Số đối tượng) + ghi chú (E) ở các DÒNG LÁ.
// Mức tính toán C33:C37 theo biểu mẫu Sở giao → KHOÁ: kinh phí cột D luôn tính theo mức của biểu
// rồi vào sổ cái khi duyệt (đơn vị không sửa mức, giống các biểu 1b–1s).
//
// Import workbook thường mở khoá hết ô → khoá TẤT CẢ rồi mở lại đúng ô nhập (như 1g).

const SHEET = '1a';

// Cột C (Số đối tượng) — chỉ các DÒNG LÁ (0-based). Các dòng tiểu tổng C8,C9,C11,C12,
// C22,C23,C27 là công thức → giữ khoá.
const C_LEAF_ROWS = [9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 27, 28];
// Ghi chú cột E: chỉ ở dòng lá (cùng dòng với C_LEAF_ROWS) — ghi chú dòng nhóm không vào sổ cái.

function isEditable(row, col) {
  if (row === 0 && (col === 0 || col === 1)) return true;       // A1:B1 đơn vị (ô gộp)
  if (row === 2 && col === 1) return true;                      // B3 tháng/năm
  if (col === 2 && C_LEAF_ROWS.indexOf(row) >= 0) return true;  // C: số đối tượng (dòng lá)
  return col === 4 && C_LEAF_ROWS.indexOf(row) >= 0;            // E: ghi chú (dòng lá)
}

function unlockEditableCells(ctx) {
  ctx.cell.lock(SHEET, 0, 0, false);
  ctx.cell.lock(SHEET, 0, 1, false);
  ctx.cell.lock(SHEET, 2, 1, false);
  C_LEAF_ROWS.forEach((row) => {
    ctx.cell.lock(SHEET, row, 2, false);
    ctx.cell.lock(SHEET, row, 4, false);
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
    if (ctx.mode && ctx.mode !== 'input') return; // chỉ khoá ở màn NHẬP
    ctx.cell.lockAll(SHEET, true);
    unlockEditableCells(ctx);
    // Tên đơn vị của phiếu (app đưa vào ctx.shared.orgName): ghi vào dòng ĐƠN VỊ đầu biểu (A1),
    // giống các biểu 1g–1s. (Cột B của biểu này là chỉ tiêu nên không điền.)
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
    updated_by = 'liquibase-179'
FROM s
WHERE t.name = 'Lock cell'
  AND md5(replace(t.code, chr(13), '')) = 'e0f3e94d86957b826c982bcaf1bfc009';
--rollback SELECT 1;

--changeset dth:179-tonghop-1l-script splitStatements:false stripComments:false
--comment Tổng hợp năm: thêm kịch bản "1l" đổ số vào tab 1l-bhxh-syt-snn-sgd-sdt
WITH s AS (SELECT replace($js$// ============================================================================
//  SCRIPT TỔNG HỢP · BIỂU 1l (1l-bhxh-syt-snn-sgd-sdt)  —  hook afterInject  (CỘNG GỘP · CẢ NĂM)
//  NSNN đóng và hỗ trợ mức đóng BHYT. Tab có MỘT cặp cột cho cả năm: C = số đối tượng, D = kinh phí.
//  ĐỔ: from=Y-01-01 to=Y-12-31 (năm dương lịch), cộng mọi đơn vị (không groupByOrg). Máy chủ tự gộp
//  số đối tượng qua các kỳ theo bản chất chỉ tiêu (MeasureKind); kinh phí cộng dồn.
//  Mã chỉ tiêu → dòng Excel (1-based) của tab. Dòng nhóm (11, 13, 28, 29) và tổng (10) giữ công thức.
//  - 1L.NGUOI_CO_CONG và 1L.CUU_CHIEN_BINH_TNXP cùng vào dòng 16 "Người có công với cách mạng,
//    cựu chiến binh" (tab chỉ có một dòng cho hai mã này) → CỘNG.
//  - 1L.DAN_QUAN (Dân quân thường trực) chưa có dòng trong tab → không đổ, báo số đơn vị bị bỏ.
//  - Dòng 21, 23, 26, 27 của tab không có mã ở biểu nhập 1l → để trống.
//  - Ô có công thức (vd. D37 kinh phí y tế thôn bản) giữ công thức, không ghi đè.
// ============================================================================

const SHEET = '1l-bhxh-syt-snn-sgd-sdt';
const CK = 'indi' + 'catorCode';
const Q_COL = 2;   // C: số đối tượng
const KP_COL = 3;  // D: kinh phí

const ROW = {
  '1L.HO_NGHEO_DTTS': 12,
  '1L.TRE_EM_6T.MENH_GIA': 14,
  '1L.TRE_EM_6T.TRUY_LINH': 15,
  '1L.NGUOI_CO_CONG': 16,
  '1L.CUU_CHIEN_BINH_TNXP': 16,
  '1L.BTXH': 17,
  '1L.HIEN_TANG': 18,
  '1L.NGUOI_75_TUOI': 19,
  '1L.XA_ATK': 20,
  '1L.HUU_TRI_XH': 22,
  '1L.DAI_BIEU_QH_HDND': 24,
  '1L.CAN_BO_XA_NGHI': 25,
  '1L.CAN_NGHEO_100': 30,
  '1L.CAN_NGHEO_70': 31,
  '1L.HSSV_50': 32,
  '1L.HO_NONG_LAM_NGU': 33,
  '1L.DTTS_DIA_BAN': 34,
  '1L.DTTS_XA': 35,
  '1L.LUC_LUONG_ANTT': 36,
  '1L.Y_TE_THON_BAN': 37,
  '1L.KHONG_CHUYEN_TRACH': 38,
  '1L.NAN_NHAN': 39,
  '1L.NQ_RIENG': 40,
};
const NO_ROW = { '1L.DAN_QUAN': 'Dân quân thường trực' };

function num(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function put(ctx, r, c, v) {
  if (v == null) return;
  try { const f = ctx.cell.getFormula(SHEET, r, c); if (f && String(f).trim() !== '') return; ctx.cell.set(SHEET, r, c, v); }
  catch (e) { /* bỏ qua */ }
}

return defineScript({
  async afterInject(ctx) {
    const a = (ctx.shared && ctx.shared.a != null) ? Number(ctx.shared.a)
      : ((ctx.shared && ctx.shared.year) ? Number(ctx.shared.year) : 2025);
    const scope = (ctx.shared && ctx.shared.scopeKind) ? ('&scopeKind=' + ctx.shared.scopeKind) : '';
    const src = (ctx.shared && ctx.shared.sourceSheet) ? ('&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet)) : '';
    const path = '/rest/qt/summary/data?from=' + a + '-01-01&to=' + a + '-12-31' + scope + src;
    let rows;
    try { rows = await ctx.api.get(path); }
    catch (e) { ctx.ui.message('Lỗi lấy số 1l năm ' + a + ': ' + e.message); return; }

    // Gom theo DÒNG (hai mã cùng một dòng thì cộng).
    const byRow = {};
    const skipped = {};
    for (const r of (rows || [])) {
      const code = r[CK];
      const row = ROW[code];
      if (row == null) {
        if (NO_ROW[code] && (num(r.quantity) || num(r.amount))) skipped[code] = true;
        continue;
      }
      const q = num(r.quantity), kp = num(r.amount);
      const cur = byRow[row] || (byRow[row] = { q: null, kp: null });
      if (q != null) cur.q = (cur.q || 0) + q;
      if (kp != null) cur.kp = (cur.kp || 0) + kp;
    }
    let filled = 0;
    for (const row in byRow) {
      put(ctx, Number(row) - 1, Q_COL, byRow[row].q);
      put(ctx, Number(row) - 1, KP_COL, byRow[row].kp);
      filled += 1;
    }
    const miss = Object.keys(skipped).map((c) => NO_ROW[c]);
    ctx.ui.message('Đã đổ ' + filled + ' dòng vào 1l (năm ' + a + '). Cột tổng + tab 01 tự tính.'
      + (miss.length ? ' Chưa có dòng trong tab cho: ' + miss.join(', ') + '.' : ''));
  },
});$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT v.id, tp.code, '1l', NULL, s.code, 'afterInject', 15, TRUE,
       encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-179'
FROM asxh_template_versions v
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE tp.code = 'BM-000009'
  AND EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1k')
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1l');
--rollback SELECT 1;
