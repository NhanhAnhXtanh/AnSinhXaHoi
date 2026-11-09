--liquibase formatted sql

-- Sửa ba biểu mẫu theo đợt soát script ↔ file Excel gốc (docs/form-template/form-org) ngày 09/11/2026:
--   * 1m (biểu nhập): dòng 61 "3.3 Hỗ trợ hộ gia đình, cá nhân khi nhận nuôi dưỡng…" và dòng 66 "III. TRỢ CẤP
--     HÀNG THÁNG ĐỐI VỚI CÁC ĐỐI TƯỢNG ĐƯỢC NUÔI DƯỠNG…" để trống cột F (đối tượng), G (kinh phí) — lỗi có sẵn
--     từ file gốc — trong khi dòng 3 (F52) và dòng A (F9) lại cộng chính hai ô trống đó, nên TỔNG SỐ thiếu
--     dòng 62–65 và 67–80. Thêm F61 =SUM(F62:F65), F66 =F67+F74+F75+F78 (và cột G tương tự).
--   * 1q: nhãn B10, B11 của biểu nhập và B12–B14 của tab 1q-sdttg-95xp (biểu Tổng hợp năm) bị cụt còn "Báo";
--     trả lại tên như file gốc: Báo Dân tộc và phát triển, Báo Đồng Nai, Báo Bình Phước.
--   * 1k (tab 1k-sgd-xp của biểu Tổng hợp năm): cột Q, R "Hỗ trợ tuyển dụng một lần" có sẵn (tab 01 dòng 53
--     lấy Q10, R10) nhưng script tổng hợp 1k bỏ qua với lý do "không có cột", và công thức tổng của Q/R/S lệch
--     các cột khác (Q10 cộng dòng 13 thay vì 14; Q11 chỉ cộng một ô Q12 nên không giãn khi nhân dòng Sở; Q14
--     trống; S12 là số 0). Sửa công thức cho giống cột C–P và cho script đổ 1K.TUYEN_DUNG.* vào Q, R
--     (cộng Kỳ II + Kỳ I).
-- Bản đầy đủ của script 1k: docs/form-template/scripts/script-summariez/1k-tonghop-afterinject.txt (cùng nội
-- dung, bỏ các dòng ghi chú đầu file).
--
-- Mỗi lệnh chỉ đụng phiên bản còn đúng bản đối soát (điều kiện theo ô / md5 bản cũ): chạy lại không đổi gì,
-- CSDL không có các biểu này (CSDL thử dth-framework) thì không đổi dòng nào. Phiếu đã nhập giữ bản sao biểu
-- riêng (asxh_input_report_sheets.data_json) nên KHÔNG đổi theo; phiếu chưa nhập lấy biểu mới.

--changeset dth:178-1m-tong-nhom splitStatements:false
--comment Biểu 1m: thêm công thức tổng cho dòng 3.3 (F61, G61) và dòng III (F66, G66)
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(v.workbook_json::jsonb,
    '{sheets,1m,data,dataTable,60,5,formula}', to_jsonb('SUM(F62:F65)'::text)),
    '{sheets,1m,data,dataTable,60,5,value}', '0'::jsonb),
    '{sheets,1m,data,dataTable,60,6,formula}', to_jsonb('SUM(G62:G65)'::text)),
    '{sheets,1m,data,dataTable,60,6,value}', '0'::jsonb),
    '{sheets,1m,data,dataTable,65,5,formula}', to_jsonb('F67+F74+F75+F78'::text)),
    '{sheets,1m,data,dataTable,65,5,value}', '0'::jsonb),
    '{sheets,1m,data,dataTable,65,6,formula}', to_jsonb('G67+G74+G75+G78'::text)),
    '{sheets,1m,data,dataTable,65,6,value}', '0'::jsonb))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000015')
  AND v.workbook_json::jsonb #>> '{sheets,1m,data,dataTable,60,5,formula}' IS NULL
  AND v.workbook_json::jsonb #>> '{sheets,1m,data,dataTable,65,5,formula}' IS NULL
  AND v.workbook_json::jsonb #>> '{sheets,1m,data,dataTable,60,0,value}' = '3.3'
  AND v.workbook_json::jsonb #>> '{sheets,1m,data,dataTable,65,0,value}' = 'III'
  AND v.workbook_json::jsonb #>> '{sheets,1m,sharedFormulas,12,formula}' = 'F53+F56+F61'
  AND v.workbook_json::jsonb #>> '{sheets,1m,sharedFormulas,1,formula}' = 'F10+F44+F66';
--rollback SELECT 1;

--changeset dth:178-1q-nhan-bao splitStatements:false
--comment Biểu 1q: trả lại tên đầy đủ hai dòng báo (B10, B11)
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(v.workbook_json::jsonb,
    '{sheets,1q,data,dataTable,9,1,value}', to_jsonb('Báo Đồng Nai'::text)),
    '{sheets,1q,data,dataTable,10,1,value}', to_jsonb('Báo Bình Phước'::text)))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000019')
  AND v.workbook_json::jsonb #>> '{sheets,1q,data,dataTable,8,1,value}' = 'Báo Dân tộc và phát triển'
  AND v.workbook_json::jsonb #>> '{sheets,1q,data,dataTable,9,1,value}' = 'Báo'
  AND v.workbook_json::jsonb #>> '{sheets,1q,data,dataTable,10,1,value}' = 'Báo';
--rollback SELECT 1;

--changeset dth:178-tonghop-1q-nhan-bao splitStatements:false
--comment Tổng hợp năm, tab 1q-sdttg-95xp: trả lại tên đầy đủ ba dòng báo (B12–B14)
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(jsonb_set(v.workbook_json::jsonb,
    '{sheets,1q-sdttg-95xp,data,dataTable,11,1,value}', to_jsonb('Báo Dân tộc và phát triển'::text)),
    '{sheets,1q-sdttg-95xp,data,dataTable,12,1,value}', to_jsonb('Báo Đồng Nai'::text)),
    '{sheets,1q-sdttg-95xp,data,dataTable,13,1,value}', to_jsonb('Báo Bình Phước'::text)))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,1q-sdttg-95xp,data,dataTable,11,1,value}' = 'Báo'
  AND v.workbook_json::jsonb #>> '{sheets,1q-sdttg-95xp,data,dataTable,12,1,value}' = 'Báo'
  AND v.workbook_json::jsonb #>> '{sheets,1q-sdttg-95xp,data,dataTable,13,1,value}' = 'Báo';
--rollback SELECT 1;

--changeset dth:178-tonghop-1k-cong-thuc splitStatements:false
--comment Tổng hợp năm, tab 1k-sgd-xp: công thức tổng cột Q, R, S (tuyển dụng một lần) giống cột C–P
UPDATE asxh_template_versions v
SET workbook_json = (jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set((((((((((jsonb_set(jsonb_set(v.workbook_json::jsonb,
    '{sheets,1k-sgd-xp,sharedFormulas,1,formula}', to_jsonb('SUM(Q11,Q14)'::text)),
    '{sheets,1k-sgd-xp,sharedFormulas,3,formula}', to_jsonb('SUM(Q12:Q13)'::text))
    #- '{sheets,1k-sgd-xp,sharedFormulas,5}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,16,formula}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,16,value}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,17,formula}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,17,value}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,18,formula}')
    #- '{sheets,1k-sgd-xp,data,dataTable,12,18,value}')
    #- '{sheets,1k-sgd-xp,data,dataTable,11,16,value}')
    #- '{sheets,1k-sgd-xp,data,dataTable,11,17,value}'),
    '{sheets,1k-sgd-xp,data,dataTable,11,18,formula}', to_jsonb('F12+M12+R12'::text)),
    '{sheets,1k-sgd-xp,data,dataTable,13,16,formula}', to_jsonb('SUM(Q15:Q16)'::text)),
    '{sheets,1k-sgd-xp,data,dataTable,13,16,value}', '0'::jsonb),
    '{sheets,1k-sgd-xp,data,dataTable,13,17,formula}', to_jsonb('SUM(R15:R16)'::text)),
    '{sheets,1k-sgd-xp,data,dataTable,13,17,value}', '0'::jsonb))::text,
    updated_at = now()
WHERE v.template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000009')
  AND v.workbook_json::jsonb #>> '{sheets,1k-sgd-xp,sharedFormulas,1,formula}' = 'SUM(Q11+Q13)'
  AND v.workbook_json::jsonb #>> '{sheets,1k-sgd-xp,sharedFormulas,3,formula}' = 'SUM(Q12)'
  AND v.workbook_json::jsonb #>> '{sheets,1k-sgd-xp,sharedFormulas,5,formula}' = 'SUM(Q15)';
--rollback SELECT 1;

--changeset dth:178-tonghop-1k-script splitStatements:false stripComments:false
--comment Script tổng hợp 1k: đổ tuyển dụng một lần (1K.TUYEN_DUNG.*) vào cột Q, R
WITH s AS (SELECT replace($js$// ============================================================================
//  SCRIPT TỔNG HỢP · BIỂU 1k (1k-sgd-xp)  —  hook afterInject  (NHÓM B: khối tỉnh/xã · 2 KỲ · 3 chỉ tiêu)
//  Phổ cập giáo dục mầm non 3–5 tuổi. 3 chỉ tiêu (mỗi cái có Số đối tượng + Kinh phí):
//    PHO_CAP (1K.PHO_CAP.DOI_TUONG) · AN_TRUA (1K.AN_TRUA.DOI_TUONG) · CP (1K.CP_HOC_TAP.DOI_TUONG).
//  TUYEN_DUNG (1K.TUYEN_DUNG.DOI_TUONG / .KINH_PHI) → cột Q (đối tượng) + R (kinh phí): một nhóm cột
//  cho cả năm, CỘNG Kỳ II + Kỳ I (tuyển dụng một lần — người tuyển mỗi kỳ là người khác). Cột S
//  (tổng kinh phí = F + M + R) và tiểu tổng Q/R/S giữ công thức template.
//  ‼ CỬA SỔ NỬA-NĂM-TRỌN + a/b: Khối "Kỳ II" (cột C–I) ← HK2 = năm b (T1–6) ; Khối "Kỳ I" (cột J–P)
//    ← HK1 = năm a (T7–12). a = ctx.shared.a (HK1 nửa cuối) ; b = ctx.shared.b (HK2 nửa đầu).
//  ĐỔ per đơn vị: 3 Số ĐT (qty) + 3 Kinh phí thành phần (amount) MỖI kỳ. Cột KP tổng F/M (=SUM 3 thành
//  phần) + tiểu tổng khối r11/r14 (SUM range động) + tổng r10 GIỮ CÔNG THỨC template — script KHÔNG đụng.
//  2 khối: type==TINH|SO (tỉnh lên đầu) → Khối tỉnh (mẫu r12) ; MỌI type khác → Khối xã (mẫu r15). Mỗi đơn vị 1 dòng (clone).
//  ĐƠN VỊ: chỉ đơn vị ĐƯỢC GIAO biểu 1k trong năm (kể cả chưa nộp) — /summary/period-organizations?reportType=1k.
// ============================================================================

const SHEET = '1k-sgd-xp';
const CK = 'indi' + 'catorCode';
const MA = {
  PHO_CAP: '1K.PHO_CAP.DOI_TUONG',
  AN_TRUA: '1K.AN_TRUA.DOI_TUONG',
  CP: '1K.CP_HOC_TAP.DOI_TUONG',
};
// Tuyển dụng một lần: một nhóm cột cho cả năm (không chia kỳ) — Q = số đối tượng, R = kinh phí.
const TD = { Q: '1K.TUYEN_DUNG.DOI_TUONG', R: '1K.TUYEN_DUNG.KINH_PHI' };
const TD_Q_COL = 16, TD_R_COL = 17;
// Cột 0-based. Kỳ II (HK2 năm b): qty C/D/E, amt G/H/I (F=KP tổng công thức).
const II = { q: { PHO_CAP: 2, AN_TRUA: 3, CP: 4 }, a: { PHO_CAP: 6, AN_TRUA: 7, CP: 8 } };
// Kỳ I (HK1 năm a): qty J/K/L, amt N/O/P (M=KP tổng công thức).
const I = { q: { PHO_CAP: 9, AN_TRUA: 10, CP: 11 }, a: { PHO_CAP: 13, AN_TRUA: 14, CP: 15 } };
const B = 1;
// Dòng 0-based: r10 tổng=9 ; r11 khối tỉnh=10 ; r12 Sở mẫu=11 (đệm r13) ; r14 khối xã=13 ; r15 xã mẫu=14 (đệm r16).
const SO_ROW = 11, XA_TOT = 13, XA_ROW = 14;

function num(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function put(ctx, r, c, v) {
  if (v == null) return;
  try { const f = ctx.cell.getFormula(SHEET, r, c); if (f && String(f).trim() !== '') return; ctx.cell.set(SHEET, r, c, v); }
  catch (e) { /* bỏ qua */ }
}
function setText(ctx, r, c, v) { if (v == null || v === '') return; try { ctx.cell.set(SHEET, r, c, v); } catch (e) { /* bỏ qua */ } }

// Đơn vị của tab = đơn vị ĐƯỢC GIAO biểu (theo mã), rồi tới đơn vị có số mà không nằm trong danh sách
// giao (dữ liệu cũ) — tên/loại của nhóm sau tra danh mục. KHÔNG lấy cả danh mục đơn vị làm dòng.
async function unitsOf(apiGet, assigned, maps) {
  const units = [], seen = {}, extra = [];
  for (const u of assigned) if (u && u.code && !seen[u.code]) { seen[u.code] = true; units.push(u); }
  for (const m of maps) for (const code in m) {
    if (code && code !== 'TONG_HOP' && !seen[code]) { seen[code] = true; extra.push(code); }
  }
  if (extra.length === 0) return units;
  const byCode = {}; for (const u of await apiGet('/rest/qt/master/organization-units')) byCode[u.code] = u;
  for (const code of extra.sort()) units.push(byCode[code] || { code: code, name: code, orgType: '' });
  return units;
}

return defineScript({
  async afterInject(ctx) {
    const a = (ctx.shared && ctx.shared.a != null) ? Number(ctx.shared.a)
      : ((ctx.shared && ctx.shared.year) ? Number(ctx.shared.year) : 2025);
    const b = (ctx.shared && ctx.shared.b != null) ? Number(ctx.shared.b) : (a + 1);
    const src = (ctx.shared && ctx.shared.sourceSheet) ? ('&sourceSheetCode=' + encodeURIComponent(ctx.shared.sourceSheet)) : '';
    async function apiGet(path) { try { return (await ctx.api.get(path)) || []; } catch (e) { ctx.ui.message('Lỗi 1k: ' + e.message); return []; } }

    // Đơn vị ĐƯỢC GIAO biểu 1k trong năm (kể cả chưa nộp) — KHÔNG lấy cả danh mục đơn vị: đơn vị
    // không được giao biểu 1k thì không có dòng.
    const assigned = await apiGet('/rest/qt/summary/period-organizations?from=' + a + '-01-01&to=' + a
      + '-12-31&reportType=1k');

    // Gom per đơn vị: byOrg[code][MÃ] = {q, a} (groupByOrg). MeasureKind tự giải quantity; amount = KP.
    async function periodByOrg(from, to) {
      const codeByMa = {}; for (const k in MA) codeByMa[MA[k]] = k;
      for (const k in TD) codeByMa[TD[k]] = 'TD_' + k;
      const m = {};
      for (const r of await apiGet('/rest/qt/summary/data?from=' + from + '&to=' + to + '&groupByOrg=true' + src)) {
        const key = codeByMa[r[CK]]; if (!key) continue;
        const code = r.organizationCode || '';
        const e = m[code] || (m[code] = {});
        const cur = e[key] || (e[key] = { q: 0, a: 0 });
        cur.q += (num(r.quantity) || 0); cur.a += (num(r.amount) || 0);
      }
      return m;
    }
    // NỬA-NĂM-TRỌN: Kỳ II (HK2) = T1–6 năm b → khối cột C–I ; Kỳ I (HK1) = T7–12 năm a → khối cột J–P.
    const hk2 = await periodByOrg(a + '-01-01', a + '-06-30'); // Kỳ II → C–I
    const hk1 = await periodByOrg(a + '-07-01', a + '-12-31'); // Kỳ I  → J–P

    const units = await unitsOf(apiGet, assigned, [hk2, hk1]);
    const nameOf = {}; for (const u of units) nameOf[u.code] = u.name || u.code;
    // Khối tỉnh = TỈNH + SỞ (tỉnh lên đầu, rồi đến sở theo mã); MỌI loại khác → Khối xã/phường.
    const KHOI_TINH = ['TINH', 'SO'];
    const so = units.filter((u) => KHOI_TINH.includes(u.orgType))
      .sort((x, y) => KHOI_TINH.indexOf(x.orgType) - KHOI_TINH.indexOf(y.orgType));
    const xa = units.filter((u) => !KHOI_TINH.includes(u.orgType));

    // Clone Khối tỉnh trước (đẩy khối xã xuống), rồi Khối xã.
    const shift = so.length > 1 ? so.length - 1 : 0;
    if (so.length > 1) ctx.rows.clone(SHEET, SO_ROW, so.length - 1);
    const xaRow = XA_ROW + shift;
    if (xa.length > 1) ctx.rows.clone(SHEET, xaRow, xa.length - 1);

    // Đổ 1 đơn vị: 3 Số ĐT + 3 KP thành phần mỗi kỳ; KP tổng F/M công thức tự tính; tuyển dụng → Q, R.
    function writeUnit(r0, u) {
      setText(ctx, r0, B, nameOf[u.code] || u.code);
      const e2 = hk2[u.code], e1 = hk1[u.code];
      for (const k in MA) {
        if (e2 && e2[k]) { put(ctx, r0, II.q[k], e2[k].q); put(ctx, r0, II.a[k], e2[k].a); }
        if (e1 && e1[k]) { put(ctx, r0, I.q[k], e1[k].q); put(ctx, r0, I.a[k], e1[k].a); }
      }
      // Tuyển dụng một lần: CỘNG Kỳ II + Kỳ I vào cột Q (đối tượng), R (kinh phí).
      const q2 = e2 && e2.TD_Q, q1 = e1 && e1.TD_Q, a2 = e2 && e2.TD_R, a1 = e1 && e1.TD_R;
      if (q2 || q1) put(ctx, r0, TD_Q_COL, (q2 ? q2.q : 0) + (q1 ? q1.q : 0));
      if (a2 || a1) put(ctx, r0, TD_R_COL, (a2 ? a2.a : 0) + (a1 ? a1.a : 0));
    }
    for (let i = 0; i < so.length; i += 1) writeUnit(SO_ROW + i, so[i]);
    for (let j = 0; j < xa.length; j += 1) writeUnit(xaRow + j, xa[j]);

    // KP tổng F/M + tiểu tổng r11/r14 + tổng r10: GIỮ CÔNG THỨC template (SUM range động) — script KHÔNG ghi.
    ctx.ui.message('Đã đổ 1k: ' + so.length + ' Sở + ' + xa.length + ' đơn vị khối xã. KP tổng + tiểu tổng tự tính (công thức).');
  },
});$js$, chr(13), '') AS code)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-178'
FROM s
WHERE t.name = '1k'
  AND md5(replace(t.code, chr(13), '')) = '018b42cc8b1ece57d83453fa6ef2da73';
--rollback SELECT 1;
