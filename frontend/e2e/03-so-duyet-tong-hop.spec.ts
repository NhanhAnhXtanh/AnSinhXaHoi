// Luồng (c) — ASX-161: Sở duyệt một phiếu và trả lại một phiếu → chỉ số liệu phiếu được duyệt
// vào sổ cái → màn Tổng hợp báo cáo cộng đúng số đó. Hai phường nộp sẵn qua API.
import { expect, test } from "@playwright/test";

import {
  ACCOUNTS,
  Api,
  TEMPLATE_1A,
  UNIT_BUU_LONG,
  UNIT_TRAN_BIEN,
  createCalendar,
  periodByCode,
  reportOf,
  setupAndOpen,
  templateByCode,
  unitByCode,
  unitSubmitsViaApi,
} from "./support/api";
import { purgeYear } from "./support/db";
import { expectToast, login, logout, readSheetCell, useReportYear } from "./support/ui";
import { E2E_YEARS } from "./support/years";

const YEAR = E2E_YEARS.reviewLedgerSummary;
const PERIOD = `Quý I/${YEAR}`;
const TRAN_BIEN = { name: "UBND phường Trấn Biên", quantity: 12, amount: 34_500_000 };
const BUU_LONG = { name: "UBND phường Bửu Long", quantity: 7, amount: 9_000_000 };
const RETURN_REASON = "Biểu 1a dòng 1: số người hưởng chưa khớp danh sách chi trả, đề nghị rà lại.";

let periodId: number;
let tranBienId: number;
let buuLongId: number;

test.describe("Luồng (c): Sở duyệt / trả lại → sổ cái → Tổng hợp", () => {
  test.beforeAll(async () => {
    await purgeYear(YEAR);
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    const period = await periodByCode(so, YEAR, "Q1");
    periodId = period.id;
    tranBienId = (await unitByCode(so, UNIT_TRAN_BIEN)).id;
    buuLongId = (await unitByCode(so, UNIT_BUU_LONG)).id;
    const template = await templateByCode(so, TEMPLATE_1A);
    await setupAndOpen(so, periodId, [
      { unitId: tranBienId, templateId: template.id },
      { unitId: buuLongId, templateId: template.id },
    ]);

    for (const [account, unitId, data] of [
      [ACCOUNTS.donviBienHoa, tranBienId, TRAN_BIEN],
      [ACCOUNTS.donviBuuLong, buuLongId, BUU_LONG],
    ] as const) {
      const unit = await Api.as(account);
      const report = await reportOf(unit, periodId, unitId);
      await unitSubmitsViaApi(unit, report.id, data.quantity, data.amount);
      await unit.dispose();
    }
    await so.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
  });

  test("duyệt phiếu Trấn Biên, trả lại phiếu Bửu Long → Tổng hợp chỉ cộng phiếu đã duyệt", async ({ page }) => {
    await useReportYear(page, YEAR);
    await login(page, ACCOUNTS.soDuyet);

    // Phê duyệt.
    await page.goto("/report-review");
    await page.getByRole("row").filter({ hasText: TRAN_BIEN.name }).getByRole("button", { name: "Duyệt phiếu" }).click();
    await expect(page).toHaveURL(/\/report-review\/\d+/);
    await page.getByRole("button", { name: "Phê duyệt", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Phê duyệt phiếu" }).click();
    await expectToast(page, `Đã phê duyệt phiếu ${PERIOD} của ${TRAN_BIEN.name}.`);
    await expect(page).toHaveURL(/\/report-review$/);

    // Trả lại kèm lý do.
    await page.getByRole("row").filter({ hasText: BUU_LONG.name }).getByRole("button", { name: "Duyệt phiếu" }).click();
    await page.getByRole("button", { name: "Trả lại", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Trả lại phiếu" });
    await dialog.getByRole("textbox").fill(RETURN_REASON);
    await dialog.getByRole("button", { name: "Trả lại phiếu" }).click();
    await expectToast(page, `Đã trả lại phiếu cho ${BUU_LONG.name}.`);

    // Máy chủ: Trấn Biên đã duyệt, Bửu Long có phiên bản mới Bị trả lại mang lý do;
    // sổ cái của kỳ chỉ có dòng của Trấn Biên, đúng số đã nhập.
    const so = await Api.as(ACCOUNTS.soDuyet);
    expect((await reportOf(so, periodId, tranBienId)).status).toBe("APPROVED");
    const returned = (await reportOf(so, periodId, buuLongId)) as { status: string; returnReason?: string };
    expect(returned.status).toBe("RETURNED");
    expect(returned.returnReason).toBe(RETURN_REASON);
    await so.dispose();

    const tongHop = await Api.as(ACCOUNTS.soTongHop);
    const rows = await tongHop.get<{ indicatorCode: string; quantity: number | null; amount: number | null }[]>(
      `/summary/data?periodId=${periodId}&sourceSheetCode=${TEMPLATE_1A}`
    );
    const line = rows.filter((r) => r.indicatorCode === "1a.1");
    expect(line.reduce((a, r) => a + Number(r.quantity ?? 0), 0)).toBe(TRAN_BIEN.quantity);
    expect(line.reduce((a, r) => a + Number(r.amount ?? 0), 0)).toBe(TRAN_BIEN.amount);
    await tongHop.dispose();

    // Màn Tổng hợp báo cáo (cán bộ tổng hợp): biểu 1a của kỳ cộng đúng số phiếu đã duyệt.
    await logout(page);
    await login(page, ACCOUNTS.soTongHop);
    await page.goto("/summary");
    await page.getByText(PERIOD, { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: PERIOD })).toBeVisible();
    await expect.poll(() => readSheetCell(page, "1a", 6, 2), { timeout: 60_000 }).toBe(TRAN_BIEN.quantity);
    expect(await readSheetCell(page, "1a", 6, 4)).toBe(TRAN_BIEN.amount);
  });
});
