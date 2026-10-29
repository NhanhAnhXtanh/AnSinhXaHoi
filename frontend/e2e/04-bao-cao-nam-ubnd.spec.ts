// Luồng (d) — ASX-162: Sở nộp báo cáo năm lên UBND → UBND trả lại → Sở gửi lại Phiếu 2 →
// UBND phê duyệt. Số liệu năm dựng sẵn qua API: một kỳ có phiếu đã duyệt và đã chốt đợt
// (chốt đợt lưu số tổng hợp của kỳ vào sổ Sở — điều kiện nộp năm).
import { expect, test, type Page } from "@playwright/test";

import {
  ACCOUNTS,
  Api,
  TEMPLATE_1A,
  UNIT_TRAN_BIEN,
  createCalendar,
  periodByCode,
  reportOf,
  setupAndOpen,
  templateByCode,
  tinyPdf,
  unitByCode,
  unitSubmitsViaApi,
} from "./support/api";
import { purgeYear } from "./support/db";
import { expectToast, login, logout, useReportYear } from "./support/ui";
import { E2E_YEARS } from "./support/years";

const YEAR = E2E_YEARS.annualUbnd;
const RETURN_REASON = "Biểu tổng hợp năm: đề nghị Sở bổ sung thuyết minh số người hưởng trợ cấp quý I.";

// Trạng thái báo cáo năm đi ra chữ thường (enum DeptReportStatus của API).
type AnnualReport = { id: number; revisionNo: number; status: string; returnReason?: string | null };

test.describe("Luồng (d): báo cáo năm Sở → UBND", () => {
  test.beforeAll(async () => {
    await purgeYear(YEAR);
    const dieuHanh = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(dieuHanh, YEAR);
    const period = await periodByCode(dieuHanh, YEAR, "Q1");
    const unitId = (await unitByCode(dieuHanh, UNIT_TRAN_BIEN)).id;
    const template = await templateByCode(dieuHanh, TEMPLATE_1A);
    await setupAndOpen(dieuHanh, period.id, [{ unitId, templateId: template.id }]);

    const unit = await Api.as(ACCOUNTS.donviBienHoa);
    const report = await reportOf(unit, period.id, unitId);
    await unitSubmitsViaApi(unit, report.id, 20, 50_000_000);
    await unit.dispose();

    const duyet = await Api.as(ACCOUNTS.soDuyet);
    await duyet.post(`/input_reports/${report.id}/approve`);
    await duyet.dispose();

    await dieuHanh.post(`/report_periods/${period.id}/close`);
    await dieuHanh.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
  });

  async function openYear(page: Page) {
    await page.goto("/summary");
    await page.getByRole("tab", { name: "Theo năm" }).click();
    await page.getByRole("option", { name: new RegExp(`Năm ${YEAR}`) }).click();
    await expect(page.getByText(`Báo cáo năm ${YEAR}`).first()).toBeVisible();
  }

  async function submitYear(page: Page, verb: "Nộp" | "Gửi lại", docNo: string) {
    await page.getByRole("button", { name: `${verb} báo cáo năm`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `${verb} báo cáo năm ${YEAR} lên UBND?` });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Số văn bản").fill(docNo);
    await expect(dialog.getByLabel("Ngày văn bản")).not.toHaveValue("");
    await dialog.locator('input[type="file"]').setInputFiles(tinyPdf("to-trinh-ubnd.pdf"));
    await expect(dialog.getByText("to-trinh-ubnd.pdf")).toBeVisible();
    await dialog.getByLabel(`Tôi xác nhận gửi báo cáo năm ${YEAR} lên UBND`).click();
    await dialog.getByRole("button", { name: `${verb} báo cáo năm ${YEAR}` }).click();
  }

  async function ubndDecides(page: Page, decision: "return" | "approve", revisionNo: number) {
    await page.goto("/annual-review");
    const row = page.getByRole("row").filter({ hasText: `Phiếu ${revisionNo}` }).filter({ hasText: String(YEAR) });
    await row.getByRole("button", { name: "Duyệt báo cáo" }).click();
    await expect(page.getByText(`Báo cáo năm ${YEAR} · Phiếu ${revisionNo}`).first()).toBeVisible();
    if (decision === "return") {
      await page.getByRole("button", { name: "Trả lại", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: `Trả lại báo cáo năm ${YEAR}` });
      await dialog.getByLabel("Lý do trả lại").fill(RETURN_REASON);
      await dialog.getByRole("button", { name: `Trả lại báo cáo năm ${YEAR}` }).click();
      await expectToast(page, `Đã trả lại báo cáo năm ${YEAR} cho Sở Tài chính.`);
    } else {
      await page.getByRole("button", { name: "Phê duyệt", exact: true }).click();
      await page.getByRole("button", { name: `Phê duyệt báo cáo năm ${YEAR}` }).click();
      await expectToast(page, `Đã phê duyệt báo cáo năm ${YEAR}.`);
    }
  }

  async function annualReports(): Promise<AnnualReport[]> {
    const api = await Api.as(ACCOUNTS.soTongHop);
    const rows = await api.get<AnnualReport[]>(`/annual_reports?year=${YEAR}`);
    await api.dispose();
    return rows.sort((a, b) => a.revisionNo - b.revisionNo);
  }

  test("Sở nộp → UBND trả lại → Sở gửi lại Phiếu 2 → UBND phê duyệt", async ({ page }) => {
    await useReportYear(page, YEAR);

    // Sở nộp Phiếu 1.
    await login(page, ACCOUNTS.soTongHop);
    await openYear(page);
    await submitYear(page, "Nộp", `01/TTr-STC-E2E-${YEAR}`);
    await expectToast(page, `Đã nộp Phiếu 1 báo cáo năm ${YEAR} lên UBND.`);
    await expect(page.getByText("Chờ UBND duyệt").first()).toBeVisible();
    expect((await annualReports()).map((r) => r.status)).toEqual(["submitted"]);

    // UBND trả lại kèm lý do.
    await logout(page);
    await login(page, ACCOUNTS.ubndDuyet);
    await ubndDecides(page, "return", 1);
    const afterReturn = await annualReports();
    expect(afterReturn.map((r) => r.status)).toEqual(["returned"]);
    expect(afterReturn[0].returnReason).toBe(RETURN_REASON);

    // Sở gửi lại → Phiếu 2.
    await logout(page);
    await login(page, ACCOUNTS.soTongHop);
    await openYear(page);
    await expect(page.getByText("UBND trả lại").first()).toBeVisible();
    await submitYear(page, "Gửi lại", `02/TTr-STC-E2E-${YEAR}`);
    await expectToast(page, `Đã gửi lại Phiếu 2 báo cáo năm ${YEAR} lên UBND.`);

    // UBND phê duyệt Phiếu 2.
    await logout(page);
    await login(page, ACCOUNTS.ubndDuyet);
    await ubndDecides(page, "approve", 2);
    expect((await annualReports()).map((r) => r.status)).toEqual(["returned", "approved"]);

    // Năm đã duyệt thì khoá: kỳ của năm không mở / thiết lập lại được nữa.
    const dieuHanh = await Api.as(ACCOUNTS.soDieuHanh);
    const q2 = await periodByCode(dieuHanh, YEAR, "Q2");
    const unitId = (await unitByCode(dieuHanh, UNIT_TRAN_BIEN)).id;
    const template = await templateByCode(dieuHanh, TEMPLATE_1A);
    await expect(setupAndOpen(dieuHanh, q2.id, [{ unitId, templateId: template.id }])).rejects.toThrow(/409/);
    await dieuHanh.dispose();
  });
});
