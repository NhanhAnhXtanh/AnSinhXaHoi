--liquibase formatted sql

-- Kiểm lại changeset 186 trên trình duyệt (11/11/2026): màn Tổng hợp theo kỳ, tab 1a vẫn ghi "… NĂM 2027" và
-- "Kết quả thực hiện: Tháng …… Năm ……", vì đoạn điền năm / kỳ nằm SAU dòng kiểm chế độ của kịch bản khoá ô
-- (dòng đó cho màn Tổng hợp thoát sớm). Chuyển đoạn lên TRƯỚC dòng kiểm chế độ để màn nhập lẫn màn Tổng hợp
-- đều được điền. Chỉ đụng kịch bản còn đoạn ở vị trí cũ do changeset 186 chèn; chạy lại không đổi gì.
-- Bản đầy đủ: docs/form-template/scripts/script-templates/<biểu>-scripts/1-khoa-o-nhap-lieu.txt.

--changeset dth:188-nam-ky-tieu-de-man-tong-hop splitStatements:false stripComments:false
--comment Điền năm và kỳ vào tiêu đề cả ở màn Tổng hợp theo kỳ: chuyển đoạn lên trước dòng kiểm chế độ
WITH s AS (
  SELECT id,
         replace(
           replace(code, $js$
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
    }$js$, ''),
           $js$    if (ctx.mode && ctx.mode !== 'input') return;$js$,
           $js$    // Tiêu đề (dòng 2) và dòng "Kết quả thực hiện" (B3) theo kỳ của phiếu: mẫu ghi cứng "NĂM 2027" ở tiêu đề và
    // để trống "Tháng …… Năm ……". Chỉ điền khi còn là chữ mẫu — chữ người dùng đã sửa tay được giữ.
    // Đặt TRƯỚC dòng kiểm chế độ để màn Tổng hợp theo kỳ (mode summary) cũng được điền, không chỉ màn nhập.
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
    }
    if (ctx.mode && ctx.mode !== 'input') return;$js$) AS code
    FROM asxh_template_scripts
   WHERE position($js$
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
    }$js$ in code) > 0
)
UPDATE asxh_template_scripts t
SET code = s.code,
    script_hash = encode(sha256(convert_to(s.code, 'UTF8')), 'hex'),
    updated_at = now(),
    updated_by = 'liquibase-188'
FROM s
WHERE t.id = s.id;
--rollback SELECT 1;
