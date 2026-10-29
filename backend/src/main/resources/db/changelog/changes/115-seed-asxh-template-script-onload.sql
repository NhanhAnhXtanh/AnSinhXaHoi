--liquibase formatted sql

-- Thêm hook onLoad cho script mẫu của 114: điền tên đơn vị vào dòng "Đơn vị báo cáo:" khi
-- mở phiếu nhập (như bản Jmix). 114 đã chạy nên không sửa file đó; chèn hook vào đầu khối
-- defineScript của script do 114 ghi, chỉ khi script vẫn là bản đó và chưa có onLoad.

--changeset dth:115-seed-asxh-template-script-onload-1a splitStatements:false
--comment Biểu 1a: điền tên đơn vị khi mở phiếu nhập
UPDATE asxh_template_versions SET script_text = REPLACE(script_text, 'return defineScript({
  getInputData(ctx) {', 'return defineScript({
  onLoad(ctx) {
    if (ctx.mode !== "input") return;
    const unit = (ctx.shared && (ctx.shared.unitName || ctx.shared.orgName)) || "";
    if (unit) ctx.cell.set(SHEET, 2, 0, "Đơn vị báo cáo: " + unit);
  },

  getInputData(ctx) {')
WHERE script_text LIKE '// Biểu 1a — trích số liệu%'
  AND script_text NOT LIKE '%onLoad(ctx)%'
--rollback SELECT 1

--changeset dth:115-seed-asxh-template-script-onload-1b splitStatements:false
--comment Biểu 1b: điền tên đơn vị khi mở phiếu nhập
UPDATE asxh_template_versions SET script_text = REPLACE(script_text, 'return defineScript({
  getInputData(ctx) {', 'return defineScript({
  onLoad(ctx) {
    if (ctx.mode !== "input") return;
    const unit = (ctx.shared && (ctx.shared.unitName || ctx.shared.orgName)) || "";
    if (unit) ctx.cell.set(SHEET, 2, 0, "Đơn vị báo cáo: " + unit);
  },

  getInputData(ctx) {')
WHERE script_text LIKE '// Biểu 1b — trích số liệu%'
  AND script_text NOT LIKE '%onLoad(ctx)%'
--rollback SELECT 1
