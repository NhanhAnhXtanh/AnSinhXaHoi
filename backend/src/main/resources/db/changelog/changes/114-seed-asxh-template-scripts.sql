--liquibase formatted sql

-- Script mẫu cho các biểu seed (112 chỉ có một dòng chú thích nên Sở không duyệt được:
-- máy chủ đòi script kết thúc bằng return defineScript({...})). Chỉ ghi đè khi script
-- vẫn là bản chú thích của 112, để không xoá script ai đó đã soạn ở màn Thiết kế mẫu.
-- Mã chỉ tiêu = <tên biểu>.<STT>; số đối tượng ở cột C, kinh phí quyết toán ở cột E.
-- Script có dấu chấm phẩy nên mỗi changeset là MỘT câu với splitStatements:false.

--changeset dth:114-seed-asxh-template-script-1a splitStatements:false
--comment Script trích số liệu / kiểm tra / đổ tổng hợp cho biểu 1a
UPDATE asxh_template_versions SET script_text = '// Biểu 1a — trích số liệu khi Sở duyệt, kiểm số âm khi nộp, đổ số tổng hợp lên bảng.
const SHEET = "1a";
const FIRST_ROW = 6;
const LAST_ROW = 29;

function eachLine(ctx, fn) {
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    const name = ctx.cell.get(SHEET, r, 1);
    if (name === "Tổng cộng") break;
    const stt = ctx.cell.get(SHEET, r, 0);
    if (stt == null || stt === "" || name == null || name === "") continue;
    fn(r, String(stt), String(name));
  }
}

function num(value) {
  return typeof value === "number" ? value : null;
}

return defineScript({
  getInputData(ctx) {
    const rows = [];
    eachLine(ctx, (r, stt, name) => {
      rows.push({
        indicatorCode: SHEET + "." + stt,
        indicatorName: name,
        quantity: num(ctx.cell.get(SHEET, r, 2)),
        amount: num(ctx.cell.get(SHEET, r, 4)),
        orderNo: r,
      });
    });
    return rows;
  },

  validate(ctx) {
    eachLine(ctx, (r, stt, name) => {
      for (const col of [2, 3, 4]) {
        const value = num(ctx.cell.get(SHEET, r, col));
        if (value != null && value < 0) {
          ctx.issues.add({
            severity: "ERROR",
            code: "SO_AM",
            message: "Biểu " + SHEET + ", dòng " + stt + " (" + name + "): số liệu không được âm.",
          });
        }
      }
    });
  },

  afterInject(ctx) {
    const data = (ctx.shared && ctx.shared.rows) || [];
    eachLine(ctx, (r, stt) => {
      const code = SHEET + "." + stt;
      let quantity = 0;
      let amount = 0;
      for (const row of data) {
        if (row.indicatorCode !== code) continue;
        quantity += Number(row.quantity || 0);
        amount += Number(row.amount || 0);
      }
      ctx.cell.set(SHEET, r, 2, quantity);
      ctx.cell.set(SHEET, r, 4, amount);
    });
  },
});
'
WHERE template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000001')
  AND (script_text IS NULL OR script_text LIKE '// Script của biểu%')
--rollback SELECT 1

--changeset dth:114-seed-asxh-template-script-1b splitStatements:false
--comment Script trích số liệu / kiểm tra / đổ tổng hợp cho biểu 1b
UPDATE asxh_template_versions SET script_text = '// Biểu 1b — trích số liệu khi Sở duyệt, kiểm số âm khi nộp, đổ số tổng hợp lên bảng.
const SHEET = "1b";
const FIRST_ROW = 6;
const LAST_ROW = 29;

function eachLine(ctx, fn) {
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    const name = ctx.cell.get(SHEET, r, 1);
    if (name === "Tổng cộng") break;
    const stt = ctx.cell.get(SHEET, r, 0);
    if (stt == null || stt === "" || name == null || name === "") continue;
    fn(r, String(stt), String(name));
  }
}

function num(value) {
  return typeof value === "number" ? value : null;
}

return defineScript({
  getInputData(ctx) {
    const rows = [];
    eachLine(ctx, (r, stt, name) => {
      rows.push({
        indicatorCode: SHEET + "." + stt,
        indicatorName: name,
        quantity: num(ctx.cell.get(SHEET, r, 2)),
        amount: num(ctx.cell.get(SHEET, r, 4)),
        orderNo: r,
      });
    });
    return rows;
  },

  validate(ctx) {
    eachLine(ctx, (r, stt, name) => {
      for (const col of [2, 3, 4]) {
        const value = num(ctx.cell.get(SHEET, r, col));
        if (value != null && value < 0) {
          ctx.issues.add({
            severity: "ERROR",
            code: "SO_AM",
            message: "Biểu " + SHEET + ", dòng " + stt + " (" + name + "): số liệu không được âm.",
          });
        }
      }
    });
  },

  afterInject(ctx) {
    const data = (ctx.shared && ctx.shared.rows) || [];
    eachLine(ctx, (r, stt) => {
      const code = SHEET + "." + stt;
      let quantity = 0;
      let amount = 0;
      for (const row of data) {
        if (row.indicatorCode !== code) continue;
        quantity += Number(row.quantity || 0);
        amount += Number(row.amount || 0);
      }
      ctx.cell.set(SHEET, r, 2, quantity);
      ctx.cell.set(SHEET, r, 4, amount);
    });
  },
});
'
WHERE template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000002')
  AND (script_text IS NULL OR script_text LIKE '// Script của biểu%')
--rollback SELECT 1

--changeset dth:114-seed-asxh-template-script-th splitStatements:false
--comment Biểu tổng hợp TH: script rỗng hợp lệ (chưa có quy tắc đổ số theo khối)
UPDATE asxh_template_versions SET script_text = 'return defineScript({})'
WHERE template_id IN (SELECT id FROM asxh_templates WHERE code = 'BM-000003')
  AND (script_text IS NULL OR script_text LIKE '// Script của biểu%')
--rollback SELECT 1
