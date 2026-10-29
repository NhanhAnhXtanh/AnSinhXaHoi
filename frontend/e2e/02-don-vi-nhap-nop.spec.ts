// Luồng (b) — ASX-160: đơn vị nhập số liệu → Lưu dữ liệu → Kiểm tra & hoàn tất → đính kèm
// xác nhận Kho bạc → Nộp phiếu. Kỳ được Sở thiết lập + mở đợt sẵn qua API.
import { expect, test } from "@playwright/test";

import {
  ACCOUNTS,
  Api,
  TEMPLATE_1A,
  UNIT_TRAN_BIEN,
  createCalendar,
  periodByCode,
  reportOf,
  setupAndOpen,
  sheetsOf,
  templateByCode,
  tinyPdf,
  unitByCode,
} from "./support/api";
import { purgeYear } from "./support/db";
import { expectToast, login, typeIntoSheet, useReportYear } from "./support/ui";
import { E2E_YEARS } from "./support/years";

const YEAR = E2E_YEARS.unitInputSubmit;

let reportId: number;
let periodId: number;
let unitId: number;

test.describe("Luồng (b): đơn vị nhập liệu và nộp phiếu", () => {
  test.beforeAll(async () => {
    await purgeYear(YEAR);
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    const period = await periodByCode(so, YEAR, "Q1");
    const unit = await unitByCode(so, UNIT_TRAN_BIEN);
    const template = await templateByCode(so, TEMPLATE_1A);
    await setupAndOpen(so, period.id, [{ unitId: unit.id, templateId: template.id }]);
    periodId = period.id;
    unitId = unit.id;
    reportId = (await reportOf(so, period.id, unit.id)).id;
    await so.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
  });

  test("nhập biểu 1a, hoàn tất, đính kèm Kho bạc rồi nộp → phiếu Chờ duyệt", async ({ page }) => {
    await useReportYear(page, YEAR);
    await login(page, ACCOUNTS.donviBienHoa);
    await page.goto(`/input-reports/${reportId}`);

    // Dòng 6 = chỉ tiêu 1 "Trợ cấp xã hội hằng tháng": cột C số người, cột E kinh phí.
    await typeIntoSheet(page, "1a", [
      { row: 6, col: 2, value: 12 },
      { row: 6, col: 4, value: 34_500_000 },
    ]);
    await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();

    await page.getByRole("button", { name: "Lưu dữ liệu" }).click();
    await expectToast(page, "Đã lưu số liệu biểu 1a.");

    await page.getByRole("button", { name: "Kiểm tra & hoàn tất" }).click();
    await expectToast(page, /Đã đánh dấu biểu 1a là nhập xong/);

    await page.getByRole("button", { name: "Nộp phiếu", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nộp phiếu lên Sở Tài chính" });
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole("button", { name: "Nộp phiếu", exact: true });
    await expect(submit).toBeDisabled();

    await dialog.locator('input[type="file"]').setInputFiles(tinyPdf());
    await expect(dialog.getByText("xac-nhan-kho-bac.pdf")).toBeVisible();
    await dialog.getByLabel("Đã có phiếu xác nhận của Kho bạc").click();
    await expect(submit).toBeEnabled();
    await submit.click();

    // Hộp xác nhận cuối: tóm tắt số biểu và tình trạng Kho bạc trước khi gửi.
    const confirm = page.getByRole("dialog", { name: `Nộp phiếu Quý I/${YEAR}?` });
    await expect(confirm.getByText("Số biểu: 1 biểu, đã nhập xong hết")).toBeVisible();
    await expect(confirm.getByText("Xác nhận của Kho bạc: đã đính kèm tệp và tích xác nhận")).toBeVisible();
    await confirm.getByRole("button", { name: "Nộp phiếu", exact: true }).click();
    await expectToast(page, /Đã nộp phiếu Quý I\/\d{4}; đang chờ Sở duyệt/);
    await expect(dialog).toBeHidden();

    // Máy chủ: phiếu đã nộp, số đã lưu đúng ô, tờ biểu đã hoàn tất, có một tệp Kho bạc.
    const unit = await Api.as(ACCOUNTS.donviBienHoa);
    const report = await reportOf(unit, periodId, unitId);
    expect(report.status).toBe("SUBMITTED");
    const [sheet] = await sheetsOf(unit, report.id);
    expect(sheet.completion).toBe("COMPLETED");
    const saved = JSON.parse(
      (await unit.get<{ dataJson: string }>(`/input_report_sheets/${sheet.id}`)).dataJson
    ) as { sheets: Record<string, { data: { dataTable: Record<number, Record<number, { value: unknown }>> } }> };
    expect(saved.sheets["1a"].data.dataTable[6][2].value).toBe(12);
    expect(saved.sheets["1a"].data.dataTable[6][4].value).toBe(34_500_000);
    const attachments = await unit.get<unknown[]>(`/input_reports/${report.id}/attachments`);
    expect(attachments).toHaveLength(1);
    await unit.dispose();

    // Màn hình: phiếu chuyển sang chỉ xem, không còn nút Nộp.
    await page.reload();
    await expect(page.getByRole("button", { name: "Nộp phiếu", exact: true })).toHaveCount(0);
  });
});
