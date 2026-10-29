// Móc cho kiểm thử e2e (Playwright): SpreadJS vẽ lên canvas nên test không gõ ô bằng
// click toạ độ được — nó cần chính đối tượng Workbook để chạy lệnh "editCell" như người
// dùng gõ. CHỈ bật khi build với VITE_E2E_HOOKS=1 (frontend/e2e dựng bản preview như vậy);
// Vite thay `import.meta.env.VITE_E2E_HOOKS` bằng hằng lúc build, nên ở bản production
// nhánh dưới bị loại bỏ hoàn toàn và window không có gì lộ ra.
import type * as GC from "@mescius/spread-sheets";

type E2ERegistry = { workbooks: GC.Spread.Sheets.Workbook[] };

/** Đăng ký workbook đã nạp xong; trả hàm gỡ đăng ký (gọi khi workbook bị huỷ). */
export function exposeWorkbookForE2E(workbook: GC.Spread.Sheets.Workbook): () => void {
  if (import.meta.env.VITE_E2E_HOOKS !== "1") return () => {};
  const host = window as unknown as { __asxhE2E?: E2ERegistry };
  const registry = (host.__asxhE2E ??= { workbooks: [] });
  registry.workbooks.push(workbook);
  return () => {
    const index = registry.workbooks.indexOf(workbook);
    if (index >= 0) registry.workbooks.splice(index, 1);
  };
}
