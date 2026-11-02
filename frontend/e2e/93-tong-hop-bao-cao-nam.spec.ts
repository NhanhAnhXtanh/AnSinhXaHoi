// Kiểm thử nhóm C (chạy tay): Tổng hợp báo cáo, sổ Sở (dept reports), báo cáo năm lên UBND, Trang chủ.
// Mỗi chức năng đủ happy / worst / cheating; mỗi ca ghi mã HTTP thật (record + expect.soft) rồi in bảng.
// Năm riêng: 2039 cho Tổng hợp / sổ Sở / Trang chủ, 2038 cho luồng nộp – duyệt báo cáo năm (khoá CẢ năm).
// purgeYear trước và sau; support/db.ts từ chối CSDL thật.
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  ACCOUNTS,
  API_URL,
  Api,
  TEMPLATE_1A,
  UNIT_BUU_LONG,
  UNIT_TRAN_BIEN,
  attachTreasury,
  createCalendar,
  fillAndCompleteSheet,
  periodByCode,
  reportOf,
  setupAndOpen,
  sheetsOf,
  templateByCode,
  tinyPdf,
  unitByCode,
  unitSubmitsViaApi,
  type Account,
} from "./support/api";
import { purgeYear } from "./support/db";
import { expectToast, login, logout, readSheetCell, useReportYear } from "./support/ui";

const Y_SUM = 2039; // Tổng hợp, sổ Sở, Trang chủ
const Y_ANN = 2038; // nộp / duyệt báo cáo năm

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];

type Got = { status: number; body: string };

/** Client thô: trả mã HTTP + thân, không ném lỗi. */
class Raw {
  private constructor(private readonly ctx: APIRequestContext) {}
  static async as(account: Account | null, token?: string) {
    let bearer = token;
    if (account) {
      const anon = await request.newContext();
      const res = await anon.post(`${API_URL}/auth/login`, { data: account });
      bearer = ((await res.json()) as { accessToken: string }).accessToken;
      await anon.dispose();
    }
    const ctx = await request.newContext({ extraHTTPHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
    return new Raw(ctx);
  }
  async send(method: "get" | "post" | "put" | "delete", path: string, data?: unknown): Promise<Got> {
    const res = await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data });
    return { status: res.status(), body: await res.text() };
  }
  async head(path: string) {
    const res = await this.ctx.get(`${API_URL}${path}`);
    return { status: res.status(), type: res.headers()["content-type"] ?? "", disp: res.headers()["content-disposition"] ?? "", size: (await res.body()).length };
  }
  /** Nộp báo cáo năm (multipart, nhiều file cùng tên trường "files"). */
  async submitAnnual(fields: Record<string, string>, files: { name: string; mimeType: string; buffer: Buffer }[] = []): Promise<Got> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    for (const f of files) fd.append("files", new Blob([new Uint8Array(f.buffer)], { type: f.mimeType }), f.name);
    const res = await this.ctx.post(`${API_URL}/annual_reports`, { multipart: fd });
    return { status: res.status(), body: await res.text() };
  }
  dispose() {
    return this.ctx.dispose();
  }
}

function push(group: string, name: string, expectText: string, got: string, ok: boolean, note?: string) {
  results.push({ group, case: name, expect: expectText, got: got.replace(/\s+/g, " ").slice(0, 160), ok, note });
  // Không expect.soft ở đây: lỗi mềm làm worker khởi động lại và mất trạng thái giữa các test; test cuối tổng kết.
}
function record(group: string, name: string, got: Got, allowed: number[], note?: string) {
  push(group, name, allowed.join("/"), `${got.status} ${got.body}`, allowed.includes(got.status), note);
}
/** Ca kiểm giá trị: `ok` tự tính. */
function check(group: string, name: string, expected: unknown, actual: unknown, note?: string) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  push(group, name, JSON.stringify(expected), JSON.stringify(actual), ok, note);
}

const BAD = [400, 422];
const NO_ACCESS = [401, 403];
const OK = [200, 201, 204];

type DataRow = { indicatorCode: string; quantity: number | null; amount: number | null };
const sum = (rows: DataRow[]) => {
  const line = rows.filter((r) => r.indicatorCode === "1a.1");
  return { q: line.reduce((a, r) => a + Number(r.quantity ?? 0), 0), a: line.reduce((a, r) => a + Number(r.amount ?? 0), 0) };
};
const parse = <T,>(g: Got) => JSON.parse(g.body) as T;

/** Phiếu bị trả lại: đơn vị mở lại biểu, nhập lại, đính kèm, nộp lại. */
async function resubmit(unit: Api, reportId: number, quantity: number, amount: number) {
  const raw = await Raw.as(unit.account);
  for (const sheet of await sheetsOf(unit, reportId)) {
    await raw.send("post", `/input_report_sheets/${sheet.id}/reopen`);
    await fillAndCompleteSheet(unit, sheet.id, "1a", [
      { row: 6, col: 2, value: quantity },
      { row: 6, col: 4, value: amount },
    ]);
  }
  await attachTreasury(unit, reportId);
  await unit.post(`/input_reports/${reportId}/submit`);
  await raw.dispose();
}

/** Theo dõi lỗi trình duyệt của một trang: pageerror, console error, phản hồi 5xx. */
function watch(page: Page) {
  const errs = { page: [] as string[], console: [] as string[], http5xx: [] as string[] };
  // Bỏ lỗi localStorage: do addInitScript của useReportYear chạy trong iframe sandbox (không phải lỗi app).
  page.on("pageerror", (e) => {
    if (!/Failed to read the 'localStorage'/.test(e.message)) errs.page.push(e.message.slice(0, 200));

  });
  page.on("console", (m) => {
    if (m.type() === "error") errs.console.push(m.text().slice(0, 160));
  });
  page.on("response", (r) => {
    if (r.status() >= 500) errs.http5xx.push(`${r.status()} ${r.url()}`);
  });
  return errs;
}
function recordErrors(group: string, name: string, errs: ReturnType<typeof watch>) {
  const bad = errs.page.length + errs.http5xx.length;
  push(group, `${name}: không pageerror / HTTP 5xx`, "0 lỗi", `pageerror=${errs.page.length} 5xx=${errs.http5xx.length} console.error=${errs.console.length} ${[...errs.page, ...errs.http5xx].join(" | ")}`, bad === 0, errs.console.length ? `console: ${[...new Set(errs.console)].slice(0, 3).join(" | ")}` : undefined);
}

// ------------------------------------------------------------------ trạng thái dùng chung giữa các test
const S = {
  q1: 0, q2: 0, tb: 0, bl: 0, tplId: 0, tplVersionId: 0, thTemplateId: 0, deptId: 0,
  aQ1: 0, aQ2: 0, aTb: 0, aBl: 0, aQ2TbReport: 0, aQ2TbSheet: 0, aQ2BlReport: 0, aDeptId: 0,
  ann1: 0, ann2: 0, ann3: 0,
};

test.describe.configure({ mode: "serial" });

test.describe("Nhóm C — Tổng hợp, sổ Sở, báo cáo năm, Trang chủ", () => {
  test.beforeAll(async () => {
    await purgeYear(Y_SUM);
    await purgeYear(Y_ANN);
  });

  // Ghi bảng kết quả sau MỖI test: một test hỏng giữa chừng không làm mất các ca đã chạy.
  const resultsFile = process.env.E2E_RESULTS_FILE ?? "test-results/93-tong-hop-bao-cao-nam.json";
  const saveResults = () => {
    fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  };
  test.afterEach(() => saveResults());

  test.afterAll(async () => {
    await purgeYear(Y_SUM);
    await purgeYear(Y_ANN);
    saveResults();
    console.log("\n=== TỔNG KẾT NHÓM C ===");
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}${r.note ? ` | ${r.note}` : ""}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ca đạt`);
  });

  // ================================================================== 1. /api/summary
  test("API Tổng hợp (2039): chỉ cộng phiếu đã duyệt, tham số sai, quyền", async () => {
    test.setTimeout(300_000);
    const G = "Summary";
    const dh = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(dh, Y_SUM);
    S.q1 = (await periodByCode(dh, Y_SUM, "Q1")).id;
    S.q2 = (await periodByCode(dh, Y_SUM, "Q2")).id;
    S.tb = (await unitByCode(dh, UNIT_TRAN_BIEN)).id;
    S.bl = (await unitByCode(dh, UNIT_BUU_LONG)).id;
    const tpl = await templateByCode(dh, TEMPLATE_1A);
    S.tplId = tpl.id;
    S.tplVersionId = (tpl as unknown as { currentVersion: { id: number } }).currentVersion.id;
    S.thTemplateId = (await templateByCode(dh, "BM-000003")).id;
    await setupAndOpen(dh, S.q1, [{ unitId: S.tb, templateId: S.tplId }, { unitId: S.bl, templateId: S.tplId }]);

    const uA = await Api.as(ACCOUNTS.donviBienHoa);
    const uB = await Api.as(ACCOUNTS.donviBuuLong);
    const rA = (await reportOf(uA, S.q1, S.tb)).id;
    const rB = (await reportOf(uB, S.q1, S.bl)).id;
    await unitSubmitsViaApi(uA, rA, 12, 1000);
    await unitSubmitsViaApi(uB, rB, 7, 500);

    const th = await Raw.as(ACCOUNTS.soTongHop);
    const sd = await Api.as(ACCOUNTS.soDuyet);
    const dataUrl = `/summary/data?periodId=${S.q1}&sourceSheetCode=${TEMPLATE_1A}`;
    check(G, "Hai phiếu mới nộp (chưa duyệt) → tổng = 0", { q: 0, a: 0 }, sum(parse(await th.send("get", dataUrl))));
    await sd.post(`/input_reports/${rA}/approve`);
    check(G, "Duyệt phiếu Trấn Biên → tổng = số Trấn Biên", { q: 12, a: 1000 }, sum(parse(await th.send("get", dataUrl))));
    await sd.post(`/input_reports/${rB}/return`, { reason: "E2E-C: số chưa khớp, đề nghị rà lại." });
    check(G, "Trả lại phiếu Bửu Long → tổng không đổi", { q: 12, a: 1000 }, sum(parse(await th.send("get", dataUrl))));
    const rB2 = (await reportOf(uB, S.q1, S.bl)).id;
    await resubmit(uB, rB2, 8, 600);
    check(G, "Bửu Long nộp lại (chờ duyệt) → tổng vẫn chỉ Trấn Biên", { q: 12, a: 1000 }, sum(parse(await th.send("get", dataUrl))));
    await sd.post(`/input_reports/${rB2}/approve`);
    check(G, "Duyệt phiếu Bửu Long nộp lại → tổng = 12+8 / 1000+600", { q: 20, a: 1600 }, sum(parse(await th.send("get", dataUrl))));
    const byOrg = parse<{ organizationCode: string; quantity: number }[]>(await th.send("get", `${dataUrl}&groupByOrg=true`));
    check(G, "groupByOrg=true tách đúng 2 đơn vị", [UNIT_BUU_LONG, UNIT_TRAN_BIEN].sort(), [...new Set(byOrg.map((r) => r.organizationCode))].sort());
    const one = parse<DataRow[]>(await th.send("get", `${dataUrl}&scopeKind=ORGANIZATION&organizationId=${S.tb}`));
    check(G, "Lọc phạm vi một đơn vị (Trấn Biên)", { q: 12, a: 1000 }, sum(one), `scopeKind=ORGANIZATION`);

    const sy = parse<{ indicatorCode: string; quantityHk1: number; amountHk1: number }[]>(await th.send("get", `/summary/school-year?schoolYear=${Y_SUM}&sourceSheetCode=${TEMPLATE_1A}`));
    check(G, "GET /school-year: nửa đầu năm = 20 / 1600", [20, 1600], [sy.find((r) => r.indicatorCode === "1a.1")?.quantityHk1, sy.find((r) => r.indicatorCode === "1a.1")?.amountHk1]);
    const years = parse<{ year: number }[]>(await th.send("get", `/summary/years`));
    check(G, "GET /years có năm 2039", true, years.some((y) => y.year === Y_SUM));
    const periods = parse<{ id: number; approvedUnits: number; assignedUnits: number }[]>(await th.send("get", `/summary/periods?year=${Y_SUM}`));
    const p1 = periods.find((p) => p.id === S.q1);
    check(G, "GET /periods: Q1 giao 2, duyệt 2", [2, 2], [p1?.assignedUnits, p1?.approvedUnits]);
    const ov = parse<{ units: unknown[]; sheets: { templateId: number }[] }>(await th.send("get", `/summary/periods/${S.q1}`));
    check(G, "GET /periods/{id}: 2 đơn vị, biểu 1a", [2, [S.tplId]], [ov.units.length, ov.sheets.map((s) => s.templateId)]);
    const ps = await th.send("get", `/summary/period_sheet?periodId=${S.q1}&templateId=${S.tplId}`);
    record(G, "GET /period_sheet hợp lệ", ps, OK);
    const orgs = parse<unknown[]>(await th.send("get", `/summary/period-organizations?periodId=${S.q1}`));
    check(G, "GET /period-organizations: 2 đơn vị", 2, orgs.length);
    const yr = parse<{ source: string; sheets: { templateId: number }[] }>(await th.send("get", `/summary/year?year=${Y_SUM}`));
    check(G, "GET /year: nguồn LIVE (chưa chốt kỳ), có biểu năm TH", ["LIVE", true], [yr.source, yr.sheets.some((s) => s.templateId === S.thTemplateId)]);
    record(G, "GET /year_sheet hợp lệ (biểu TH)", await th.send("get", `/summary/year_sheet?year=${Y_SUM}&templateId=${S.thTemplateId}`), OK);

    // Worst: tham số sai.
    record(G, "periods?year=1899 (ngoài khoảng 1900–2200)", await th.send("get", `/summary/periods?year=1899`), BAD);
    record(G, "periods?year=abc (chuỗi lạ)", await th.send("get", `/summary/periods?year=abc`), BAD);
    record(G, "periods thiếu year", await th.send("get", `/summary/periods`), BAD);
    record(G, "periods/{id} không tồn tại", await th.send("get", `/summary/periods/999999999`), [404]);
    record(G, "periods/abc", await th.send("get", `/summary/periods/abc`), BAD);
    record(G, "period_sheet templateId không tồn tại", await th.send("get", `/summary/period_sheet?periodId=${S.q1}&templateId=999999`), [400, 404, 409]);
    record(G, "period_sheet biểu không giao cho kỳ (1b)", await th.send("get", `/summary/period_sheet?periodId=${S.q1}&templateId=2`), [200, 400, 404, 409], "chấp nhận 200 nếu dựng khung rỗng");
    record(G, "period_sheet periodId không tồn tại", await th.send("get", `/summary/period_sheet?periodId=999999999&templateId=${S.tplId}`), [404]);
    record(G, "period_sheet scopeKind lạ", await th.send("get", `/summary/period_sheet?periodId=${S.q1}&templateId=${S.tplId}&scopeKind=HACK`), BAD);
    record(G, "data?periodId=abc", await th.send("get", `/summary/data?periodId=abc`), BAD);
    record(G, "data không có periodId lẫn from/to", await th.send("get", `/summary/data`), [200, 400], "200 chỉ đạt khi trả rỗng — xem ghi chú");
    record(G, "data from > to (ngày ngược)", await th.send("get", `/summary/data?from=${Y_SUM}-12-31&to=${Y_SUM}-01-01`), [200, 400]);
    record(G, "data from=2039-13-45 (ngày sai)", await th.send("get", `/summary/data?from=${Y_SUM}-13-45&to=${Y_SUM}-12-31`), BAD);
    record(G, "data scopeKind lạ", await th.send("get", `${dataUrl}&scopeKind=DROP%20TABLE`), BAD);
    record(G, "data sourceSheetCode không tồn tại", await th.send("get", `/summary/data?periodId=${S.q1}&sourceSheetCode=KHONG-CO`), [200, 400, 404]);
    record(G, "data periodId không tồn tại", await th.send("get", `/summary/data?periodId=999999999`), [404]);
    record(G, "year?year=2099 (năm không có lịch)", await th.send("get", `/summary/year?year=2099`), [200, 400, 404]);
    record(G, "year?year=99999", await th.send("get", `/summary/year?year=99999`), BAD);
    record(G, "year_sheet biểu chi tiết (không phải biểu năm)", await th.send("get", `/summary/year_sheet?year=${Y_SUM}&templateId=${S.tplId}`), [200, 400, 404, 409], "200 = máy chủ dựng cả biểu chi tiết theo năm (chỉ đọc, không lộ thêm)");
    record(G, "school-year?schoolYear=1800", await th.send("get", `/summary/school-year?schoolYear=1800`), BAD);
    record(G, "period-organizations periodId không tồn tại", await th.send("get", `/summary/period-organizations?periodId=999999999`), [404]);

    // Ảnh chụp.
    record(G, "POST /snapshot hợp lệ", await th.send("post", `/summary/snapshot`, { periodId: S.q1, templateVersionId: S.tplVersionId, workbookJson: "{\"sheets\":{}}" }), OK);
    record(G, "POST /snapshot thiếu workbookJson", await th.send("post", `/summary/snapshot`, { periodId: S.q1, templateVersionId: S.tplVersionId }), BAD);
    record(G, "POST /snapshot thiếu periodId", await th.send("post", `/summary/snapshot`, { templateVersionId: S.tplVersionId, workbookJson: "{}" }), BAD);
    record(G, "POST /snapshot templateVersionId không tồn tại", await th.send("post", `/summary/snapshot`, { periodId: S.q1, templateVersionId: 999999, workbookJson: "{}" }), [400, 404, 409]);
    record(G, "POST /snapshot periodId không tồn tại", await th.send("post", `/summary/snapshot`, { periodId: 999999999, templateVersionId: S.tplVersionId, workbookJson: "{}" }), [400, 404, 409]);

    // Cheating: vai trò không có quyền tổng hợp.
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    const dhRaw = await Raw.as(ACCOUNTS.soDieuHanh);
    const anon = await Raw.as(null);
    for (const [who, c] of [["Đơn vị (donvi.bienhoa)", unit], ["so.duyet", soDuyet], ["ubnd.duyet", ubnd]] as const) {
      record(G, `${who} GET /summary/data`, await c.send("get", dataUrl), NO_ACCESS);
      record(G, `${who} GET /summary/periods`, await c.send("get", `/summary/periods?year=${Y_SUM}`), NO_ACCESS);
      record(G, `${who} POST /summary/snapshot`, await c.send("post", `/summary/snapshot`, { periodId: S.q1, templateVersionId: S.tplVersionId, workbookJson: "{}" }), NO_ACCESS);
    }
    record(G, "Đơn vị GET /period-organizations (lộ danh sách đơn vị)", await unit.send("get", `/summary/period-organizations?periodId=${S.q1}`), NO_ACCESS);
    record(G, "ubnd.duyet GET /period-organizations (cho phép theo thiết kế)", await ubnd.send("get", `/summary/period-organizations?periodId=${S.q1}`), OK);
    record(G, "so.dieuhanh (chỉ summary:read) POST /snapshot", await dhRaw.send("post", `/summary/snapshot`, { periodId: S.q1, templateVersionId: S.tplVersionId, workbookJson: "{}" }), NO_ACCESS);
    record(G, "Không token GET /summary/data", await anon.send("get", dataUrl), [401]);
    const fake = await Raw.as(null, "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzby50b25naG9wIn0.");
    record(G, "Token giả alg=none GET /summary/years", await fake.send("get", `/summary/years`), [401]);
    for (const c of [th, unit, soDuyet, ubnd, dhRaw, anon, fake]) await c.dispose();
    for (const c of [dh, uA, uB, sd]) await c.dispose();
  });

  // ================================================================== 2. /api/dept_reports + /api/dept_years
  test("API sổ Sở (2039): lưu kỳ, biểu, phiên bản, khôi phục, quyền", async () => {
    test.setTimeout(300_000);
    const G = "DeptReports";
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const th = await Raw.as(ACCOUNTS.soTongHop);
    record(G, "POST /dept_reports khi kỳ chưa chốt đợt", await th.send("post", `/dept_reports`, { periodId: S.q1 }), [409]);
    record(G, "Chốt đợt Q1 (so.dieuhanh) — tự lưu sổ Sở", await dh.send("post", `/report_periods/${S.q1}/close`), OK);
    const list = parse<{ id: number; periodId: number; ledgerVersion: number; sourceCount: number }[]>(await th.send("get", `/dept_reports?year=${Y_SUM}`));
    check(G, "GET /dept_reports?year: 1 kỳ, 2 phiếu nguồn, phiên bản 1", [1, S.q1, 2, 1], [list.length, list[0]?.periodId, list[0]?.sourceCount, list[0]?.ledgerVersion]);
    S.deptId = list[0]!.id;
    const id = S.deptId;
    check(G, "Sổ Sở kỳ Q1 biểu 1a = 20 / 1600 (chỉ phiếu đã duyệt)", { q: 20, a: 1600 }, sum(parse(await th.send("get", `/dept_reports/${id}/sheets/${TEMPLATE_1A}/data`))));
    check(G, "GET /dept_years/2039/data = 20 / 1600", { q: 20, a: 1600 }, sum(parse(await th.send("get", `/dept_years/${Y_SUM}/data?sourceSheetCode=${TEMPLATE_1A}`))));
    record(G, "GET /dept_years/2039/versions/1/data", await th.send("get", `/dept_years/${Y_SUM}/versions/1/data`), OK);
    record(G, "GET /dept_years/2039/periods", await th.send("get", `/dept_years/${Y_SUM}/periods`), OK);
    record(G, "GET /dept_years/2039/history", await th.send("get", `/dept_years/${Y_SUM}/history`), OK);
    record(G, "GET /dept_years/2039/versions/99/data (không có)", await th.send("get", `/dept_years/${Y_SUM}/versions/99/data`), BAD);
    record(G, "GET /dept_years/2039/versions/0/data", await th.send("get", `/dept_years/${Y_SUM}/versions/0/data`), BAD);
    record(G, "GET /dept_years/1800/data", await th.send("get", `/dept_years/1800/data`), BAD);
    record(G, "GET /dept_years/abc/data", await th.send("get", `/dept_years/abc/data`), BAD);

    record(G, "GET /dept_reports/{id}", await th.send("get", `/dept_reports/${id}`), OK);
    record(G, "GET /dept_reports/{id}/sheets/BM-000001 (mã)", await th.send("get", `/dept_reports/${id}/sheets/${TEMPLATE_1A}`), OK);
    record(G, "GET /dept_reports/{id}/sheets/{templateId} (số)", await th.send("get", `/dept_reports/${id}/sheets/${S.tplId}`), OK);
    record(G, "GET …/sheets/{sheet}/versions/1/data", await th.send("get", `/dept_reports/${id}/sheets/${S.tplId}/versions/1/data`), OK);
    record(G, "GET …/sheets/{sheet}/versions/99/data", await th.send("get", `/dept_reports/${id}/sheets/${S.tplId}/versions/99/data`), BAD);
    record(G, "GET …/sheets/KHONG-CO", await th.send("get", `/dept_reports/${id}/sheets/KHONG-CO`), [404]);
    record(G, "GET …/sheets/2 (biểu không thuộc kỳ)", await th.send("get", `/dept_reports/${id}/sheets/2`), [404]);
    record(G, "GET /dept_reports/999999999", await th.send("get", `/dept_reports/999999999`), [404]);
    record(G, "GET /dept_reports?year=abc", await th.send("get", `/dept_reports?year=abc`), BAD);
    record(G, "GET /dept_reports?year=1899", await th.send("get", `/dept_reports?year=1899`), BAD);

    record(G, "POST /dept_reports lại kỳ đã lưu (bấm đúp)", await th.send("post", `/dept_reports`, { periodId: S.q1 }), [409]);
    record(G, "POST /dept_reports kỳ Q2 chưa thiết lập / chưa chốt", await th.send("post", `/dept_reports`, { periodId: S.q2 }), [409]);
    record(G, "POST /dept_reports thiếu periodId", await th.send("post", `/dept_reports`, {}), BAD);
    record(G, "POST /dept_reports periodId không tồn tại", await th.send("post", `/dept_reports`, { periodId: 999999999 }), [404]);

    // Biểu 1a không có hook getSummaryData → Sở không sửa số trực tiếp.
    const rt = parse<{ revision: number; summaryHook: boolean }>(await th.send("get", `/dept_reports/${id}/sheets/${S.tplId}`));
    record(G, "PUT draft khi biểu không có hook sửa số", await th.send("put", `/dept_reports/${id}/sheets/${S.tplId}/draft`, { workbookJson: "{\"sheets\":{}}", revision: rt.revision }), [409], `summaryHook=${rt.summaryHook}`);
    record(G, "PUT draft workbookJson rỗng", await th.send("put", `/dept_reports/${id}/sheets/${S.tplId}/draft`, { workbookJson: "", revision: rt.revision }), BAD);
    record(G, "PUT draft thiếu revision", await th.send("put", `/dept_reports/${id}/sheets/${S.tplId}/draft`, { workbookJson: "{}" }), BAD);
    record(G, "GET …/sheets/{sheet}/preview (chưa có bảng sửa)", await th.send("get", `/dept_reports/${id}/sheets/${S.tplId}/preview`), [200, 409]);
    record(G, "GET /{id}/preview", await th.send("get", `/dept_reports/${id}/preview`), OK);
    record(G, "POST complete lý do 1001 ký tự", await th.send("post", `/dept_reports/${id}/sheets/${S.tplId}/complete`, { reason: "x".repeat(1001) }), BAD);
    // Mass assignment: kèm trường lạ khi hoàn tất.
    const done = await th.send("post", `/dept_reports/${id}/sheets/${S.tplId}/complete`, { reason: "E2E-C hoàn tất", completion: "IN_PROGRESS", ledgerVersion: 99, reportYear: 2000 });
    record(G, "POST complete (chưa có bảng sửa → chỉ đánh dấu hoàn tất)", done, OK);
    const afterDone = parse<{ ledgerVersion: number; reportYear: number; sheets: { completion: string }[] }>(await th.send("get", `/dept_reports/${id}`));
    check(G, "Trường lạ khi hoàn tất không có tác dụng (ledgerVersion/reportYear/completion)", [1, Y_SUM, "COMPLETED"], [afterDone.ledgerVersion, afterDone.reportYear, afterDone.sheets[0]?.completion]);
    record(G, "POST complete lần hai (biểu đã hoàn tất)", await th.send("post", `/dept_reports/${id}/sheets/${S.tplId}/complete`, {}), [409]);
    record(G, "PUT draft khi biểu đã hoàn tất", await th.send("put", `/dept_reports/${id}/sheets/${S.tplId}/draft`, { workbookJson: "{}", revision: rt.revision }), [409]);
    record(G, "POST reopen (Sửa lại)", await th.send("post", `/dept_reports/${id}/sheets/${S.tplId}/reopen`), OK);
    const commit = await th.send("post", `/dept_reports/${id}/commit`, { reason: "E2E-C" });
    record(G, "POST commit khi biểu chưa hoàn tất & không có bảng sửa dở", commit, [200, 409], "200 hợp lệ nếu không tạo phiên bản mới");
    if (commit.status === 200) check(G, "commit không có gì thay đổi → không tiêu phiên bản", false, parse<{ newVersion: boolean }>(commit).newVersion);
    record(G, "POST commit lý do 1001 ký tự", await th.send("post", `/dept_reports/${id}/commit`, { reason: "y".repeat(1001) }), BAD);
    record(G, "POST discard", await th.send("post", `/dept_reports/${id}/discard`), OK);
    record(G, "GET /{id}/versions", await th.send("get", `/dept_reports/${id}/versions`), OK);
    record(G, "GET /{id}/history", await th.send("get", `/dept_reports/${id}/history`), OK);
    record(G, "GET /{id}/compare?versionA=1&versionB=1", await th.send("get", `/dept_reports/${id}/compare?versionA=1&versionB=1`), OK);
    record(G, "GET /{id}/compare versionB=99 (không có)", await th.send("get", `/dept_reports/${id}/compare?versionA=1&versionB=99`), BAD);
    record(G, "GET /{id}/compare versionA=abc", await th.send("get", `/dept_reports/${id}/compare?versionA=abc&versionB=1`), BAD);
    record(G, "GET /{id}/compare thiếu tham số", await th.send("get", `/dept_reports/${id}/compare`), BAD);
    const rs = await th.send("post", `/dept_reports/${id}/restore`, { versionNo: 1, reason: "E2E-C khôi phục" });
    record(G, "POST restore về phiên bản 1 (hiện hành)", rs, OK);
    record(G, "POST restore phiên bản 999 (không tồn tại)", await th.send("post", `/dept_reports/${id}/restore`, { versionNo: 999 }), BAD);
    record(G, "POST restore phiên bản 0", await th.send("post", `/dept_reports/${id}/restore`, { versionNo: 0 }), BAD);
    record(G, "POST restore phiên bản -1", await th.send("post", `/dept_reports/${id}/restore`, { versionNo: -1 }), BAD);
    record(G, "POST restore thiếu versionNo", await th.send("post", `/dept_reports/${id}/restore`, {}), BAD);
    record(G, "POST restore versionNo=\"abc\"", await th.send("post", `/dept_reports/${id}/restore`, { versionNo: "abc" }), BAD);
    record(G, "POST restore dept report không tồn tại", await th.send("post", `/dept_reports/999999999/restore`, { versionNo: 1 }), [404]);
    check(G, "Sau mọi thao tác, sổ Sở vẫn 20 / 1600", { q: 20, a: 1600 }, sum(parse(await th.send("get", `/dept_years/${Y_SUM}/data?sourceSheetCode=${TEMPLATE_1A}`))));

    // Cheating.
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    for (const [who, c] of [["Đơn vị", unit], ["so.duyet", soDuyet], ["ubnd.duyet", ubnd]] as const) {
      record(G, `${who} GET /dept_reports?year`, await c.send("get", `/dept_reports?year=${Y_SUM}`), NO_ACCESS);
      record(G, `${who} GET /dept_reports/{id}/sheets/1/data`, await c.send("get", `/dept_reports/${id}/sheets/${S.tplId}/data`), NO_ACCESS);
      record(G, `${who} GET /dept_years/2039/data`, await c.send("get", `/dept_years/${Y_SUM}/data`), NO_ACCESS);
      record(G, `${who} POST /dept_reports/{id}/restore`, await c.send("post", `/dept_reports/${id}/restore`, { versionNo: 1 }), NO_ACCESS);
      record(G, `${who} POST /dept_reports/{id}/sheets/1/complete`, await c.send("post", `/dept_reports/${id}/sheets/${S.tplId}/complete`, {}), NO_ACCESS);
    }
    record(G, "so.dieuhanh (chỉ đọc) POST commit", await dh.send("post", `/dept_reports/${id}/commit`, {}), NO_ACCESS);
    record(G, "so.dieuhanh (chỉ đọc) POST /dept_reports", await dh.send("post", `/dept_reports`, { periodId: S.q1 }), NO_ACCESS);
    record(G, "so.dieuhanh (chỉ đọc) PUT draft", await dh.send("put", `/dept_reports/${id}/sheets/${S.tplId}/draft`, { workbookJson: "{}", revision: 0 }), NO_ACCESS);
    for (const c of [dh, th, unit, soDuyet, ubnd]) await c.dispose();
  });

  // ================================================================== 3. /api/asxh_dashboard
  test("API Trang chủ (2039): số liệu đúng theo vai trò, tham số sai", async () => {
    const G = "Dashboard";
    type Dash = { kpi: { counts: { total: number; approved: number; pending: number } }; capabilities: { viewUnits: boolean; approve: boolean }; units: { summary: { unitCount: number } } | null; periods: { id: number }[] };
    const expectAll = { total: 2, approved: 2 };
    for (const [who, acc, exp] of [
      ["so.tonghop", ACCOUNTS.soTongHop, expectAll],
      ["so.duyet", ACCOUNTS.soDuyet, expectAll],
      ["so.dieuhanh", ACCOUNTS.soDieuHanh, expectAll],
      ["admin", ACCOUNTS.admin, expectAll],
      ["donvi.bienhoa (chỉ phiếu của mình)", ACCOUNTS.donviBienHoa, { total: 1, approved: 1 }],
      ["donvi.buulong (chỉ phiếu của mình)", ACCOUNTS.donviBuuLong, { total: 1, approved: 1 }],
    ] as const) {
      const c = await Raw.as(acc);
      const g = await c.send("get", `/asxh_dashboard?year=${Y_SUM}&units=true`);
      if (g.status !== 200) {
        record(G, `${who}: GET /asxh_dashboard`, g, OK);
      } else {
        const d = parse<Dash>(g);
        check(G, `${who}: tổng phiếu / đã duyệt năm 2039`, exp, { total: d.kpi.counts.total, approved: d.kpi.counts.approved }, `viewUnits=${d.capabilities.viewUnits} approve=${d.capabilities.approve} units=${d.units ? d.units.summary.unitCount : "null"}`);
      }
      await c.dispose();
    }
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const dd = parse<Dash>(await dh.send("get", `/asxh_dashboard?year=${Y_SUM}&units=true`));
    check(G, "so.dieuhanh units=true: có bảng Theo đơn vị (0 đơn vị vì Q1 đã chốt — chỉ đếm kỳ đang nhận)", [true, 0], [dd.units !== null, dd.units?.summary.unitCount ?? null]);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const du = parse<Dash>(await unit.send("get", `/asxh_dashboard?year=${Y_SUM}&units=true`));
    check(G, "Đơn vị gửi units=true không lấy được bảng đơn vị", null, du.units);
    record(G, "year=1999 (ngoài khoảng)", await dh.send("get", `/asxh_dashboard?year=1999`), BAD);
    record(G, "year=abc", await dh.send("get", `/asxh_dashboard?year=abc`), BAD);
    record(G, "year=2101", await dh.send("get", `/asxh_dashboard?year=2101`), BAD);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    record(G, "ubnd.duyet (không có input_reports:read) GET /asxh_dashboard", await ubnd.send("get", `/asxh_dashboard?year=${Y_SUM}`), [200, 403], "ghi lại hành vi");
    const anon = await Raw.as(null);
    record(G, "Không token GET /asxh_dashboard", await anon.send("get", `/asxh_dashboard`), [401]);
    for (const c of [dh, unit, ubnd, anon]) await c.dispose();
  });

  // ================================================================== 4. Báo cáo năm — dựng 2038 + worst trước khi nộp
  test("API báo cáo năm (2038): dựng số liệu, nộp sai, vượt quyền trước khi nộp", async () => {
    test.setTimeout(300_000);
    const G = "Annual-trước-nộp";
    const dh = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(dh, Y_ANN);
    S.aQ1 = (await periodByCode(dh, Y_ANN, "Q1")).id;
    S.aQ2 = (await periodByCode(dh, Y_ANN, "Q2")).id;
    S.aTb = S.tb;
    S.aBl = S.bl;
    await setupAndOpen(dh, S.aQ1, [{ unitId: S.aTb, templateId: S.tplId }, { unitId: S.aBl, templateId: S.tplId }]);
    const uA = await Api.as(ACCOUNTS.donviBienHoa);
    const uB = await Api.as(ACCOUNTS.donviBuuLong);
    const sd = await Api.as(ACCOUNTS.soDuyet);
    const a1 = (await reportOf(uA, S.aQ1, S.aTb)).id;
    const b1 = (await reportOf(uB, S.aQ1, S.aBl)).id;
    await unitSubmitsViaApi(uA, a1, 30, 3000);
    await unitSubmitsViaApi(uB, b1, 10, 1000);
    await sd.post(`/input_reports/${a1}/approve`);
    await sd.post(`/input_reports/${b1}/approve`);
    await dh.post(`/report_periods/${S.aQ1}/close`);
    // Q2 mở: Trấn Biên nhập dở, Bửu Long đã nộp chờ duyệt — để thử sửa / duyệt sau khi năm bị khoá.
    await setupAndOpen(dh, S.aQ2, [{ unitId: S.aTb, templateId: S.tplId }, { unitId: S.aBl, templateId: S.tplId }]);
    S.aQ2TbReport = (await reportOf(uA, S.aQ2, S.aTb)).id;
    S.aQ2TbSheet = (await sheetsOf(uA, S.aQ2TbReport))[0]!.id;
    S.aQ2BlReport = (await reportOf(uB, S.aQ2, S.aBl)).id;
    await unitSubmitsViaApi(uB, S.aQ2BlReport, 5, 500);

    const th = await Raw.as(ACCOUNTS.soTongHop);
    const st = parse<{ canSubmit: boolean; blocker: string | null; savedPeriods: number; ledgerVersion: number }>(await th.send("get", `/annual_reports/year_status?year=${Y_ANN}`));
    check(G, "year_status 2038: nộp được, 1 kỳ đã lưu", [true, null, 1], [st.canSubmit, st.blocker, st.savedPeriods]);
    S.aDeptId = parse<{ id: number }[]>(await th.send("get", `/dept_reports?year=${Y_ANN}`))[0]!.id;
    const docDate = `${Y_ANN}-12-20`;
    const pdf = tinyPdf("to-trinh.pdf");
    record(G, "Nộp thiếu số văn bản", await th.submitAnnual({ year: String(Y_ANN), docDate }, [pdf]), BAD);
    record(G, "Nộp số văn bản toàn khoảng trắng", await th.submitAnnual({ year: String(Y_ANN), docNo: "   ", docDate }, [pdf]), BAD);
    record(G, "Nộp thiếu ngày văn bản", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C" }, [pdf]), BAD);
    record(G, "Nộp ngày văn bản sai định dạng (31/12/2038)", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate: "31/12/2038" }, [pdf]), BAD);
    record(G, "Nộp số văn bản 51 ký tự", await th.submitAnnual({ year: String(Y_ANN), docNo: "X".repeat(51), docDate }, [pdf]), BAD);
    record(G, "Nộp năm=abc", await th.submitAnnual({ year: "abc", docNo: "01/E2E-C", docDate }, [pdf]), BAD);
    record(G, "Nộp năm 1899", await th.submitAnnual({ year: "1899", docNo: "01/E2E-C", docDate }, [pdf]), BAD);
    record(G, "Nộp năm 2037 (chưa có số liệu)", await th.submitAnnual({ year: "2037", docNo: "01/E2E-C", docDate }, [pdf]), [409]);
    record(G, "Đính kèm .exe", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [{ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ\x90\x00", "latin1") }]), BAD);
    record(G, "Đính kèm .pdf giả (nội dung EXE)", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [{ name: "to-trinh.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\x90\x00 fake", "latin1") }]), BAD);
    record(G, "Đính kèm .html (XSS)", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [{ name: "x.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") }]), BAD);
    record(G, "Đính kèm .png giả (nội dung text)", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [{ name: "anh.png", mimeType: "image/png", buffer: Buffer.from("hello") }]), BAD);
    record(G, "Đính kèm 11 file (quá trần 10)", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, Array.from({ length: 11 }, (_, i) => tinyPdf(`f${i}.pdf`))), BAD);
    record(G, "Tên file 300 ký tự", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [tinyPdf(`${"a".repeat(296)}.pdf`)]), BAD);
    record(G, "Đính kèm file 0 byte tên .pdf", await th.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [{ name: "rong.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) }]), BAD);

    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    record(G, "UBND duyệt báo cáo năm không tồn tại", await ubnd.send("post", `/annual_reports/999999999/approve`), [404]);
    record(G, "UBND trả lại báo cáo không tồn tại", await ubnd.send("post", `/annual_reports/999999999/return`, { reason: "x" }), [404]);
    record(G, "GET /annual_reports/999999999", await ubnd.send("get", `/annual_reports/999999999`), [404]);
    record(G, "GET /annual_reports/year_status?year=abc", await ubnd.send("get", `/annual_reports/year_status?year=abc`), BAD);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    record(G, "Đơn vị nộp báo cáo năm", await unit.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [pdf]), NO_ACCESS);
    record(G, "so.duyet nộp báo cáo năm", await soDuyet.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [pdf]), NO_ACCESS);
    record(G, "ubnd.duyet (không có write) nộp báo cáo năm", await ubnd.submitAnnual({ year: String(Y_ANN), docNo: "01/E2E-C", docDate }, [pdf]), NO_ACCESS);
    record(G, "Đơn vị GET /annual_reports", await unit.send("get", `/annual_reports?year=${Y_ANN}`), NO_ACCESS);
    record(G, "Đơn vị GET /annual_reports/year_status", await unit.send("get", `/annual_reports/year_status?year=${Y_ANN}`), NO_ACCESS);
    record(G, "so.duyet GET /annual_reports", await soDuyet.send("get", `/annual_reports?year=${Y_ANN}`), NO_ACCESS);
    const none = parse<unknown[]>(await th.send("get", `/annual_reports?year=${Y_ANN}`));
    check(G, "Sau các lần nộp sai: chưa có phiếu năm nào", 0, none.length);
    for (const c of [th, ubnd, unit, soDuyet]) await c.dispose();
    for (const c of [dh, uA, uB, sd]) await c.dispose();
  });

  // ================================================================== 5. UI: Sở nộp năm → khoá năm (API) → UBND trả lại
  async function openYear(page: Page) {
    await page.goto("/summary");
    await page.getByRole("tab", { name: "Theo năm" }).click();
    await page.getByRole("option", { name: new RegExp(`Năm ${Y_ANN}`) }).click();
    await expect(page.getByText(`Báo cáo năm ${Y_ANN}`).first()).toBeVisible();
  }
  async function submitYear(page: Page, verb: "Nộp" | "Gửi lại", docNo: string) {
    await page.getByRole("button", { name: `${verb} báo cáo năm`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `${verb} báo cáo năm ${Y_ANN} lên UBND?` });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Số văn bản").fill(docNo);
    await dialog.locator('input[type="file"]').setInputFiles(tinyPdf("to-trinh-ubnd.pdf"));
    await expect(dialog.getByText("to-trinh-ubnd.pdf")).toBeVisible();
    await dialog.getByLabel(`Tôi xác nhận gửi báo cáo năm ${Y_ANN} lên UBND`).click();
    await dialog.getByRole("button", { name: `${verb} báo cáo năm ${Y_ANN}` }).click();
  }
  async function openForReview(page: Page, revisionNo: number) {
    await page.goto("/annual-review/history?nam=" + Y_ANN);
    await page.waitForLoadState("networkidle");
    const id = [S.ann1, S.ann2, S.ann3][revisionNo - 1];
    await page.goto(`/annual-review/${id}`);
    await expect(page.getByText(`Báo cáo năm ${Y_ANN} · Phiếu ${revisionNo}`).first()).toBeVisible({ timeout: 60_000 });
  }
  async function annualList(): Promise<{ id: number; revisionNo: number; status: string; returnReason?: string | null }[]> {
    const api = await Api.as(ACCOUNTS.soTongHop);
    const rows = await api.get<{ id: number; revisionNo: number; status: string }[]>(`/annual_reports?year=${Y_ANN}`);
    await api.dispose();
    return rows.sort((a, b) => a.revisionNo - b.revisionNo);
  }

  test("UI + API: Sở nộp Phiếu 1 → năm khoá → UBND trả lại", async ({ page }) => {
    test.setTimeout(300_000);
    const G = "Annual-UI-1";
    const errs = watch(page);
    await useReportYear(page, Y_ANN);
    await login(page, ACCOUNTS.soTongHop);
    await openYear(page);
    await submitYear(page, "Nộp", `01/TTr-STC-E2E-C`);
    await expectToast(page, `Đã nộp Phiếu 1 báo cáo năm ${Y_ANN} lên UBND.`);
    await expect(page.getByText("Chờ UBND duyệt").first()).toBeVisible();
    const l1 = await annualList();
    check(G, "UI so.tonghop nộp Phiếu 1 → submitted", ["submitted"], l1.map((r) => r.status));
    S.ann1 = l1[0]!.id;
    const viewBtn = await page.getByRole("button", { name: "Xem phiếu", exact: true }).count();
    const submitBtn = await page.getByRole("button", { name: "Nộp báo cáo năm", exact: true }).count();
    check(G, "UI sau khi nộp: nút đổi thành 'Xem phiếu', không còn 'Nộp báo cáo năm'", [true, 0], [viewBtn > 0, submitBtn]);

    // API khi năm đang khoá (SUBMITTED).
    const A = "Annual-khoá-năm";
    const th = await Raw.as(ACCOUNTS.soTongHop);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    const unitA = await Raw.as(ACCOUNTS.donviBienHoa);
    const uAApi = await Api.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const docDate = `${Y_ANN}-12-21`;
    record(A, "Nộp năm lần hai khi đang chờ duyệt", await th.submitAnnual({ year: String(Y_ANN), docNo: "02/E2E-C", docDate }, [tinyPdf()]), [409]);
    const detail = parse<{ sheets: { templateId: number }[]; attachments: { id: number; fileName: string }[] }>(await ubnd.send("get", `/annual_reports/${S.ann1}`));
    check(G, "GET /annual_reports/{id}: 1 biểu năm, 1 file", [1, 1], [detail.sheets.length, detail.attachments.length]);
    record(G, "UBND GET /annual_reports?year", await ubnd.send("get", `/annual_reports?year=${Y_ANN}`), OK);
    record(G, "UBND GET /{id}/sheets/{templateId}", await ubnd.send("get", `/annual_reports/${S.ann1}/sheets/${detail.sheets[0]!.templateId}`), OK);
    record(G, "UBND GET /{id}/sheets/1 (biểu không thuộc phiếu)", await ubnd.send("get", `/annual_reports/${S.ann1}/sheets/${S.tplId}`), [404]);
    check(G, "UBND GET /{id}/data = sổ Sở 2038 (40 / 4000)", { q: 40, a: 4000 }, sum(parse(await ubnd.send("get", `/annual_reports/${S.ann1}/data?sourceSheetCode=${TEMPLATE_1A}`))));
    record(G, "UBND GET /{id}/attachments", await ubnd.send("get", `/annual_reports/${S.ann1}/attachments`), OK);
    const att = detail.attachments[0]!;
    const dl = await ubnd.head(`/annual_reports/${S.ann1}/attachments/${att.id}/content`);
    check(G, "Tải file phiếu nộp: 200, application/pdf", [200, true], [dl.status, dl.type.includes("pdf")], dl.disp);
    record(G, "Tải file với attachmentId không thuộc phiếu", await ubnd.send("get", `/annual_reports/${S.ann1}/attachments/999999999/content`), [404]);
    record(G, "Đơn vị tải file phiếu nộp năm", await unitA.send("get", `/annual_reports/${S.ann1}/attachments/${att.id}/content`), NO_ACCESS);
    record(G, "Đơn vị GET /annual_reports/{id}/data", await unitA.send("get", `/annual_reports/${S.ann1}/data`), NO_ACCESS);
    record(G, "Đơn vị UBND-duyệt báo cáo năm", await unitA.send("post", `/annual_reports/${S.ann1}/approve`), NO_ACCESS);
    record(G, "so.duyet duyệt báo cáo năm", await soDuyet.send("post", `/annual_reports/${S.ann1}/approve`), NO_ACCESS);
    record(A, "UBND mở lại phiếu đang chờ (chưa duyệt)", await ubnd.send("post", `/annual_reports/${S.ann1}/reopen`, { reason: "x" }), [409]);
    record(A, "UBND trả lại không lý do", await ubnd.send("post", `/annual_reports/${S.ann1}/return`, { reason: "   " }), BAD);
    record(A, "UBND trả lại không có body", await ubnd.send("post", `/annual_reports/${S.ann1}/return`), BAD);
    record(A, "UBND trả lại lý do 1001 ký tự", await ubnd.send("post", `/annual_reports/${S.ann1}/return`, { reason: "z".repeat(1001) }), BAD);

    // Sửa dữ liệu năm đã khoá.
    const detailQ2 = await uAApi.get<{ version: number; templateWorkbookJson: string; dataJson?: string | null }>(`/input_report_sheets/${S.aQ2TbSheet}`);
    record(A, "Đơn vị lưu biểu kỳ Q2 của năm đã nộp", await unitA.send("put", `/input_report_sheets/${S.aQ2TbSheet}`, { dataJson: detailQ2.dataJson || detailQ2.templateWorkbookJson, version: detailQ2.version }), [409]);
    record(A, "Đơn vị hoàn tất biểu kỳ Q2", await unitA.send("post", `/input_report_sheets/${S.aQ2TbSheet}/complete`), [409]);
    record(A, "Đơn vị nộp phiếu kỳ Q2 (năm khoá)", await unitA.send("post", `/input_reports/${S.aQ2TbReport}/submit`), [409]);
    record(A, "Sở duyệt phiếu Bửu Long kỳ Q2 (năm khoá)", await soDuyet.send("post", `/input_reports/${S.aQ2BlReport}/approve`), [409]);
    record(A, "Sở trả lại phiếu Bửu Long kỳ Q2 (năm khoá)", await soDuyet.send("post", `/input_reports/${S.aQ2BlReport}/return`, { reason: "E2E-C trả lại khi năm khoá" }), [409]);
    record(A, "Sổ Sở: hoàn tất biểu Q1 khi năm khoá", await th.send("post", `/dept_reports/${S.aDeptId}/sheets/${S.tplId}/complete`, {}), [409]);
    record(A, "Sổ Sở: khôi phục phiên bản khi năm khoá", await th.send("post", `/dept_reports/${S.aDeptId}/restore`, { versionNo: 1 }), [409]);
    record(A, "Sổ Sở: commit khi năm khoá", await th.send("post", `/dept_reports/${S.aDeptId}/commit`, {}), [409]);
    record(A, "Sổ Sở: discard khi năm khoá", await th.send("post", `/dept_reports/${S.aDeptId}/discard`), [409]);
    record(A, "Sổ Sở: reopen biểu khi năm khoá", await th.send("post", `/dept_reports/${S.aDeptId}/sheets/${S.tplId}/reopen`), [409]);
    const q3 = (await periodByCode(await Api.as(ACCOUNTS.soDieuHanh), Y_ANN, "Q3")).id;
    record(A, "Điều hành thiết lập kỳ Q3 của năm đã nộp", await dh.send("put", `/period_assignments/matrix`, { periodId: q3, add: [{ unitId: S.aTb, templateId: S.tplId }], remove: [] }), [409]);
    record(A, "Điều hành chốt đợt Q2 (năm khoá)", await dh.send("post", `/report_periods/${S.aQ2}/close`), [409]);
    const tbStatus = (await uAApi.get<{ status: string }>(`/input_reports/${S.aQ2TbReport}`)).status;
    check(A, "Phiếu Q2 Trấn Biên vẫn Đang nhập", "DRAFT", tbStatus);

    // UBND trả lại qua UI.
    await logout(page);
    await login(page, ACCOUNTS.ubndDuyet);
    await page.goto("/annual-review");
    const row = page.getByRole("row").filter({ hasText: `Phiếu 1` }).filter({ hasText: String(Y_ANN) });
    await row.getByRole("button", { name: "Duyệt báo cáo" }).click();
    await expect(page.getByText(`Báo cáo năm ${Y_ANN} · Phiếu 1`).first()).toBeVisible({ timeout: 60_000 });
    check(G, "UI UBND phiếu chờ: có nút Phê duyệt + Trả lại", [1, 1], [await page.getByRole("button", { name: "Phê duyệt", exact: true }).count(), await page.getByRole("button", { name: "Trả lại", exact: true }).count()]);
    await page.getByRole("button", { name: "Trả lại", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Trả lại báo cáo năm ${Y_ANN}` });
    // Worst UI: gửi lý do trống.
    await dialog.getByRole("button", { name: `Trả lại báo cáo năm ${Y_ANN}` }).click();
    await page.waitForTimeout(800);
    check(G, "UI trả lại lý do trống: hộp thoại vẫn mở, chưa trả lại", [true, "submitted"], [await dialog.isVisible(), (await annualList())[0]!.status]);
    await dialog.getByLabel("Lý do trả lại").fill("E2E-C: đề nghị bổ sung thuyết minh quý I.");
    await dialog.getByRole("button", { name: `Trả lại báo cáo năm ${Y_ANN}` }).click();
    await expectToast(page, `Đã trả lại báo cáo năm ${Y_ANN} cho Sở Tài chính.`);
    check(G, "UI UBND trả lại → returned", ["returned"], (await annualList()).map((r) => r.status));
    record(A, "Sau khi trả lại: UBND duyệt phiếu đã trả lại", await ubnd.send("post", `/annual_reports/${S.ann1}/approve`), [409]);
    record(A, "Sau khi trả lại: năm mở khoá — đơn vị lưu được biểu Q2", await unitA.send("put", `/input_report_sheets/${S.aQ2TbSheet}`, { dataJson: detailQ2.dataJson || detailQ2.templateWorkbookJson, version: detailQ2.version }), OK);
    recordErrors(G, "Trang nộp/duyệt năm (phiếu 1)", errs);
    for (const c of [th, ubnd, unitA, soDuyet, dh]) await c.dispose();
    await uAApi.dispose();
  });

  // ================================================================== 6. Gửi lại qua API (mass assignment) + Sở tự duyệt + mở lại (XSS)
  test("API: gửi lại Phiếu 2 kèm trường lạ, so.tonghop tự duyệt, UBND mở lại", async () => {
    const G = "Annual-gửi-lại";
    const th = await Raw.as(ACCOUNTS.soTongHop);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    const r = await th.submitAnnual({ year: String(Y_ANN), docNo: "02/E2E-C", docDate: `${Y_ANN}-12-22`, status: "approved", revisionNo: "99", ledgerVersion: "999", submittedBy: "ubnd.duyet" }, [tinyPdf("p2.pdf")]);
    record(G, "Gửi lại Phiếu 2 kèm trường lạ status/revisionNo/ledgerVersion/submittedBy", r, OK);
    const l = await annualList();
    const p2 = l.find((x) => x.revisionNo !== 1) as { id: number; revisionNo: number; status: string; ledgerVersion?: number; submittedBy?: string } | undefined;
    S.ann2 = p2?.id ?? 0;
    const p2full = parse<{ revisionNo: number; status: string; ledgerVersion: number; submittedBy: string }>(await ubnd.send("get", `/annual_reports/${S.ann2}`));
    check(G, "Trường lạ không có tác dụng: Phiếu 2, submitted, submittedBy=so.tonghop", [2, "submitted", "so.tonghop"], [p2full.revisionNo, p2full.status, p2full.submittedBy], `ledgerVersion=${p2full.ledgerVersion}`);
    // Sở tổng hợp tự duyệt báo cáo năm mình vừa nộp.
    const self = await th.send("post", `/annual_reports/${S.ann2}/approve`);
    record(G, "so.tonghop tự phê duyệt báo cáo năm của mình", self, [403, 404, 409], "BR-61.2: Sở và UBND dùng chung quyền duyệt; người nộp bị chặn tự quyết định (409)");
    if (self.status === 200) {
      // Để luồng tiếp tục: UBND mở lại phiếu (lý do có mã script → kiểm XSS ở UI).
      record(G, "UBND mở lại phiếu đã duyệt (lý do chứa <img onerror>)", await ubnd.send("post", `/annual_reports/${S.ann2}/reopen`, { reason: `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>E2E-C mở lại` }), OK);
    } else {
      record(G, "UBND trả lại Phiếu 2 (lý do chứa <img onerror>)", await ubnd.send("post", `/annual_reports/${S.ann2}/return`, { reason: `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>E2E-C trả lại` }), OK);
    }
    record(G, "UBND mở lại phiếu đã trả lại", await ubnd.send("post", `/annual_reports/${S.ann2}/reopen`, { reason: "x" }), [409]);
    check(G, "Phiếu 2 → returned", "returned", parse<{ status: string }>(await ubnd.send("get", `/annual_reports/${S.ann2}`)).status);
    for (const c of [th, ubnd]) await c.dispose();
  });

  // ================================================================== 7. UI: Sở gửi lại Phiếu 3 → UBND phê duyệt → khoá hẳn
  test("UI: Sở gửi lại Phiếu 3 → UBND phê duyệt → nút khoá đúng trạng thái, lịch sử", async ({ page }) => {
    test.setTimeout(300_000);
    const G = "Annual-UI-2";
    const errs = watch(page);
    let dialogFired = false;
    page.on("dialog", (d) => {
      dialogFired = true;
      void d.dismiss();
    });
    await useReportYear(page, Y_ANN);
    await login(page, ACCOUNTS.soTongHop);
    await openYear(page);
    await expect(page.getByText("UBND trả lại").first()).toBeVisible();
    await submitYear(page, "Gửi lại", `03/TTr-STC-E2E-C`);
    await expectToast(page, `Đã gửi lại Phiếu 3 báo cáo năm ${Y_ANN} lên UBND.`);
    const l = await annualList();
    S.ann3 = l.find((x) => x.revisionNo === 3)?.id ?? 0;
    check(G, "UI gửi lại → Phiếu 3 submitted", ["returned", "returned", "submitted"], l.map((r) => r.status));

    await logout(page);
    await login(page, ACCOUNTS.ubndDuyet);
    // Phiếu cũ (Phiếu 2, đã trả lại) không có nút quyết định; lý do chứa script không chạy.
    await openForReview(page, 2);
    await page.waitForTimeout(2000);
    check(G, "UI UBND mở Phiếu 2 cũ: không có Phê duyệt/Trả lại", [0, 0], [await page.getByRole("button", { name: "Phê duyệt", exact: true }).count(), await page.getByRole("button", { name: "Trả lại", exact: true }).count()]);
    const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);
    check(G, "Lý do trả lại/mở lại chứa <script>/<img onerror> không chạy", false, xss || dialogFired);
    await page.goto(`/annual-review/history?nam=${Y_ANN}`);
    await page.waitForTimeout(2500);
    const hist = await page.locator("#main-content").innerText();
    check(G, "UI lịch sử nộp năm hiện Phiếu 1, 2, 3", [true, true, true], [hist.includes("Phiếu 1"), hist.includes("Phiếu 2"), hist.includes("Phiếu 3")]);

    await page.goto("/annual-review");
    const row = page.getByRole("row").filter({ hasText: `Phiếu 3` }).filter({ hasText: String(Y_ANN) });
    await row.getByRole("button", { name: "Duyệt báo cáo" }).click();
    await expect(page.getByText(`Báo cáo năm ${Y_ANN} · Phiếu 3`).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Phê duyệt", exact: true }).click();
    await page.getByRole("button", { name: `Phê duyệt báo cáo năm ${Y_ANN}` }).click();
    await expectToast(page, `Đã phê duyệt báo cáo năm ${Y_ANN}.`);
    await page.waitForTimeout(1500);
    check(G, "UI UBND sau khi duyệt: hết nút Phê duyệt/Trả lại", [0, 0], [await page.getByRole("button", { name: "Phê duyệt", exact: true }).count(), await page.getByRole("button", { name: "Trả lại", exact: true }).count()]);
    // Menu ⋯ có "Mở lại báo cáo năm".
    const more = page.getByRole("button", { name: /Thao tác khác|Thêm|⋯|More/i }).first();
    if (await more.count()) {
      await more.click();
      check(G, "UI menu ⋯ của phiếu đã duyệt có 'Mở lại báo cáo năm'", true, (await page.getByRole("menuitem", { name: "Mở lại báo cáo năm" }).count()) > 0);
      await page.keyboard.press("Escape");
    } else {
      push(G, "UI menu ⋯ của phiếu đã duyệt có 'Mở lại báo cáo năm'", "có nút ⋯", "không tìm thấy nút ⋯ (selector)", false, "selector có thể sai");
    }
    check(G, "API: Phiếu 3 approved", ["returned", "returned", "approved"], (await annualList()).map((r) => r.status));

    // Khoá APPROVED.
    const A = "Annual-đã-duyệt";
    const th = await Raw.as(ACCOUNTS.soTongHop);
    const ubnd = await Raw.as(ACCOUNTS.ubndDuyet);
    const unitA = await Raw.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    record(A, "UBND duyệt lại phiếu đã duyệt", await ubnd.send("post", `/annual_reports/${S.ann3}/approve`), [409]);
    record(A, "UBND trả lại phiếu đã duyệt", await ubnd.send("post", `/annual_reports/${S.ann3}/return`, { reason: "x" }), [409]);
    record(A, "UBND mở lại không lý do", await ubnd.send("post", `/annual_reports/${S.ann3}/reopen`, {}), BAD);
    record(A, "UBND duyệt phiếu cũ (Phiếu 1 đã trả lại)", await ubnd.send("post", `/annual_reports/${S.ann1}/approve`), [409]);
    record(A, "Nộp năm lần nữa khi đã duyệt", await th.submitAnnual({ year: String(Y_ANN), docNo: "04/E2E-C", docDate: `${Y_ANN}-12-23` }, [tinyPdf()]), [409]);
    const sh = await (await Api.as(ACCOUNTS.donviBienHoa)).get<{ version: number; templateWorkbookJson: string; dataJson?: string | null }>(`/input_report_sheets/${S.aQ2TbSheet}`);
    record(A, "Đơn vị lưu biểu kỳ Q2 khi năm đã UBND duyệt", await unitA.send("put", `/input_report_sheets/${S.aQ2TbSheet}`, { dataJson: sh.dataJson || sh.templateWorkbookJson, version: sh.version }), [409]);
    record(A, "Sở duyệt phiếu Q2 khi năm đã UBND duyệt", await soDuyet.send("post", `/input_reports/${S.aQ2BlReport}/approve`), [409]);
    record(A, "Sổ Sở hoàn tất biểu khi năm đã duyệt", await th.send("post", `/dept_reports/${S.aDeptId}/sheets/${S.tplId}/complete`, {}), [409]);
    const ys = parse<{ canSubmit: boolean; lockReason: string | null }>(await th.send("get", `/annual_reports/year_status?year=${Y_ANN}`));
    check(G, "year_status sau duyệt: không nộp được, có lý do khoá", [false, true], [ys.canSubmit, !!ys.lockReason]);

    // so.tonghop xem năm trên màn Tổng hợp: không còn nút Nộp / Gửi lại.
    await logout(page);
    await login(page, ACCOUNTS.soTongHop);
    await openYear(page);
    await page.waitForTimeout(1500);
    check(G, "UI so.tonghop năm đã duyệt: không có nút Nộp/Gửi lại, có 'Xem phiếu'", [0, 0, true], [
      await page.getByRole("button", { name: "Nộp báo cáo năm", exact: true }).count(),
      await page.getByRole("button", { name: "Gửi lại báo cáo năm", exact: true }).count(),
      (await page.getByRole("button", { name: "Xem phiếu", exact: true }).count()) > 0,
    ]);
    recordErrors(G, "Trang gửi lại/duyệt năm", errs);
    for (const c of [th, ubnd, unitA, soDuyet]) await c.dispose();
  });

  // ================================================================== 8. UI /summary (2039)
  test("UI /summary: Theo kỳ hiện bảng đúng số, Theo năm, Xuất Excel; vai trò không quyền bị chặn", async ({ page }) => {
    test.setTimeout(300_000);
    const G = "Summary-UI";
    const errs = watch(page);
    await useReportYear(page, Y_SUM);
    await login(page, ACCOUNTS.soTongHop);
    await page.goto("/summary");
    await page.getByText(`Quý I/${Y_SUM}`, { exact: true }).first().click();
    await expect(page.getByRole("heading", { name: `Quý I/${Y_SUM}` })).toBeVisible();
    await expect.poll(() => readSheetCell(page, "1a", 6, 2), { timeout: 60_000 }).toBe(20);
    check(G, "UI Theo kỳ Q1: ô số người = 20, kinh phí = 1600", [20, 1600], [await readSheetCell(page, "1a", 6, 2), await readSheetCell(page, "1a", 6, 4)]);
    // Xuất Excel từ menu ⋯.
    const menuBtn = page.getByRole("button", { name: /Thao tác khác|Thêm thao tác|More/i }).first();
    let exported = "không tìm thấy menu ⋯";
    if (await menuBtn.count()) {
      await menuBtn.click();
      const item = page.getByRole("menuitem", { name: "Xuất Excel" });
      if (await item.count()) {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }).catch(() => null), item.click()]);
        exported = dl ? `tải ${dl.suggestedFilename()}` : "không có download";
      } else exported = "menu không có Xuất Excel";
    }
    push(G, "UI Theo kỳ: Xuất Excel tải được tệp", "tải .xlsx", exported, /\.xlsx$/.test(exported));
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Theo năm" }).click();
    await page.getByRole("option", { name: new RegExp(`Năm ${Y_SUM}`) }).click();
    await expect(page.getByText(`Báo cáo năm ${Y_SUM}`).first()).toBeVisible();
    await page.waitForTimeout(4000);
    const hasNop = await page.getByRole("button", { name: "Nộp báo cáo năm", exact: true }).count();
    check(G, "UI Theo năm 2039: có nút 'Nộp báo cáo năm' (năm có số liệu Sở, chưa nộp)", true, hasNop > 0);
    recordErrors(G, "/summary so.tonghop", errs);

    for (const [who, acc] of [["donvi.bienhoa", ACCOUNTS.donviBienHoa], ["so.duyet", ACCOUNTS.soDuyet], ["ubnd.duyet", ACCOUNTS.ubndDuyet]] as const) {
      await logout(page);
      await login(page, acc).catch(() => undefined);
      await page.goto("/summary");
      await page.waitForTimeout(2500);
      const text = (await page.locator("body").innerText()).slice(0, 2000);
      const blocked = /chưa có quyền xem trang này/i.test(text);
      push(G, `${who} gõ thẳng /summary bị chặn`, "Forbidden", blocked ? "Forbidden" : text.replace(/\s+/g, " ").slice(0, 100), blocked);
    }
  });

  // ================================================================== 9. UI /dashboard theo vai trò
  test("UI /dashboard theo từng vai trò: số liệu khớp API, Truy cập nhanh", async ({ page }) => {
    test.setTimeout(400_000);
    const G = "Dashboard-UI";
    const errs = watch(page);
    await useReportYear(page, Y_SUM);
    for (const [who, acc] of [
      ["so.tonghop", ACCOUNTS.soTongHop],
      ["so.duyet", ACCOUNTS.soDuyet],
      ["so.dieuhanh", ACCOUNTS.soDieuHanh],
      ["donvi.bienhoa", ACCOUNTS.donviBienHoa],
      ["ubnd.duyet", ACCOUNTS.ubndDuyet],
      ["admin", ACCOUNTS.admin],
    ] as const) {
      await page.goto("/login");
      await logout(page);
      try {
        await login(page, acc);
      } catch {
        push(G, `${who}: đăng nhập vào /dashboard`, "vào /dashboard", page.url(), false);
        continue;
      }
      await page.waitForTimeout(3500);
      const raw = await Raw.as(acc);
      const g = await raw.send("get", `/asxh_dashboard?year=${Y_SUM}`);
      await raw.dispose();
      const body = (await page.locator("#main-content").innerText().catch(() => "")).replace(/\s+/g, " ");
      if (g.status !== 200) {
        const handled = /quyền|không/i.test(body) && !/Error|undefined|NaN/.test(body);
        push(G, `${who}: API trang chủ ${g.status} → màn báo rõ, không vỡ`, "thông báo rõ", body.slice(0, 120), handled);
        continue;
      }
      const d = parse<{ kpi: { needAction: number; overdue: number; counts: { pending: number; approved: number } } }>(g);
      const card = async (label: string) => (await page.locator("a, div").filter({ hasText: new RegExp(`^\\s*\\d+\\s*${label}`) }).first().innerText().catch(() => "")).replace(/\s+/g, " ");
      const pend = await card("Chờ duyệt");
      const appr = await card("Đã duyệt");
      check(G, `${who}: thẻ Chờ duyệt / Đã duyệt khớp API`, [d.kpi.counts.pending, d.kpi.counts.approved], [Number(pend.match(/\d+/)?.[0] ?? -1), Number(appr.match(/\d+/)?.[0] ?? -1)], `${pend} | ${appr}`);
      // Truy cập nhanh: mở từng link, ghi link dẫn tới trang "chưa có quyền".
      const panel = page.locator("div").filter({ has: page.getByText("Truy cập nhanh", { exact: true }) }).last();
      const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
      const quick = ["/input-reports", "/report-review", "/summary", "/period-setup", "/templates", "/report-calendar", "/report-units", "/users"].filter((h) => hrefs.includes(h));
      void panel;
      const forbidden: string[] = [];
      for (const h of quick) {
        await page.goto(h);
        await page.waitForTimeout(1500);
        if (/chưa có quyền xem trang này/i.test(await page.locator("body").innerText())) forbidden.push(h);
      }
      push(G, `${who}: Truy cập nhanh không dẫn tới trang bị cấm`, "0 link cấm", `${quick.length} link; cấm: ${forbidden.join(", ") || "không"}`, forbidden.length === 0);
      await page.goto("/dashboard");
    }
    recordErrors(G, "/dashboard các vai trò", errs);
  });

  test("Tổng kết: mọi ca đạt kỳ vọng", () => {
    const failed = results.filter((r) => !r.ok).map((r) => `${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}`);
    expect(failed).toEqual([]);
  });
});
