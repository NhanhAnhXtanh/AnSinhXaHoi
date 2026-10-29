--liquibase formatted sql

-- Biểu tổng hợp TH của bộ mẫu seed: 114 chỉ đặt script rỗng "return defineScript({})" nên màn Tổng hợp
-- theo năm hiện bảng trắng. Thay bằng script đổ số theo KHỐI, theo đúng cách các biểu tổng hợp năm của
-- bản Jmix (01-TongHop, BM-000009) làm: một lần gọi số liệu cả năm dương lịch theo từng đơn vị
-- (groupByOrg=true), tra khối của từng đơn vị trong danh mục đơn vị, cộng vào dòng khối.
--
-- Không dùng ctx.rows.clone (bảng TH có sẵn ba dòng khối) nên không vướng lỗi clone không chép giá trị.
-- Ô có công thức (tỷ lệ, tổng cộng) không ghi — script kiểm getFormula trước và bỏ qua lỗi ô khoá.
-- Cột C "Dự toán được giao" không có trong số liệu đã duyệt (script 1a/1b chỉ trích số đối tượng và kinh
-- phí quyết toán) nên để Sở nhập khi lưu số liệu tổng hợp.
-- Chỉ ghi đè khi script vẫn là bản rỗng của 114, để không xoá script ai đó đã soạn ở màn Thiết kế mẫu.

--changeset dth:169-seed-asxh-template-script-th-blocks splitStatements:false
--comment Biểu tổng hợp TH: đổ kinh phí quyết toán theo khối tỉnh / huyện / xã từ số liệu đã duyệt cả năm
UPDATE asxh_template_versions SET script_text = '// Biểu TH — tổng hợp kinh phí quyết toán theo khối đơn vị (hook afterInject, màn Tổng hợp theo năm).
// Nguồn số: ctx.api.get("/api/summary/data?from=&to=&groupByOrg=true") — ở màn số liệu Sở đã lưu / báo
// cáo năm, đường này tự đổi sang nguồn đang xem (ctx.shared.summaryDataUrl), giữ nguyên tham số.
// Khối của đơn vị: danh mục /api/master/organization-units (trường block: tinh / huyen / xa).
const SHEET = "TH";
const BLOCK_ROW = { tinh: 6, huyen: 7, xa: 8 };
const C_AMOUNT = 3;

function num(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Ghi an toàn: ô có công thức thuộc về mẫu, ô khoá bỏ qua.
function put(ctx, row, col, value) {
  try {
    const formula = ctx.cell.getFormula(SHEET, row, col);
    if (formula && String(formula).trim() !== "") return;
    ctx.cell.set(SHEET, row, col, value);
  } catch (e) {
    // bỏ qua
  }
}

return defineScript({
  async afterInject(ctx) {
    const shared = ctx.shared || {};
    const year = Number(shared.a != null ? shared.a : shared.year);
    if (!Number.isFinite(year)) return;

    try {
      ctx.cell.set(SHEET, 1, 0, "(Kèm theo báo cáo quyết toán kinh phí năm " + year + ")");
    } catch (e) {
      // bỏ qua
    }

    let units = [];
    let rows = [];
    try {
      units = (await ctx.api.get("/api/master/organization-units")) || [];
      rows = (await ctx.api.get("/api/summary/data?from=" + year + "-01-01&to=" + year
        + "-12-31&groupByOrg=true")) || [];
    } catch (e) {
      ctx.ui.message("Chưa lấy được số liệu tổng hợp năm " + year + ".");
      return;
    }

    const blockOf = {};
    for (const unit of units) {
      if (unit && unit.code) blockOf[unit.code] = String(unit.block || "").toLowerCase();
    }

    // Kinh phí cộng theo khối. Chỉ tiêu "mức hỗ trợ / đơn giá" không phải số tiền chi nên không cộng.
    // Dòng không thuộc đơn vị nào (Sở điều chỉnh chung) tính vào khối tỉnh.
    const total = { tinh: 0, huyen: 0, xa: 0 };
    for (const row of rows) {
      if (row.measureKind === "DON_GIA") continue;
      const block = blockOf[row.organizationCode];
      const key = block in total ? block : "tinh";
      total[key] += num(row.amount);
    }

    for (const key of Object.keys(BLOCK_ROW)) {
      put(ctx, BLOCK_ROW[key], C_AMOUNT, total[key]);
    }
  },
});
'
WHERE template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000003')
  AND script_text = 'return defineScript({})'
--rollback UPDATE asxh_template_versions SET script_text = 'return defineScript({})' WHERE template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000003') AND script_text LIKE '// Biểu TH — tổng hợp kinh phí%'
