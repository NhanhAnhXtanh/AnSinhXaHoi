// Luồng (a) — ASX-159: Sở thiết lập kỳ (gán biểu cho đơn vị trên ma trận) rồi mở đợt báo cáo;
// đơn vị thấy phiếu mới ở màn Nhập liệu.
import { expect, test } from "@playwright/test";

import { ACCOUNTS, Api, UNIT_BUU_LONG, UNIT_TRAN_BIEN, createCalendar, periodByCode, reportOf, unitByCode } from "./support/api";
import { purgeYear } from "./support/db";
import { expectToast, login, logout, useReportYear } from "./support/ui";
import { E2E_YEARS } from "./support/years";

const YEAR = E2E_YEARS.setupAndOpen;
const PERIOD = `Quý I/${YEAR}`;

test.describe("Luồng (a): Sở thiết lập kỳ và mở đợt", () => {
  test.beforeAll(async () => {
    await purgeYear(YEAR);
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    await so.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
  });

  test("gán biểu 1a cho hai phường, lưu, mở đợt → mỗi phường nhận một phiếu", async ({ page }) => {
    await useReportYear(page, YEAR);
    await login(page, ACCOUNTS.soDieuHanh);
    await page.goto("/period-setup");
    await expect(page.getByRole("heading", { name: "Thiết lập & điều hành" })).toBeVisible();

    await page.getByText(PERIOD, { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: PERIOD })).toBeVisible();
    await expect(page.getByText("Chưa thiết lập").first()).toBeVisible();

    for (const unit of ["UBND phường Trấn Biên", "UBND phường Bửu Long"]) {
      const cell = page.getByRole("checkbox", { name: `${unit} — biểu 1a` });
      await cell.click();
      await expect(cell).toBeChecked();
    }
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expectToast(page, /Đã lưu 2 ô/);

    await page.getByRole("button", { name: "Mở đợt báo cáo" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Mở đợt báo cáo ${PERIOD}?`)).toBeVisible();
    await expect(dialog.getByText("2 đơn vị")).toBeVisible();
    await dialog.getByRole("button", { name: `Mở đợt ${PERIOD}` }).click();
    await expectToast(page, /đã mở, tạo 2 phiếu/);
    await expect(page.getByText("Đang mở").first()).toBeVisible();

    // Máy chủ: mỗi phường có đúng một phiếu Đang nhập liệu cho kỳ vừa mở.
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    const period = await periodByCode(so, YEAR, "Q1");
    expect(period.status).toBe("open");
    for (const code of [UNIT_TRAN_BIEN, UNIT_BUU_LONG]) {
      const unit = await unitByCode(so, code);
      expect((await reportOf(so, period.id, unit.id)).status).toBe("DRAFT");
    }
    await so.dispose();

    // Đơn vị: phiếu hiện ở màn Nhập liệu của năm.
    await logout(page);
    await login(page, ACCOUNTS.donviBienHoa);
    await page.goto("/input-reports");
    await expect(page.getByText(PERIOD).first()).toBeVisible();
  });
});
