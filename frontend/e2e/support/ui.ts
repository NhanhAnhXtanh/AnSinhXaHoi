// Thao tác giao diện dùng chung cho các spec.
import { expect, type Page } from "@playwright/test";

import type { Account } from "./api";

/** Chọn sẵn năm báo cáo (ô "Năm …" ở đầu trang nhớ trong localStorage) trước khi trang nạp. */
export async function useReportYear(page: Page, year: number) {
  await page.addInitScript((y) => window.localStorage.setItem("asxh.reportYear", String(y)), year);
}

/** Đăng nhập qua màn đăng nhập thật và chờ vào tới trang chủ. */
export async function login(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByPlaceholder("Nhập tên đăng nhập").fill(account.username);
  await page.getByPlaceholder("Nhập mật khẩu").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Đăng xuất bằng cách xoá phiên trong trình duyệt (đổi vai giữa chừng một spec). */
export async function logout(page: Page) {
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("dth-auth-")) window.localStorage.removeItem(key);
    }
  });
}

/** Chờ thông báo (toast sonner) có chữ khớp. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

/**
 * Gõ số vào ô của bảng tính như người dùng gõ: lệnh "editCell" của SpreadJS đi qua
 * commandManager nên màn nhận đúng sự kiện "đã sửa" (nút Lưu, cảnh báo chưa lưu…).
 * Cần bản build có VITE_E2E_HOOKS=1 (xem src/shared/components/spreadsheet/impl/e2e-hook.ts).
 */
export async function typeIntoSheet(
  page: Page,
  sheetName: string,
  cells: { row: number; col: number; value: number }[]
) {
  await page.waitForFunction(
    () => ((window as unknown as { __asxhE2E?: { workbooks: unknown[] } }).__asxhE2E?.workbooks.length ?? 0) > 0,
    undefined,
    { timeout: 60_000 }
  );
  await page.evaluate(
    ({ sheetName, cells }) => {
      type Wb = {
        getSheetFromName(name: string): unknown;
        commandManager(): { execute(cmd: Record<string, unknown>): boolean };
      };
      const registry = (window as unknown as { __asxhE2E: { workbooks: Wb[] } }).__asxhE2E;
      const workbook = registry.workbooks[registry.workbooks.length - 1];
      if (!workbook.getSheetFromName(sheetName)) throw new Error(`Không có sheet ${sheetName}`);
      for (const { row, col, value } of cells) {
        workbook.commandManager().execute({ cmd: "editCell", sheetName, row, col, newValue: String(value) });
      }
    },
    { sheetName, cells }
  );
}

/** Đọc giá trị một ô của workbook đang mở gần nhất (bảng tổng hợp, phiếu chỉ xem…). */
export async function readSheetCell(page: Page, sheetName: string, row: number, col: number): Promise<unknown> {
  await page.waitForFunction(
    () => ((window as unknown as { __asxhE2E?: { workbooks: unknown[] } }).__asxhE2E?.workbooks.length ?? 0) > 0,
    undefined,
    { timeout: 60_000 }
  );
  return page.evaluate(
    ({ sheetName, row, col }) => {
      type Wb = { getSheetFromName(name: string): { getValue(r: number, c: number): unknown } | null };
      const registry = (window as unknown as { __asxhE2E: { workbooks: Wb[] } }).__asxhE2E;
      const workbook = registry.workbooks[registry.workbooks.length - 1];
      return workbook.getSheetFromName(sheetName)?.getValue(row, col) ?? null;
    },
    { sheetName, row, col }
  );
}
