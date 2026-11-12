--liquibase formatted sql

-- Tiêu đề của 18 biểu nhập ghi cứng "… NĂM 2027" và dòng "Kết quả thực hiện: Tháng …… Năm ……" để trống, nên
-- phiếu Quý I/2026 in ra sai năm và không nói kỳ nào (B31, đợt kiểm thử toàn app 10/11/2026). Người đặt
-- yêu cầu chốt sửa bằng kịch bản, chưa sửa khung biểu.
-- Kịch bản khoá ô (onLoad) của mỗi biểu điền năm vào cuối tiêu đề (A2) và tên kỳ vào B3 khi hai ô còn là chữ
-- mẫu; chữ người dùng đã sửa tay được giữ, nên chạy lại hay mở lại phiếu không ghi đè. Chỉ đụng kịch bản còn
-- đúng dòng tên đơn vị chuẩn và chưa có đoạn này; chạy lại không đổi gì.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/<biểu>-scripts/1-khoa-o-nhap-lieu.txt.

--changeset dth:186-nam-ky-trong-tieu-de-bieu-nhap splitStatements:false stripComments:false
--comment Biểu nhập: điền năm vào tiêu đề và tên kỳ vào dòng "Kết quả thực hiện" theo phiếu
WITH s AS (
  SELECT id, replace(code, $js$    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';$js$, $js$    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';
    // Tiêu đề (dòng 2) và dòng "Kết quả thực hiện" (B3) theo kỳ của phiếu: mẫu ghi cứng "NĂM 2027" ở tiêu đề và
    // để trống "Tháng …… Năm ……". Chỉ điền khi còn là chữ mẫu — chữ người dùng đã sửa tay được giữ.
    const _year = ctx.shared && ctx.shared.year ? String(ctx.shared.year) : '';
    const _per = ctx.shared && ctx.shared.periodName ? String(ctx.shared.periodName) : '';
    if (_year) {
      const _title = ctx.cell.get(SHEET, 1, 0);
      if (typeof _title === 'string' && /N[ĂA]M\s+\d{4}\s*$/i.test(_title)) {
        ctx.cell.set(SHEET, 1, 0, _title.replace(/(N[ĂA]M)\s+\d{4}\s*$/i, '$1 ' + _year));
      }
    }
    if (_per) {
      const _when = ctx.cell.get(SHEET, 2, 1);
      if (typeof _when === 'string' && _when.indexOf('……') >= 0) ctx.cell.set(SHEET, 2, 1, 'Kết quả thực hiện: ' + _per);
    }$js$) AS code
    FROM asxh_template_scripts
   WHERE position($js$    const _org = ctx.shared && ctx.shared.orgName ? String(ctx.shared.orgName) : '';$js$ in code) > 0
     AND position($js$const _per = ctx.shared$js$ in code) = 0
)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-186'
FROM s
WHERE t.id = s.id;
--rollback SELECT 1;
