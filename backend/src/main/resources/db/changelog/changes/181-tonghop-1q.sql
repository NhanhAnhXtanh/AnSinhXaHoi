--liquibase formatted sql

-- Biểu Tổng hợp năm (BM-000009), tab 1q-sdttg-95xp (người có uy tín trong đồng bào DTTS) — đợt soát
-- script ngày 09/11/2026:
--   * thêm kịch bản "1q" (afterInject): trước đây tab không có khối nào đổ số nên tab 01 dòng 90 luôn
--     bằng 0. Phần A (dòng 12–18, cung cấp thông tin) đổ số đối tượng (O) và kinh phí (Q) theo sổ cái;
--     phần B (hỗ trợ vật chất) cộng theo khối: dòng 20 "Cơ quan tỉnh" (đơn vị TINH/SO), dòng 23 "Cơ quan
--     xã" (loại khác) — số đối tượng C, F, I, L; kinh phí E, H, K, N là công thức của tab.
--   * dòng 23 "Cơ quan xã" có I23, K23, O23, Q23 là =SUM(…24:…24) (cộng dòng 24, nằm ngoài tổng B dòng 19)
--     trong khi C23, F23, L23 là ô nhập: đổi cho giống dòng 20 — I23, O23 thành ô số liệu, K23 =I23*J23,
--     Q23 =O23*P23.
-- Bản đầy đủ: docs/form-template/scripts/script-summariez/1q-tonghop-afterinject.txt.
--
-- Chỉ đụng bản còn đúng bản đối soát (I23 còn =SUM(I24:I24)); chạy lại không đổi gì. stripComments:false
-- vì Liquibase mặc định xoá chú thích /* */ trong mã JS.

--changeset dth:181-tonghop-1q-dong-xa splitStatements:false
--comment Tổng hợp năm, tab 1q-sdttg-95xp: dòng 23 "Cơ quan xã" thành dòng số liệu như dòng 20
UPDATE asxh_template_versions v
SET workbook_json = ((jsonb_set(((jsonb_set(((v.workbook_json::jsonb
    #- '{sheets,1q-sdttg-95xp,data,dataTable,22,8,formula}')
    #- '{sheets,1q-sdttg-95xp,data,dataTable,22,8,value}'),
    '{sheets,1q-sdttg-95xp,data,dataTable,22,10,formula}', to_jsonb('I23*J23'::text))
    #- '{sheets,1q-sdttg-95xp,data,dataTable,22,14,formula}')
    #- '{sheets,1q-sdttg-95xp,data,dataTable,22,14,value}'),
    '{sheets,1q-sdttg-95xp,data,dataTable,22,16,formula}', to_jsonb('O23*P23'::text))
    #- '{sheets,1q-sdttg-95xp,sharedFormulas,5}'))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,1q-sdttg-95xp,sharedFormulas,5,formula}' = 'SUM(I24:I24)'
  AND v.workbook_json::jsonb #>> '{sheets,1q-sdttg-95xp,data,dataTable,22,1,value}' IS NOT NULL;
--rollback SELECT 1;

--changeset dth:181-tonghop-1q-script splitStatements:false stripComments:false
--comment Tổng hợp năm: thêm kịch bản "1q" đổ số vào tab 1q-sdttg-95xp
WITH s AS (SELECT replace($js$// ============================================================================
//  SCRIPT TỔNG HỢP · BIỂU 1q (1q-sdttg-95xp)  —  hook afterInject  (CẢ NĂM DƯƠNG LỊCH)
//  Chính sách đối với người có uy tín trong đồng bào DTTS. Số cả năm from=Y-01-01 to=Y-12-31.
//  A. Chế độ cung cấp thông tin (dòng 12–18, mỗi dòng một báo / hoạt động, cộng mọi đơn vị):
//       O = số đối tượng, Q = kinh phí (theo sổ cái). P (mức) của tab giữ nguyên.
//  B. Hỗ trợ vật chất, động viên tinh thần — cộng theo KHỐI:
//       dòng 20 "Cơ quan tỉnh" = đơn vị loại TINH / SO; dòng 23 "Cơ quan xã" = mọi loại khác.
//       Số đối tượng: C (Tết), F (ốm đau), I (gia đình khó khăn), L (qua đời). Kinh phí E, H, K, N là
//       công thức của tab (số đối tượng × mức của tab) — script KHÔNG ghi đè.
//  Dòng tổng 10, 11, 19 và tab 01 dòng 90 tự tính.
// ============================================================================

const SHEET = '1q-sdttg-95xp';
const CK = 'indi' + 'catorCode';
// A: mã → dòng Excel (1-based); O = số đối tượng, Q = kinh phí.
const TT_ROW = {
  '1Q.TT.BAO_DAN_TOC': 12,
  '1Q.TT.BAO_DONG_NAI': 13,
  '1Q.TT.BAO_BINH_PHUOC': 14,
  '1Q.TT.BAN_TIN_DTTS': 15,
  '1Q.TT.HOP_MAT': 16,
  '1Q.TT.TAP_HUAN': 17,
  '1Q.TT.HOC_TAP': 18,
};
const O_COL = 14, Q_COL = 16;
// B: mã → cột số đối tượng (0-based).
const VC_COL = {
  '1Q.TET.SO_DOI_TUONG': 2,       // C
  '1Q.OM_DAU.SO_DOI_TUONG': 5,    // F
  '1Q.KHO_KHAN.SO_DOI_TUONG': 8,  // I
  '1Q.QUA_DOI.SO_DOI_TUONG': 11,  // L
};
const ROW_TINH = 20, ROW_XA = 23;
const KHOI_TINH = ['TINH', 'SO'];

function num(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function put(ctx, r, c, v) {
  if (v == null) return;
  try { const f = ctx.cell.getFormula(SHEET, r, c); if (f && String(f).trim() !== '') return; ctx.cell.set(SHEET, r, c, v); }
  catch (e) { /* bỏ qua */ }
}
function add(map, key, q, kp) {
  const cur = map[key] || (map[key] = { q: null, kp: null });
  if (q != null) cur.q = (cur.q || 0) + q;
  if (kp != null) cur.kp = (cur.kp || 0) + kp;
}

return defineScript({
  async afterInject(ctx) {
    const a = (ctx.shared && ctx.shared.a != null) ? Number(ctx.shared.a)
      : ((ctx.shared && ctx.shared.year) ? Number(ctx.shared.year) : 2025);
    const scope = (ctx.shared && ctx.shared.scopeKind) ? ('&scopeKind=' + ctx.shared.scopeKind) : '';
    const src = (ctx.shared && ctx.shared.sourceSheet) ? ('&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet)) : '';
    async function apiGet(path) { try { return (await ctx.api.get(path)) || []; } catch (e) { ctx.ui.message('Lỗi 1q: ' + e.message); return []; } }

    const rows = await apiGet('/rest/qt/summary/data?from=' + a + '-01-01&to=' + a + '-12-31&groupByOrg=true' + scope + src);

    // Loại đơn vị (TINH/SO → khối tỉnh): đơn vị được giao biểu 1q trong năm, thiếu thì tra danh mục.
    const typeOf = {};
    for (const u of await apiGet('/rest/qt/summary/period-organizations?from=' + a + '-01-01&to=' + a
      + '-12-31&reportType=1q')) if (u && u.code) typeOf[u.code] = u.orgType || '';
    const missing = rows.some((r) => VC_COL[r[CK]] != null && r.organizationCode
      && r.organizationCode !== 'TONG_HOP' && typeOf[r.organizationCode] == null);
    if (missing) {
      for (const u of await apiGet('/rest/qt/master/organization-units')) {
        if (u && u.code && typeOf[u.code] == null) typeOf[u.code] = u.orgType || '';
      }
    }

    const tt = {}, tinh = {}, xa = {};
    for (const r of rows) {
      const code = r[CK];
      const q = num(r.quantity), kp = num(r.amount);
      if (q == null && kp == null) continue;
      if (TT_ROW[code] != null) { add(tt, code, q, kp); continue; }
      if (VC_COL[code] == null) continue;
      // TONG_HOP (Sở điều chỉnh chung) tính vào khối tỉnh.
      const isTinh = r.organizationCode === 'TONG_HOP' || KHOI_TINH.indexOf(typeOf[r.organizationCode]) >= 0;
      add(isTinh ? tinh : xa, code, q, kp);
    }

    let filled = 0;
    for (const code in tt) {
      put(ctx, TT_ROW[code] - 1, O_COL, tt[code].q);
      put(ctx, TT_ROW[code] - 1, Q_COL, tt[code].kp);
      filled += 1;
    }
    for (const [row, m] of [[ROW_TINH, tinh], [ROW_XA, xa]]) {
      for (const code in m) { put(ctx, row - 1, VC_COL[code], m[code].q); filled += 1; }
    }
    ctx.ui.message('Đã đổ ' + filled + ' ô vào 1q (năm ' + a + '). Kinh phí hỗ trợ vật chất, các dòng tổng và tab 01 tự tính.');
  },
});$js$, chr(13), '') AS code)
INSERT INTO asxh_template_scripts (template_version_id, sheet_code, name, description, code, declared_hooks,
                                   display_order, enabled, script_hash, created_at, created_by)
SELECT v.id, tp.code, '1q', NULL, s.code, 'afterInject', 17, TRUE,
       encode(sha256(convert_to(s.code, 'UTF8')), 'hex'), now(), 'liquibase-181'
FROM asxh_template_versions v
JOIN asxh_templates tp ON tp.id = v.template_id
CROSS JOIN s
WHERE tp.code = 'BM-000009'
  AND EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1k')
  AND NOT EXISTS (SELECT 1 FROM asxh_template_scripts e WHERE e.template_version_id = v.id AND e.name = '1q');
--rollback SELECT 1;
