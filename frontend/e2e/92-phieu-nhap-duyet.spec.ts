// Kiểm thử nhóm B (chạy tay, chưa đưa vào CI): phiếu nhập — tờ biểu (no_data / reopen), đếm thẻ
// lọc, lịch sử, khoá / huỷ, trả lại → phiên bản mới, kỳ quá hạn / đã chốt, đính kèm + Kho bạc,
// sổ cái (xem trước, nạp BHXH, nhật ký, số liệu đã lưu) và giao diện Nhập liệu + Duyệt phiếu.
// Phần 90-kiem-thu-bien-gian-lan.spec.ts đã phủ thì không lặp lại. Mỗi ca ghi mã HTTP thật, so
// với kỳ vọng (không dừng giữa chừng) rồi in bảng tổng kết; ca cuối đòi mọi ca đạt. Năm riêng 2037, dọn trước và sau.
import { expect, request, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import pg from "pg";

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
  sheetsOf,
  templateByCode,
  tinyPdf,
  unitByCode,
  unitSubmitsViaApi,
  type Account,
  type Sheet,
} from "./support/api";
import { databaseUrl, purgeYear } from "./support/db";
import { expectToast, login, logout, typeIntoSheet, useReportYear } from "./support/ui";

const YEAR = 2037;
const UNIT_HOA_AN = "1051103"; // đơn vị thứ ba (không có tài khoản) — dùng cho ca huỷ phiếu
const TEMPLATE_1B = "BM-000002";

const VIEWER = { username: "viewer", password: "User@123" } as unknown as Account;
const MANAGER = { username: "manager", password: "Manager@123" } as unknown as Account;
const ADMIN: Account = ACCOUNTS.admin;

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];
const loginFailed = new Set<string>();

/**
 * Thân JSON của API trong spec dò quyền / dò biên: dạng tuỳ endpoint, đọc trường tuỳ ý. Một kiểu
 * nới duy nhất ở đây thay cho ép kiểu từng chỗ (hàng trăm chỗ đọc thân phản hồi).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- thân JSON tuỳ endpoint, chỉ dùng trong test
type ApiJson = any;

type Res = { status: number; body: string; headers: Record<string, string>; json: () => ApiJson };

/** Client thô: trả mã HTTP + thân + header, không ném lỗi. */
class Raw {
  private constructor(private readonly ctx: APIRequestContext) {}
  static async as(account: Account | null) {
    let bearer: string | undefined;
    if (account) {
      const anon = await request.newContext();
      const res = await anon.post(`${API_URL}/auth/login`, { data: account });
      if (res.ok()) bearer = ((await res.json()) as { accessToken: string }).accessToken;
      else if (!loginFailed.has(account.username)) {
        loginFailed.add(account.username);
        results.push({ group: "Môi trường", case: `Đăng nhập ${account.username}`, expect: "200", got: `${res.status()} ${(await res.text()).slice(0, 120)}`, ok: false, note: "các ca của tài khoản này chạy KHÔNG token (401)" });
      }
      await anon.dispose();
    }
    return new Raw(await request.newContext({ extraHTTPHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {} }));
  }
  private async wrap(res: import("@playwright/test").APIResponse): Promise<Res> {
    const buf = await res.body();
    const text = buf.toString("utf8");
    return {
      status: res.status(),
      body: text.slice(0, 400),
      headers: res.headers(),
      json: () => (text ? JSON.parse(text) : undefined),
    };
  }
  async send(method: "get" | "post" | "put" | "delete", path: string, data?: unknown) {
    return this.wrap(await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data }));
  }
  async upload(path: string, file: { name: string; mimeType: string; buffer: Buffer }) {
    return this.wrap(await this.ctx.post(`${API_URL}${path}`, { multipart: { file } }));
  }
  async uploadNoFile(path: string) {
    return this.wrap(await this.ctx.post(`${API_URL}${path}`, { multipart: { other: "x" } }));
  }
  dispose() {
    return this.ctx.dispose();
  }
}

function record(group: string, name: string, got: { status: number; body: string }, allowed: number[], note?: string) {
  const ok = allowed.includes(got.status);
  results.push({
    group,
    case: name,
    expect: allowed.join("/"),
    got: `${got.status} ${got.body.replace(/\s+/g, " ").slice(0, 140)}`,
    ok,
    note,
  });
}

/** Ca kiểm bằng điều kiện (không phải mã HTTP). */
function check(group: string, name: string, expectText: string, gotText: string, ok: boolean, note?: string) {
  results.push({ group, case: name, expect: expectText, got: gotText.replace(/\s+/g, " ").slice(0, 160), ok, note });
}

const OK = [200, 201, 204];
const FORBIDDEN = [401, 403, 404];
const NOT_MINE = [403, 404];

const P: Record<string, number> = {}; // periodId theo mã kỳ
const R: Record<string, number> = {}; // reportId: "TB-Q1", "BL-Q1", "HA-Q1", "TB-Q2", "TB-Q3", "TB-Q4", "BL-Q4"
let unitTB: number;
let unitBL: number;
let unitHA: number;
let tpl1a: number;
let tpl1b: number;

async function liveReport(api: Api, periodId: number, unitId: number) {
  const rows = await api.get<{ id: number; status: string; unit: { id: number }; revisionNo: number }[]>(
    `/input_reports?period.id=${periodId}&includeSuperseded=true`
  );
  return rows.filter((r) => r.unit.id === unitId).sort((a, b) => b.revisionNo - a.revisionNo)[0]!;
}

async function sheetByCode(api: Api, reportId: number, shortName: string) {
  const rows = (await sheetsOf(api, reportId)) as (Sheet & { template: { shortName: string } })[];
  return rows.find((s) => s.template.shortName === shortName)!;
}

async function sheetDetail(api: Api, sheetId: number) {
  return api.get<Sheet & { templateWorkbookJson: string | null }>(`/input_report_sheets/${sheetId}`);
}

/** Workbook của tờ biểu (bản lưu hoặc khung mẫu) với ô đã sửa, để PUT. */
async function bodyWith(api: Api, sheetId: number, sheet: string, cells: { row: number; col: number; value: unknown }[]) {
  const d = await sheetDetail(api, sheetId);
  const wb = JSON.parse(d.dataJson || d.templateWorkbookJson!) as {
    sheets: Record<string, { data?: { dataTable?: Record<string, Record<string, { value?: unknown }>> } }>;
  };
  const table = wb.sheets[sheet]!.data!.dataTable!;
  for (const { row, col, value } of cells) {
    table[row] ??= {};
    table[row][col] = { ...(table[row][col] ?? {}), value };
  }
  return { dataJson: JSON.stringify(wb), version: d.version };
}

function pdf(name: string, size?: number) {
  const base = tinyPdf(name);
  if (!size) return base;
  const buffer = Buffer.alloc(size, 0x20);
  base.buffer.copy(buffer, 0);
  return { ...base, buffer };
}

async function sql(text: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  try {
    return await c.query(text, params);
  } finally {
    await c.end();
  }
}

test.describe("Nhóm B — phiếu nhập, duyệt phiếu, đính kèm, sổ cái (năm 2037)", () => {

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    await purgeYear(YEAR);
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    for (const code of ["Q1", "Q2", "Q3", "Q4"]) P[code] = (await periodByCode(so, YEAR, code)).id;
    unitTB = (await unitByCode(so, UNIT_TRAN_BIEN)).id;
    unitBL = (await unitByCode(so, UNIT_BUU_LONG)).id;
    unitHA = (await unitByCode(so, UNIT_HOA_AN)).id;
    tpl1a = (await templateByCode(so, TEMPLATE_1A)).id;
    tpl1b = (await templateByCode(so, TEMPLATE_1B)).id;
    const open = async (code: string, cells: { unitId: number; templateId: number }[]) => {
      await so.put(`/period_assignments/matrix`, { periodId: P[code], add: cells, remove: [] });
      await so.post(`/report_periods/${P[code]}/publish`);
    };
    await open("Q1", [
      { unitId: unitTB, templateId: tpl1a },
      { unitId: unitTB, templateId: tpl1b },
      { unitId: unitBL, templateId: tpl1a },
      { unitId: unitHA, templateId: tpl1a },
    ]);
    await open("Q2", [{ unitId: unitTB, templateId: tpl1a }]);
    await open("Q3", [{ unitId: unitTB, templateId: tpl1a }]);
    await open("Q4", [
      { unitId: unitTB, templateId: tpl1a },
      { unitId: unitTB, templateId: tpl1b },
      { unitId: unitBL, templateId: tpl1a },
    ]);
    for (const [code, unit, key] of [
      ["Q1", unitTB, "TB-Q1"], ["Q1", unitBL, "BL-Q1"], ["Q1", unitHA, "HA-Q1"],
      ["Q2", unitTB, "TB-Q2"], ["Q3", unitTB, "TB-Q3"], ["Q4", unitTB, "TB-Q4"], ["Q4", unitBL, "BL-Q4"],
    ] as const) {
      R[key] = (await liveReport(so, P[code], unit)).id;
    }
    await so.dispose();
    const tb = await Api.as(ACCOUNTS.donviBienHoa);
    await sheetByCode(tb, R["TB-Q1"], "1b"); // phiếu Q1 của A có tờ 1b
    await tb.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync("test-results/92-phieu-nhap-duyet.json", JSON.stringify(results, null, 2));
    console.log("\n=== TỔNG KẾT NHÓM B ===");
    for (const r of results)
      console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}${r.note ? ` | ${r.note}` : ""}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ca đạt`);
  });

  // ------------------------------------------------------------------ tờ biểu

  test("API tờ biểu: danh sách theo phiếu, Không phát sinh số liệu, Sửa lại theo trạng thái", async () => {
    const G = "Tờ biểu";
    const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
    const tb = await Raw.as(ACCOUNTS.donviBienHoa);
    const bl = await Raw.as(ACCOUNTS.donviBuuLong);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const viewer = await Raw.as(VIEWER);

    const list = await tb.send("get", `/input_report_sheets?report.id=${R["TB-Q1"]}`);
    const names = (list.json() as { template: { shortName: string } }[]).map((s) => s.template.shortName).sort();
    check(G, "GET list tờ biểu theo phiếu nhiều biểu (1a + 1b)", "200, 2 tờ [1a,1b], không kèm dataJson",
      `${list.status} ${JSON.stringify(names)} dataJson=${list.body.includes('"dataJson":"') ? "có" : "không"}`,
      list.status === 200 && names.join(",") === "1a,1b" && !list.body.includes('"dataJson":"{'));
    record(G, "GET list tờ biểu theo report.id=abc (sai kiểu)", await tb.send("get", `/input_report_sheets?report.id=abc`), [200, 400]);

    const s1a = await sheetByCode(tbApi, R["TB-Q1"], "1a");
    const s1b = await sheetByCode(tbApi, R["TB-Q1"], "1b");
    const completion = async (id: number) => (await sheetDetail(tbApi, id)).completion;

    record(G, "Kiểm tra & hoàn tất biểu 1b chưa nhập gì", await tb.send("post", `/input_report_sheets/${s1b.id}/complete`), [409, 422, 400]);
    const nd = await tb.send("post", `/input_report_sheets/${s1b.id}/no_data`);
    record(G, "Không phát sinh số liệu biểu chưa nhập (NOT_STARTED → NO_DATA)", nd, OK);
    check(G, "Sau no_data, completion = NO_DATA", "NO_DATA", await completion(s1b.id), (await completion(s1b.id)) === "NO_DATA");
    record(G, "Bấm Không phát sinh số liệu lần hai", await tb.send("post", `/input_report_sheets/${s1b.id}/no_data`), [200, 409], "lặp lại không được 500");
    record(G, "Lưu số liệu vào biểu đã đánh dấu Không phát sinh", await tb.send("put", `/input_report_sheets/${s1b.id}`, { dataJson: "{}", version: null }), [409]);
    record(G, "Sửa lại biểu NO_DATA", await tb.send("post", `/input_report_sheets/${s1b.id}/reopen`), OK);
    check(G, "Sau Sửa lại biểu chưa có số liệu → NOT_STARTED", "NOT_STARTED", await completion(s1b.id), (await completion(s1b.id)) === "NOT_STARTED");
    record(G, "Sửa lại biểu đang nhập (chưa đánh dấu)", await tb.send("post", `/input_report_sheets/${s1b.id}/reopen`), [200, 409]);

    // Vượt quyền / id lạ.
    record(G, "Đơn vị B đánh dấu Không phát sinh tờ biểu của A", await bl.send("post", `/input_report_sheets/${s1b.id}/no_data`), NOT_MINE);
    record(G, "Đơn vị B Sửa lại tờ biểu của A", await bl.send("post", `/input_report_sheets/${s1b.id}/reopen`), NOT_MINE);
    record(G, "Đơn vị B Kiểm tra & hoàn tất tờ biểu của A", await bl.send("post", `/input_report_sheets/${s1a.id}/complete`), NOT_MINE.concat([409]));
    record(G, "so.duyet (không có quyền ghi) đánh dấu no_data", await soDuyet.send("post", `/input_report_sheets/${s1b.id}/no_data`), FORBIDDEN);
    record(G, "viewer đánh dấu no_data", await viewer.send("post", `/input_report_sheets/${s1b.id}/no_data`), FORBIDDEN);
    record(G, "viewer đọc tờ biểu theo id", await viewer.send("get", `/input_report_sheets/${s1a.id}`), FORBIDDEN);
    record(G, "no_data trên id không tồn tại", await tb.send("post", `/input_report_sheets/2147483647/no_data`), [404]);
    record(G, "reopen trên id không phải số", await tb.send("post", `/input_report_sheets/abc/reopen`), [400, 404]);
    check(G, "Sau mọi ca vượt quyền, biểu 1b của A vẫn NOT_STARTED", "NOT_STARTED", await completion(s1b.id), (await completion(s1b.id)) === "NOT_STARTED");

    // Hoàn tất 1a rồi Sửa lại: số giữ nguyên, trạng thái IN_PROGRESS.
    await fillAndCompleteSheet(tbApi, s1a.id, "1a", [{ row: 6, col: 2, value: 12 }, { row: 6, col: 4, value: 34_500_000 }]);
    record(G, "Sửa lại biểu đã hoàn tất (COMPLETED → IN_PROGRESS)", await tb.send("post", `/input_report_sheets/${s1a.id}/reopen`), OK);
    const after = await sheetDetail(tbApi, s1a.id);
    const kept = JSON.parse(after.dataJson!).sheets["1a"].data.dataTable[6][2].value;
    check(G, "Sửa lại giữ số đã nhập, completion IN_PROGRESS", "IN_PROGRESS, ô C7 = 12", `${after.completion}, ô = ${kept}`, after.completion === "IN_PROGRESS" && kept === 12);
    record(G, "Không phát sinh số liệu cho biểu đã có số (giữ số)", await tb.send("post", `/input_report_sheets/${s1a.id}/no_data`), OK);
    record(G, "Sửa lại biểu NO_DATA có số → IN_PROGRESS", await tb.send("post", `/input_report_sheets/${s1a.id}/reopen`), OK);
    check(G, "Biểu NO_DATA có số mở lại → IN_PROGRESS", "IN_PROGRESS", await completion(s1a.id), (await completion(s1a.id)) === "IN_PROGRESS");
    record(G, "Kiểm tra & hoàn tất lại 1a", await tb.send("post", `/input_report_sheets/${s1a.id}/complete`), OK);
    record(G, "Không phát sinh số liệu biểu 1b (chuẩn bị nộp nhiều biểu)", await tb.send("post", `/input_report_sheets/${s1b.id}/no_data`), OK);

    for (const c of [tb, bl, soDuyet, viewer]) await c.dispose();
    await tbApi.dispose();
  });

  // ------------------------------------------------------------------ đính kèm

  test("API đính kèm + xác nhận Kho bạc: IDOR, tên file nguy hiểm, quá lớn, quá số lượng, sau khi nộp", async () => {
    const G = "Đính kèm";
    const rep = R["TB-Q1"];
    const tb = await Raw.as(ACCOUNTS.donviBienHoa);
    const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
    const bl = await Raw.as(ACCOUNTS.donviBuuLong);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const viewer = await Raw.as(VIEWER);
    const manager = await Raw.as(MANAGER);

    const t0 = await tb.send("get", `/input_reports/${rep}/treasury_confirmation`);
    check(G, "GET treasury_confirmation ban đầu", "200, confirmed=false, fileCount=0", `${t0.status} ${t0.body}`,
      t0.status === 200 && t0.json().confirmed === false && Number(t0.json().fileCount ?? 0) === 0);
    record(G, "PUT treasury confirmed=\"yes\" (sai kiểu)", await tb.send("put", `/input_reports/${rep}/treasury_confirmation`, { confirmed: "yes" }), [400, 422]);
    record(G, "PUT treasury thân rỗng không phải JSON", await tb.send("put", `/input_reports/${rep}/treasury_confirmation`, "not-json"), [400, 415, 422]);
    record(G, "Đơn vị B đọc treasury của phiếu A", await bl.send("get", `/input_reports/${rep}/treasury_confirmation`), NOT_MINE);
    record(G, "Đơn vị B tích Kho bạc hộ phiếu A", await bl.send("put", `/input_reports/${rep}/treasury_confirmation`, { confirmed: true }), NOT_MINE);
    record(G, "so.duyet (chỉ đọc) tích Kho bạc phiếu A", await soDuyet.send("put", `/input_reports/${rep}/treasury_confirmation`, { confirmed: true }), FORBIDDEN);

    const up = await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf());
    record(G, "Tải lên PDF hợp lệ (đối chứng)", up, OK);
    const att = up.json() as { id: number; fileName: string };
    const listed = await tb.send("get", `/input_reports/${rep}/attachments`);
    check(G, "GET danh sách đính kèm", "200, 1 file, X-Total-Count=1", `${listed.status} n=${(listed.json() as unknown[]).length} total=${listed.headers["x-total-count"]}`,
      listed.status === 200 && (listed.json() as unknown[]).length === 1);
    const content = await tb.send("get", `/input_reports/${rep}/attachments/${att.id}/content`);
    check(G, "Tải về nội dung đính kèm của mình", "200, application/pdf, nosniff, bắt đầu %PDF",
      `${content.status} ${content.headers["content-type"]} nosniff=${content.headers["x-content-type-options"]} ${content.body.slice(0, 8)}`,
      content.status === 200 && /application\/pdf/.test(content.headers["content-type"] ?? "") && content.headers["x-content-type-options"] === "nosniff" && content.body.startsWith("%PDF"));

    record(G, "Đơn vị B tải nội dung file của A (đường phiếu A)", await bl.send("get", `/input_reports/${rep}/attachments/${att.id}/content`), NOT_MINE);
    record(G, "Đơn vị B tải file của A qua phiếu của B (đổi reportId)", await bl.send("get", `/input_reports/${R["BL-Q1"]}/attachments/${att.id}/content`), NOT_MINE);
    record(G, "Đơn vị B xoá file của A", await bl.send("delete", `/input_reports/${rep}/attachments/${att.id}`), NOT_MINE);
    record(G, "Đơn vị B xoá file của A qua phiếu của B", await bl.send("delete", `/input_reports/${R["BL-Q1"]}/attachments/${att.id}`), NOT_MINE);
    record(G, "Đơn vị B tải file lên phiếu A", await bl.upload(`/input_reports/${rep}/attachments`, tinyPdf("cua-b.pdf")), NOT_MINE);
    record(G, "so.duyet (không có quyền xoá) xoá file", await soDuyet.send("delete", `/input_reports/${rep}/attachments/${att.id}`), FORBIDDEN);
    record(G, "so.duyet tải file lên phiếu đơn vị", await soDuyet.upload(`/input_reports/${rep}/attachments`, tinyPdf("cua-so.pdf")), FORBIDDEN);
    record(G, "so.duyet xem nội dung file (Sở được đọc)", await soDuyet.send("get", `/input_reports/${rep}/attachments/${att.id}/content`), [200]);
    record(G, "viewer liệt kê đính kèm", await viewer.send("get", `/input_reports/${rep}/attachments`), FORBIDDEN);
    record(G, "manager tải nội dung đính kèm", await manager.send("get", `/input_reports/${rep}/attachments/${att.id}/content`), FORBIDDEN);
    const still = (await tbApi.get<unknown[]>(`/input_reports/${rep}/attachments`)).length;
    check(G, "Sau các ca vượt quyền, phiếu A vẫn đúng 1 file", "1", String(still), still === 1);

    // Tên file nguy hiểm.
    const extra: number[] = [];
    for (const [label, name] of [
      ["Tên file có ../../ (path traversal)", "../../../etc/evil.pdf"],
      ["Tên file có ..\\..\\ (Windows)", "..\\..\\Windows\\win.pdf"],
    ] as const) {
      const r = await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf(name));
      const fileName = r.status < 300 ? (r.json() as { fileName: string }).fileName : "";
      if (r.status < 300) extra.push((r.json() as { id: number }).id);
      check(G, label, "từ chối, hoặc nhận nhưng tên đã bỏ phần đường dẫn", `${r.status} fileName=${fileName || r.body}`,
        r.status >= 400 && r.status < 500 ? true : r.status < 300 && !/[\\/]|\.\./.test(fileName));
    }
    const xssName = `<img src=x onerror="window.__xss=1">.pdf`;
    const xr = await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf(xssName));
    if (xr.status < 300) extra.push((xr.json() as { id: number }).id);
    record(G, "Tên file chứa thẻ HTML <img onerror> (kiểm hiển thị ở ca UI)", xr, [200, 400, 422]);
    if (xr.status < 300) {
      const dl = await tb.send("get", `/input_reports/${rep}/attachments/${(xr.json() as { id: number }).id}/content`);
      check(G, "Content-Disposition của tên file chứa HTML được mã hoá", "200, filename*=UTF-8'' mã hoá %, không CR/LF (tên trong ngoặc kép được escape)", `${dl.status} ${dl.headers["content-disposition"]}`,
        dl.status === 200 && !(dl.headers["content-disposition"] ?? "").includes(String.fromCharCode(10)) && (dl.headers["content-disposition"] ?? "").includes("UTF-8''%3Cimg"));
    }
    record(G, "File rỗng 0 byte", await tb.upload(`/input_reports/${rep}/attachments`, { name: "rong.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) }), [400, 422]);
    record(G, "Tên file 300 ký tự", await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf(`${"a".repeat(296)}.pdf`)), [400, 422]);
    record(G, "File không có đuôi", await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf("kho-bac")), [400, 422]);
    record(G, "File .html nội dung script", await tb.upload(`/input_reports/${rep}/attachments`, { name: "x.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") }), [400, 415, 422]);
    record(G, "File .svg (ảnh có thể chứa script)", await tb.upload(`/input_reports/${rep}/attachments`, { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg onload=alert(1)>") }), [400, 415, 422]);
    record(G, "Thiếu trường file trong multipart", await tb.uploadNoFile(`/input_reports/${rep}/attachments`), [400, 422]);
    const big1 = await tb.upload(`/input_reports/${rep}/attachments`, pdf("lon-10mb.pdf", 10 * 1024 * 1024 + 1));
    record(G, "File PDF 10MB + 1 byte (trần 10MB)", big1, [400, 413, 422]);
    const big2 = await tb.upload(`/input_reports/${rep}/attachments`, pdf("lon-12mb.pdf", 12 * 1024 * 1024));
    record(G, "File PDF 12MB (vượt trần multipart 11MB)", big2, [400, 413, 422]);

    // Trần 10 file mỗi phiếu.
    let count = (await tbApi.get<unknown[]>(`/input_reports/${rep}/attachments`)).length;
    while (count < 10) {
      const r = await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf(`them-${count}.pdf`));
      if (r.status >= 300) break;
      extra.push((r.json() as { id: number }).id);
      count++;
    }
    record(G, "Tải file thứ 11 (trần 10 file/phiếu)", await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf("thu-11.pdf")), [400, 409, 422], `đang có ${count} file`);
    for (const id of extra) await tb.send("delete", `/input_reports/${rep}/attachments/${id}`);
    const delAgain = extra[0] ? await tb.send("delete", `/input_reports/${rep}/attachments/${extra[0]}`) : { status: 404, body: "" };
    record(G, "Xoá lại file đã xoá", delAgain, [404]);
    record(G, "Xoá file id không tồn tại", await tb.send("delete", `/input_reports/${rep}/attachments/2147483647`), [404]);
    record(G, "Tải nội dung file đã xoá (xoá mềm)", extra[0] ? await tb.send("get", `/input_reports/${rep}/attachments/${extra[0]}/content`) : delAgain, [404]);

    record(G, "Tích xác nhận Kho bạc (đối chứng)", await tb.send("put", `/input_reports/${rep}/treasury_confirmation`, { confirmed: true }), OK);
    const submit = await tb.send("post", `/input_reports/${rep}/submit`);
    record(G, "Nộp phiếu nhiều biểu (1a hoàn tất + 1b Không phát sinh)", submit, OK);

    // Sau khi nộp: đính kèm và ô tích bị khoá.
    record(G, "Xoá đính kèm sau khi đã nộp", await tb.send("delete", `/input_reports/${rep}/attachments/${att.id}`), [409, 403]);
    record(G, "Tải thêm file sau khi đã nộp", await tb.upload(`/input_reports/${rep}/attachments`, tinyPdf("sau-nop.pdf")), [409, 403]);
    record(G, "Bỏ tích Kho bạc sau khi đã nộp", await tb.send("put", `/input_reports/${rep}/treasury_confirmation`, { confirmed: false }), [409, 403]);
    const s1b = await sheetByCode(tbApi, rep, "1b");
    record(G, "Sửa lại biểu 1b (NO_DATA) sau khi đã nộp", await tb.send("post", `/input_report_sheets/${s1b.id}/reopen`), [409]);
    record(G, "Đánh dấu no_data sau khi đã nộp", await tb.send("post", `/input_report_sheets/${s1b.id}/no_data`), [409]);

    for (const c of [tb, bl, soDuyet, viewer, manager]) await c.dispose();
    await tbApi.dispose();
  });

  // ------------------------------------------------------------------ phiếu

  test("API phiếu: đếm thẻ lọc, lịch sử, huỷ, duyệt, sổ cái, khoá", async () => {
    const G = "Phiếu";
    const GL = "Sổ cái";
    const tb = await Raw.as(ACCOUNTS.donviBienHoa);
    const bl = await Raw.as(ACCOUNTS.donviBuuLong);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const th = await Raw.as(ACCOUNTS.soTongHop);
    const viewer = await Raw.as(VIEWER);
    const manager = await Raw.as(MANAGER);
    const admin = await Raw.as(ADMIN);
    const anon = await Raw.as(null);
    const rep = R["TB-Q1"];

    // Đếm thẻ lọc.
    const sumTB = await tb.send("get", `/input_reports/summary?year=${YEAR}`);
    const listTB = await tb.send("get", `/input_reports?year=${YEAR}&_start=0&_end=50`);
    const s = sumTB.json() as { total: number; counts: Record<string, number>; periods: { id: number }[] };
    check(G, "GET /summary đơn vị A năm 2037", "200, total = số phiếu trong danh sách, draft=3, submitted=1",
      `${sumTB.status} total=${s?.total} counts=${JSON.stringify(s?.counts)} list=${listTB.headers["x-total-count"]}`,
      sumTB.status === 200 && Number(listTB.headers["x-total-count"]) === s.total && s.counts.draft === 3 && s.counts.submitted === 1);
    check(G, "/summary: ô Kỳ của A có đủ 4 kỳ A được phát", "Q1..Q4", JSON.stringify(s?.periods?.map((p) => p.id)),
      [P.Q1, P.Q2, P.Q3, P.Q4].every((id) => s.periods.some((p) => p.id === id)));
    const sumBL = (await bl.send("get", `/input_reports/summary?year=${YEAR}`)).json() as typeof s;
    const leak = sumBL.periods.filter((p) => p.id === P.Q2 || p.id === P.Q3);
    check(G, "/summary đơn vị B không lộ kỳ chỉ phát cho A (Q2, Q3)", "không có Q2/Q3", `periods=${JSON.stringify(sumBL.periods.map((p) => p.id))} total=${sumBL.total}`,
      leak.length === 0 && sumBL.total === 2);
    const sumFiltered = (await tb.send("get", `/input_reports/summary?year=${YEAR}&status=APPROVED&display=approved`)).json() as typeof s;
    check(G, "/summary bỏ qua lọc trạng thái khi đếm", `total=${s.total}`, `total=${sumFiltered.total}`, sumFiltered.total === s.total);
    record(G, "/summary với unit.id của đơn vị B (lách tham số lọc)", { status: ((await tb.send("get", `/input_reports/summary?year=${YEAR}&unit.id=${unitBL}`)).json()?.total ?? 0) > 0 ? 299 : 200, body: "" }, [200], "299 = đếm được phiếu của B");
    record(G, "/summary year=abc", await tb.send("get", `/input_reports/summary?year=abc`), [200, 400]);
    record(G, "viewer gọi /summary", await viewer.send("get", `/input_reports/summary?year=${YEAR}`), FORBIDDEN);
    record(G, "Không token gọi /summary", await anon.send("get", `/input_reports/summary?year=${YEAR}`), [401]);
    const sumSo = (await soDuyet.send("get", `/input_reports/summary?year=${YEAR}`)).json() as typeof s;
    check(G, "/summary Sở thấy mọi phiếu năm 2037", "total = 7", `total=${sumSo.total}`, sumSo.total === 7);

    // Lịch sử.
    const h = await tb.send("get", `/input_reports/${rep}/history`);
    check(G, "GET /history phiếu của mình", "200, 1 phiên bản", `${h.status} revisions=${h.json()?.revisions?.length}`, h.status === 200 && h.json().revisions.length === 1);
    record(G, "Đơn vị B xem lịch sử phiếu A", await bl.send("get", `/input_reports/${rep}/history`), NOT_MINE);
    record(G, "so.duyet xem lịch sử phiếu A", await soDuyet.send("get", `/input_reports/${rep}/history`), [200]);
    record(G, "viewer xem lịch sử phiếu", await viewer.send("get", `/input_reports/${rep}/history`), FORBIDDEN);
    record(G, "Lịch sử id không tồn tại", await tb.send("get", `/input_reports/2147483647/history`), [404]);

    // Viewer / manager đọc phiếu.
    record(G, "viewer GET danh sách phiếu", await viewer.send("get", `/input_reports?year=${YEAR}`), FORBIDDEN);
    record(G, "viewer GET phiếu theo id", await viewer.send("get", `/input_reports/${rep}`), FORBIDDEN);
    record(G, "manager GET phiếu theo id", await manager.send("get", `/input_reports/${rep}`), FORBIDDEN);
    record(G, "manager GET tờ biểu của phiếu", await manager.send("get", `/input_report_sheets?report.id=${rep}`), FORBIDDEN);

    // Huỷ phiếu.
    const ha = R["HA-Q1"];
    record(G, "Đơn vị huỷ phiếu của chính mình (Q2, đang nhập)", await tb.send("post", `/input_reports/${R["TB-Q2"]}/cancel`), FORBIDDEN);
    record(G, "so.duyet (không có quyền huỷ) huỷ phiếu", await soDuyet.send("post", `/input_reports/${ha}/cancel`), FORBIDDEN);
    record(G, "so.tonghop huỷ phiếu", await th.send("post", `/input_reports/${ha}/cancel`), FORBIDDEN);
    record(G, "so.dieuhanh huỷ phiếu đã nộp (chờ duyệt)", await dh.send("post", `/input_reports/${rep}/cancel`), [409]);
    const cancel = await dh.send("post", `/input_reports/${ha}/cancel`);
    check(G, "so.dieuhanh huỷ phiếu đang nhập", "200, status CANCELLED", `${cancel.status} ${cancel.json()?.status}`, cancel.status === 200 && cancel.json().status === "CANCELLED");
    record(G, "Huỷ lại phiếu đã huỷ", await dh.send("post", `/input_reports/${ha}/cancel`), [409]);
    record(G, "Duyệt phiếu đã huỷ", await soDuyet.send("post", `/input_reports/${ha}/approve`), [409]);
    record(G, "Khoá phiếu đã huỷ", await soDuyet.send("post", `/input_reports/${ha}/lock`), [409]);
    record(G, "Huỷ phiếu id không tồn tại", await dh.send("post", `/input_reports/2147483647/cancel`), [404]);
    record(G, "admin nạp BHXH vào phiếu đã huỷ", await admin.send("post", `/input_reports/${ha}/ledger_imports`, { templateId: tpl1a, rows: [] }), [409]);

    // Duyệt — ai được.
    record(G, "so.tonghop phê duyệt phiếu", await th.send("post", `/input_reports/${rep}/approve`), FORBIDDEN);
    record(G, "so.tonghop trả lại phiếu", await th.send("post", `/input_reports/${rep}/return`, { reason: "thử" }), FORBIDDEN);
    record(G, "manager phê duyệt phiếu", await manager.send("post", `/input_reports/${rep}/approve`), FORBIDDEN);
    record(G, "viewer trả lại phiếu", await viewer.send("post", `/input_reports/${rep}/return`, { reason: "thử" }), FORBIDDEN);
    record(G, "Khoá phiếu đang chờ duyệt (chưa duyệt)", await soDuyet.send("post", `/input_reports/${rep}/lock`), [409]);

    // Sổ cái trước khi duyệt.
    const prev = await soDuyet.send("post", `/input_reports/${rep}/ledger_preview`);
    record(GL, "so.duyet xem trước số liệu sẽ lưu (ledger_preview)", prev, [200]);
    record(GL, "Đơn vị xem trước ledger_preview phiếu mình", await tb.send("post", `/input_reports/${rep}/ledger_preview`), FORBIDDEN);
    record(GL, "Đơn vị B ledger_preview phiếu A", await bl.send("post", `/input_reports/${rep}/ledger_preview`), FORBIDDEN);
    record(GL, "ledger_preview id không tồn tại", await soDuyet.send("post", `/input_reports/2147483647/ledger_preview`), [404]);
    const before = await soDuyet.send("get", `/ledger_entries?report.id=${rep}`);
    check(GL, "Chưa duyệt thì chưa có số liệu đã lưu", "0 dòng", `${before.status} n=${(before.json() as unknown[] | undefined)?.length}`, before.status === 200 && (before.json() as unknown[]).length === 0);

    record(G, "so.duyet phê duyệt phiếu A Q1 (đối chứng)", await soDuyet.send("post", `/input_reports/${rep}/approve`), OK);
    const entries = await soDuyet.send("get", `/ledger_entries?report.id=${rep}&_start=0&_end=200`);
    const rows = (entries.json() ?? []) as { id: number; unit?: { id: number }; indicatorCode: string; quantity: number | null }[];
    const ind = rows.filter((r) => r.indicatorCode === "1a.1");
    check(GL, "Sau duyệt: sổ cái có dòng 1a.1 = 12 người, biểu 1b NO_DATA không ghi", "≥1 dòng, 1a.1 số người 12, không có dòng 1b.*",
      `${entries.status} n=${rows.length} 1a.1=${ind.map((r) => r.quantity).join(",")} 1b=${rows.filter((r) => r.indicatorCode?.startsWith("1b")).length}`,
      entries.status === 200 && ind.reduce((a, r) => a + Number(r.quantity ?? 0), 0) === 12 && !rows.some((r) => r.indicatorCode?.startsWith("1b")));
    const firstId = rows[0]?.id ?? 2147483646;
    record(GL, "Đơn vị A đọc /ledger_entries (không có quyền)", await tb.send("get", `/ledger_entries?report.id=${rep}`), FORBIDDEN);
    record(GL, "Đơn vị B đọc /ledger_entries/{id} của A", await bl.send("get", `/ledger_entries/${firstId}`), FORBIDDEN);
    record(GL, "viewer đọc /ledger_entries", await viewer.send("get", `/ledger_entries`), FORBIDDEN);
    record(GL, "so.tonghop đọc /ledger_entries/{id}", await th.send("get", `/ledger_entries/${firstId}`), [200]);
    record(GL, "/ledger_entries/{id} không tồn tại", await th.send("get", `/ledger_entries/2147483647`), [404]);
    const audits = await soDuyet.send("get", `/input_reports/${rep}/ledger_audits`);
    check(GL, "ledger_audits sau duyệt", "200, ≥1 bản ghi", `${audits.status} n=${(audits.json() as unknown[] | undefined)?.length}`, audits.status === 200 && (audits.json() as unknown[]).length >= 1);
    record(GL, "Đơn vị đọc ledger_audits phiếu mình", await tb.send("get", `/input_reports/${rep}/ledger_audits`), FORBIDDEN);
    record(GL, "data_units: đơn vị đọc phiếu mình", await tb.send("get", `/input_reports/${rep}/data_units`), [200]);
    record(GL, "data_units: so.duyet đọc phiếu A", await soDuyet.send("get", `/input_reports/${rep}/data_units`), [200]);
    record(GL, "data_units: viewer", await viewer.send("get", `/input_reports/${rep}/data_units`), FORBIDDEN);

    // Ghi sổ cái hai lần.
    record(GL, "Đơn vị nạp BHXH (ledger_imports)", await tb.send("post", `/input_reports/${rep}/ledger_imports`, { templateId: tpl1a, rows: [] }), FORBIDDEN);
    record(GL, "so.duyet nạp BHXH (không có quyền import)", await soDuyet.send("post", `/input_reports/${rep}/ledger_imports`, { templateId: tpl1a, rows: [] }), FORBIDDEN);
    record(GL, "admin nạp BHXH vào phiếu đã duyệt", await admin.send("post", `/input_reports/${rep}/ledger_imports`,
      { templateId: tpl1a, rows: [{ indicatorCode: "1a.1", indicatorName: "x", quantity: 999, amount: 1, orderNo: 1 }] }), [409]);
    record(GL, "Duyệt lại phiếu đã duyệt (ghi sổ lần 2)", await soDuyet.send("post", `/input_reports/${rep}/approve`), [409]);
    const again = (await soDuyet.send("get", `/ledger_entries?report.id=${rep}&_start=0&_end=200`)).json() as unknown[];
    check(GL, "Số dòng sổ cái không đổi sau các lần ghi lại", String(rows.length), String(again.length), again.length === rows.length);

    // Khoá.
    record(G, "Đơn vị khoá phiếu đã duyệt", await tb.send("post", `/input_reports/${rep}/lock`), FORBIDDEN);
    record(G, "so.tonghop khoá phiếu", await th.send("post", `/input_reports/${rep}/lock`), FORBIDDEN);
    const lock = await soDuyet.send("post", `/input_reports/${rep}/lock`);
    check(G, "so.duyet khoá phiếu đã duyệt", "200, LOCKED", `${lock.status} ${lock.json()?.status}`, lock.status === 200 && lock.json().status === "LOCKED");
    record(G, "Khoá lại phiếu đã khoá", await soDuyet.send("post", `/input_reports/${rep}/lock`), [409]);
    record(G, "Huỷ phiếu đã khoá", await dh.send("post", `/input_reports/${rep}/cancel`), [409]);
    record(G, "Trả lại phiếu đã khoá", await soDuyet.send("post", `/input_reports/${rep}/return`, { reason: "thử" }), [409]);
    record(G, "Khoá id không tồn tại", await soDuyet.send("post", `/input_reports/2147483647/lock`), [404]);
    const sumLocked = (await tb.send("get", `/input_reports/summary?year=${YEAR}`)).json() as typeof s;
    check(G, "/summary sau khoá: thẻ locked = 1", "locked=1", JSON.stringify(sumLocked.counts), sumLocked.counts.locked === 1);

    for (const c of [tb, bl, soDuyet, dh, th, viewer, manager, admin, anon]) await c.dispose();
  });

  test("API trả lại → phiên bản mới (SUPERSEDED), đơn vị sửa và nộp lại; nạp BHXH trước khi duyệt", async () => {
    const G = "Trả lại / nộp lại";
    const GL = "Sổ cái";
    const blApi = await Api.as(ACCOUNTS.donviBuuLong);
    const bl = await Raw.as(ACCOUNTS.donviBuuLong);
    const tb = await Raw.as(ACCOUNTS.donviBienHoa);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const th = await Raw.as(ACCOUNTS.soTongHop);
    const admin = await Raw.as(ADMIN);
    const old = R["BL-Q1"];

    await unitSubmitsViaApi(blApi, old, 7, 9_000_000);
    const oldSheet = await sheetByCode(blApi, old, "1a");

    // Nạp BHXH vào phiếu đang chờ duyệt (admin) — sau đó trả lại: số nạp không được tính.
    const imp = await admin.send("post", `/input_reports/${old}/ledger_imports`,
      { templateId: tpl1a, rows: [{ indicatorCode: "1a.1", indicatorName: "BHXH", quantity: 100, amount: 1000, orderNo: 1 }] });
    record(GL, "admin nạp BHXH vào phiếu chờ duyệt", imp, [200, 201, 409, 400]);
    record(GL, "admin nạp BHXH biểu không thuộc phiếu (1b)", await admin.send("post", `/input_reports/${old}/ledger_imports`, { templateId: tpl1b, rows: [] }), [400, 404, 409, 422]);
    record(GL, "admin nạp BHXH thiếu templateId", await admin.send("post", `/input_reports/${old}/ledger_imports`, { rows: [] }), [400, 422]);
    record(GL, "admin nạp BHXH quantity là chữ", await admin.send("post", `/input_reports/${old}/ledger_imports`, { templateId: tpl1a, rows: [{ indicatorCode: "1a.1", quantity: "abc" }] }), [400, 422]);

    const ret = await soDuyet.send("post", `/input_reports/${old}/return`, { reason: "Biểu 1a: số người chưa khớp." });
    const next = ret.json() as { id: number; status: string; revisionNo: number };
    check(G, "Trả lại trả PHIÊN BẢN MỚI", "200, id mới, RETURNED, revisionNo 2", `${ret.status} id=${next?.id} (cũ ${old}) ${next?.status} rev=${next?.revisionNo}`,
      ret.status === 200 && next.id !== old && next.status === "RETURNED" && next.revisionNo === 2);
    const oldNow = await bl.send("get", `/input_reports/${old}`);
    check(G, "Bản cũ chuyển SUPERSEDED", "SUPERSEDED", `${oldNow.status} ${oldNow.json()?.status}`, oldNow.json()?.status === "SUPERSEDED");
    const defaultList = (await bl.send("get", `/input_reports?period.id=${P.Q1}`)).json() as { id: number }[];
    check(G, "Danh sách mặc định không hiện bản SUPERSEDED", `không có id ${old}`, JSON.stringify(defaultList.map((r) => r.id)), !defaultList.some((r) => r.id === old));
    const oldLedger = (await soDuyet.send("get", `/ledger_entries?report.id=${old}`)).json() as unknown[];
    results.push({ group: GL, case: "Sổ cái của bản SUPERSEDED (số đã nạp BHXH)", expect: "ghi nhận", got: `${oldLedger.length} dòng`, ok: true, note: "kiểm ở Tổng hợp bên dưới" });

    // Thao tác trên bản cũ.
    record(G, "Đơn vị nộp bản SUPERSEDED", await bl.send("post", `/input_reports/${old}/submit`), [409]);
    record(G, "Sở duyệt bản SUPERSEDED", await soDuyet.send("post", `/input_reports/${old}/approve`), [409]);
    record(G, "Sở trả lại bản SUPERSEDED lần nữa", await soDuyet.send("post", `/input_reports/${old}/return`, { reason: "lại" }), [409]);
    record(G, "Đơn vị lưu số vào tờ biểu bản SUPERSEDED", await bl.send("put", `/input_report_sheets/${oldSheet.id}`, { dataJson: "{}", version: null }), [409]);
    record(G, "Đơn vị Sửa lại tờ biểu bản SUPERSEDED", await bl.send("post", `/input_report_sheets/${oldSheet.id}/reopen`), [409]);
    record(G, "Đơn vị tải file lên bản SUPERSEDED", await bl.upload(`/input_reports/${old}/attachments`, tinyPdf()), [409]);
    record(G, "Điều hành huỷ bản SUPERSEDED", await dh.send("post", `/input_reports/${old}/cancel`), [409]);
    record(G, "admin nạp BHXH vào bản SUPERSEDED", await admin.send("post", `/input_reports/${old}/ledger_imports`, { templateId: tpl1a, rows: [] }), [409]);
    record(G, "Đơn vị A xem bản mới của B", await tb.send("get", `/input_reports/${next.id}`), NOT_MINE);

    const hist = await bl.send("get", `/input_reports/${next.id}/history`);
    check(G, "Lịch sử bản mới có 2 phiên bản + lý do trả lại", "2 phiên bản, có returnReason", `${hist.status} ${JSON.stringify(hist.json()?.revisions?.map((r: { revisionNo: number; status: string }) => `${r.revisionNo}:${r.status}`))}`,
      hist.status === 200 && hist.json().revisions.length === 2 && hist.body.includes("số người chưa khớp"));
    const newSheets = (await sheetsOf(blApi, next.id)) as Sheet[];
    check(G, "Bản mới chép tờ biểu giữ dấu hoàn tất", "1 tờ COMPLETED", newSheets.map((x) => x.completion).join(","), newSheets.length === 1 && newSheets[0].completion === "COMPLETED");
    const newAtt = (await bl.send("get", `/input_reports/${next.id}/attachments`)).json() as unknown[];
    const newTre = (await bl.send("get", `/input_reports/${next.id}/treasury_confirmation`)).json();
    results.push({ group: G, case: "Đính kèm / ô tích Kho bạc ở bản mới", expect: "ghi nhận", got: `${newAtt.length} file, confirmed=${newTre?.confirmed}`, ok: true, note: "thông tin: bản mới có mang theo giấy tờ không" });

    // Đơn vị sửa và nộp lại.
    const ns = newSheets[0];
    record(G, "Lưu số khi tờ biểu bản mới còn dấu hoàn tất", await bl.send("put", `/input_report_sheets/${ns.id}`, await bodyWith(blApi, ns.id, "1a", [{ row: 6, col: 2, value: 8 }])), [409]);
    record(G, "Sửa lại tờ biểu bản mới", await bl.send("post", `/input_report_sheets/${ns.id}/reopen`), OK);
    record(G, "Lưu số mới (8 người)", await bl.send("put", `/input_report_sheets/${ns.id}`, await bodyWith(blApi, ns.id, "1a", [{ row: 6, col: 2, value: 8 }])), OK);
    record(G, "Kiểm tra & hoàn tất lại", await bl.send("post", `/input_report_sheets/${ns.id}/complete`), OK);
    const firstSubmit = await bl.send("post", `/input_reports/${next.id}/submit`);
    if (firstSubmit.status >= 300) {
      results.push({ group: G, case: "Nộp lại khi bản mới chưa có Kho bạc", expect: "ghi nhận", got: `${firstSubmit.status} ${firstSubmit.body.slice(0, 120)}`, ok: true, note: "bản mới phải đính kèm lại" });
      await attachTreasury(blApi, next.id);
      record(G, "Nộp lại phiếu sau khi bị trả lại", await bl.send("post", `/input_reports/${next.id}/submit`), OK);
    } else {
      record(G, "Nộp lại phiếu sau khi bị trả lại", firstSubmit, OK);
    }
    record(G, "Sở duyệt bản nộp lại", await soDuyet.send("post", `/input_reports/${next.id}/approve`), OK);

    const led = ((await soDuyet.send("get", `/ledger_entries?report.id=${next.id}`)).json() ?? []) as { indicatorCode: string; quantity: number | null }[];
    const q = led.filter((r) => r.indicatorCode === "1a.1").reduce((a, r) => a + Number(r.quantity ?? 0), 0);
    check(GL, "Sổ cái bản nộp lại: 1a.1 = 8 người (số mới)", "8", String(q), q === 8);
    const sum = await th.send("get", `/summary/data?periodId=${P.Q1}&sourceSheetCode=${TEMPLATE_1A}`);
    const sq = ((sum.json() ?? []) as { indicatorCode: string; quantity: number | null }[])
      .filter((r) => r.indicatorCode === "1a.1").reduce((a, r) => a + Number(r.quantity ?? 0), 0);
    check(GL, "Tổng hợp Q1 1a.1 = 12 (A) + 8 (B), không cộng số BHXH nạp vào bản SUPERSEDED / số cũ 7",
      "20", `${sum.status} ${sq}`, sum.status === 200 && sq === 20);

    for (const c of [bl, tb, soDuyet, dh, th, admin]) await c.dispose();
    await blApi.dispose();
  });

  test("API kỳ quá hạn / đã chốt: không lưu, không đánh dấu, không đính kèm, không nộp", async () => {
    const G = "Kỳ quá hạn / chốt";
    const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
    const tb = await Raw.as(ACCOUNTS.donviBienHoa);
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);

    // Q2: đơn vị nhập xong + đính kèm trước, rồi kỳ chuyển Quá hạn (như việc chuyển trạng thái hằng đêm).
    const q2 = R["TB-Q2"];
    const s2 = await sheetByCode(tbApi, q2, "1a");
    await fillAndCompleteSheet(tbApi, s2.id, "1a", [{ row: 6, col: 2, value: 3 }, { row: 6, col: 4, value: 1_000_000 }]);
    await attachTreasury(tbApi, q2);
    await tb.send("post", `/input_report_sheets/${s2.id}/reopen`);
    await sql(`UPDATE asxh_report_periods SET status = 'OVERDUE' WHERE id = $1`, [P.Q2]);
    record(G, "Quá hạn: lưu số liệu", await tb.send("put", `/input_report_sheets/${s2.id}`, await bodyWith(tbApi, s2.id, "1a", [{ row: 6, col: 2, value: 4 }])), [409]);
    record(G, "Quá hạn: Kiểm tra & hoàn tất", await tb.send("post", `/input_report_sheets/${s2.id}/complete`), [409]);
    record(G, "Quá hạn: Không phát sinh số liệu", await tb.send("post", `/input_report_sheets/${s2.id}/no_data`), [409]);
    record(G, "Quá hạn: tải file đính kèm", await tb.upload(`/input_reports/${q2}/attachments`, tinyPdf("qua-han.pdf")), [409]);
    record(G, "Quá hạn: nộp phiếu", await tb.send("post", `/input_reports/${q2}/submit`), [409]);
    const sumOver = (await tb.send("get", `/input_reports/summary?year=${YEAR}`)).json() as { counts: Record<string, number> };
    check(G, "/summary: phiếu kỳ quá hạn vào thẻ overdue, không vào draft", "overdue=1", JSON.stringify(sumOver.counts), sumOver.counts.overdue === 1);

    // Q3: Sở chốt kỳ khi phiếu còn đang nhập.
    const q3 = R["TB-Q3"];
    const s3 = await sheetByCode(tbApi, q3, "1a");
    const close = await dh.send("post", `/report_periods/${P.Q3}/close`);
    record(G, "Sở chốt kỳ còn phiếu đang nhập", close, OK);
    const st = (await tb.send("get", `/input_reports/${q3}`)).json()?.status;
    results.push({ group: G, case: "Trạng thái phiếu đang nhập sau khi chốt kỳ", expect: "LOCKED", got: String(st), ok: st === "LOCKED" });
    record(G, "Kỳ đã chốt: lưu số liệu", await tb.send("put", `/input_report_sheets/${s3.id}`, await bodyWith(tbApi, s3.id, "1a", [{ row: 6, col: 2, value: 1 }])), [409]);
    record(G, "Kỳ đã chốt: Không phát sinh số liệu", await tb.send("post", `/input_report_sheets/${s3.id}/no_data`), [409]);
    record(G, "Kỳ đã chốt: tải file", await tb.upload(`/input_reports/${q3}/attachments`, tinyPdf("chot.pdf")), [409]);
    record(G, "Kỳ đã chốt: tích Kho bạc", await tb.send("put", `/input_reports/${q3}/treasury_confirmation`, { confirmed: true }), [409]);
    record(G, "Kỳ đã chốt: nộp phiếu", await tb.send("post", `/input_reports/${q3}/submit`), [409]);
    record(G, "Kỳ đã chốt: Sở duyệt phiếu chưa nộp", await soDuyet.send("post", `/input_reports/${q3}/approve`), [409]);
    record(G, "Kỳ đã chốt: điều hành huỷ phiếu", await dh.send("post", `/input_reports/${q3}/cancel`), [409]);

    for (const c of [tb, dh, soDuyet]) await c.dispose();
    await tbApi.dispose();
  });

  // ------------------------------------------------------------------ giao diện
  // (ca tổng kết ở cuối file)

  test("UI: Nhập liệu (thẻ đếm, gõ số, rời trang, Không phát sinh, đính kèm, Nộp) và Duyệt phiếu (Trả lại rỗng bị chặn, Phê duyệt)", async ({ page }) => {
    test.setTimeout(300_000);
    const G = "UI";
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const http5xx: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => pageErrors.push(`${String(e).slice(0, 120)} @ ${(e.stack ?? "").split(String.fromCharCode(10)).slice(1, 3).join(" ").slice(0, 200)}`));
    const frames: string[] = [];
    page.on("frameattached", (fr) => frames.push(fr.url() || "(trống)"));
    page.on("framenavigated", (fr) => { if (fr !== page.mainFrame()) frames.push(fr.url()); });
    page.on("response", (r) => { if (r.status() >= 500) http5xx.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
    let nativeDialog = "";
    page.on("dialog", (d) => { nativeDialog += `${d.type()}:${d.message()} `; void d.dismiss(); });

    // Dựng: B nộp Q4 qua API; A có sẵn một file tên chứa HTML.
    const blApi = await Api.as(ACCOUNTS.donviBuuLong);
    await unitSubmitsViaApi(blApi, R["BL-Q4"], 7, 9_000_000);
    await blApi.dispose();
    const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
    await tbApi.upload(`/input_reports/${R["TB-Q4"]}/attachments`, "file", tinyPdf(`<img src=x onerror="window.__xss=1">.pdf`));
    const apiSum = await tbApi.get<{ counts: Record<string, number> }>(`/input_reports/summary?year=${YEAR}`);

    await useReportYear(page, YEAR);
    await login(page, ACCOUNTS.donviBienHoa);
    await page.goto("/input-reports");
    const cards = page.getByRole("group", { name: "Lọc nhanh" }).or(page.locator('[aria-label="Lọc nhanh"]')).first();
    await expect(cards).toBeVisible();
    const cardNum = async (label: string) => {
      const t = await cards.getByRole("button").filter({ hasText: label }).first().innerText();
      return Number((t.match(/\d+/g) ?? ["-1"]).pop());
    };
    await expect.poll(() => cardNum("Cần nhập"), { timeout: 20_000 }).toBe(apiSum.counts.draft);
    const ui = { draft: await cardNum("Cần nhập"), returned: await cardNum("Bị trả lại"), submitted: await cardNum("Chờ Sở duyệt"), approved: await cardNum("Đã phê duyệt") };
    check(G, "Thẻ lọc nhanh khớp /summary", JSON.stringify({ draft: apiSum.counts.draft, returned: apiSum.counts.returned, submitted: apiSum.counts.submitted, approved: apiSum.counts.approved }),
      JSON.stringify(ui), ui.draft === apiSum.counts.draft && ui.returned === apiSum.counts.returned && ui.submitted === apiSum.counts.submitted && ui.approved === apiSum.counts.approved);
    await cards.getByRole("button").filter({ hasText: "Cần nhập" }).first().click();
    await page.waitForTimeout(1500);
    const draftRows = await page.locator("tbody tr").filter({ hasText: "Quý" }).count();
    check(G, "Bấm thẻ Cần nhập lọc danh sách", `${apiSum.counts.draft} dòng`, `${draftRows} dòng`, draftRows === apiSum.counts.draft);
    const q4Row = page.locator("tbody tr").filter({ hasText: `Quý IV/${YEAR}` }).first();
    const hasEnterBtn = await q4Row.getByRole("button", { name: "Nhập dữ liệu" }).count();
    check(G, "Dòng phiếu đang nhập có nút Nhập dữ liệu", "có", hasEnterBtn ? "có" : "không", hasEnterBtn > 0);
    await cards.getByRole("button").filter({ hasText: "Cần nhập" }).first().click(); // bỏ chọn

    // Mở phiếu Q4, gõ số, thử rời trang khi chưa lưu.
    await page.goto(`/input-reports/${R["TB-Q4"]}`);
    await typeIntoSheet(page, "1a", [{ row: 6, col: 2, value: 5 }, { row: 6, col: 4, value: 1_000_000 }]);
    await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
    await page.getByRole("link", { name: "Quay lại" }).first().click();
    const guard = page.getByRole("alertdialog");
    const guardShown = await guard.isVisible().catch(() => false) || (await guard.waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
    check(G, "Rời trang khi chưa lưu → hộp hỏi", "hiện hộp 'còn thay đổi chưa lưu'", guardShown ? (await guard.innerText()).slice(0, 100) : `không hiện, url=${page.url()}`, guardShown);
    if (guardShown) await guard.getByRole("button", { name: "Ở lại trang này" }).click();
    check(G, "Chọn Ở lại → vẫn ở trang phiếu, số chưa mất", `/input-reports/${R["TB-Q4"]}`, page.url(), page.url().endsWith(`/input-reports/${R["TB-Q4"]}`));

    await page.getByRole("button", { name: "Lưu dữ liệu" }).click();
    await expectToast(page, "Đã lưu số liệu biểu 1a.");
    await page.getByRole("button", { name: "Kiểm tra & hoàn tất" }).click();
    await expectToast(page, /Đã đánh dấu biểu 1a là nhập xong/);
    const submitBtn = page.getByRole("button", { name: "Nộp phiếu", exact: true });
    const disabledWhilePending = await submitBtn.isDisabled().catch(() => false);
    check(G, "Nút Nộp phiếu mờ khi còn biểu 1b chưa xong", "disabled", disabledWhilePending ? "disabled" : "enabled", disabledWhilePending);

    // Biểu 1b: Không phát sinh số liệu qua menu ⋯.
    await page.getByRole("tab", { name: /1b/ }).first().click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Thao tác khác" }).last().click();
    await page.getByRole("menuitem", { name: "Không phát sinh số liệu" }).click();
    await page.getByRole("alertdialog").or(page.getByRole("dialog")).last().getByRole("button", { name: "Không phát sinh số liệu" }).click();
    await page.waitForTimeout(2000);
    await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
    results.push({ group: G, case: "Không phát sinh số liệu biểu 1b qua menu ⋯ → Nộp phiếu sáng", expect: "enabled", got: "enabled", ok: true });

    // Nộp: hộp Kho bạc hiển thị tên file chứa HTML dạng chữ, tải thêm file, tích, nộp.
    await submitBtn.click();
    const dialog = page.getByRole("dialog", { name: "Nộp phiếu lên Sở Tài chính" });
    await expect(dialog).toBeVisible();
    const showsLiteral = await dialog.getByText(`<img src=x onerror="window.__xss=1">.pdf`).first().waitFor({ timeout: 10_000 }).then(() => 1).catch(() => 0);
    const dialogText = (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 300);
    check(G, "Tên file chứa <img onerror> hiển thị dạng chữ trong hộp nộp", "hiện nguyên văn", showsLiteral ? "hiện nguyên văn" : `không thấy; hộp: ${dialogText}`, showsLiteral > 0);
    await dialog.locator('input[type="file"]').setInputFiles(tinyPdf());
    await expect(dialog.getByText("xac-nhan-kho-bac.pdf")).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const exeListed = await dialog.getByText("virus.exe").count();
    const exeMsg = await page.locator("[data-sonner-toast]").filter({ hasText: /Chỉ nhận|không khớp|không hợp lệ/ }).count();
    check(G, "Chọn file .exe trong hộp nộp bị từ chối", "không vào danh sách", `listed=${exeListed} thôngBáo=${exeMsg}`, exeListed === 0 || exeMsg > 0);
    await dialog.getByLabel("Đã có phiếu xác nhận của Kho bạc").click();
    await dialog.getByRole("button", { name: "Nộp phiếu", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: `Nộp phiếu Quý IV/${YEAR}?` });
    await expect(confirm.getByText(/Số biểu: 2 biểu/)).toBeVisible();
    await confirm.getByRole("button", { name: "Nộp phiếu", exact: true }).click();
    await expectToast(page, /Đã nộp phiếu Quý IV\/\d{4}; đang chờ Sở duyệt/);
    const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);
    check(G, "Script trong tên file không chạy", "không chạy", xss || nativeDialog ? `ĐÃ CHẠY ${nativeDialog}` : "không chạy", !xss && !nativeDialog);

    const rep = await tbApi.get<{ status: string }>(`/input_reports/${R["TB-Q4"]}`);
    const sh = (await sheetsOf(tbApi, R["TB-Q4"])) as (Sheet & { template: { shortName: string } })[];
    const s1a = sh.find((x) => x.template.shortName === "1a")!;
    const val = JSON.parse((await sheetDetail(tbApi, s1a.id)).dataJson!).sheets["1a"].data.dataTable[6][2].value;
    check(G, "Máy chủ sau nộp từ UI", "SUBMITTED, 1a COMPLETED (ô=5), 1b NO_DATA",
      `${rep.status}, ${sh.map((x) => `${x.template.shortName}:${x.completion}`).join(" ")}, ô=${val}`,
      rep.status === "SUBMITTED" && s1a.completion === "COMPLETED" && val === 5 && sh.find((x) => x.template.shortName === "1b")?.completion === "NO_DATA");

    // Sở duyệt: Trả lại lý do rỗng bị chặn, rồi trả lại có lý do; phê duyệt phiếu B.
    await logout(page);
    await login(page, ACCOUNTS.soDuyet);
    await page.goto("/report-review");
    const rowTB = page.getByRole("row").filter({ hasText: "UBND phường Trấn Biên" }).filter({ hasText: `Quý IV/${YEAR}` }).first();
    await expect(rowTB).toBeVisible({ timeout: 30_000 });
    await rowTB.getByRole("button", { name: /Duyệt phiếu|Xem phiếu/ }).first().click();
    await expect(page).toHaveURL(/\/report-review\/\d+/);
    await page.getByRole("button", { name: "Trả lại", exact: true }).click();
    const rd = page.getByRole("dialog", { name: "Trả lại phiếu" });
    await rd.getByRole("button", { name: "Trả lại phiếu" }).click();
    const emptyBlocked = await rd.getByText("Chưa nhập lý do trả lại.").isVisible().catch(() => false);
    await rd.getByRole("textbox").fill("    ");
    await rd.getByRole("button", { name: "Trả lại phiếu" }).click();
    await page.waitForTimeout(1000);
    const spacesBlocked = await rd.isVisible();
    const stillSubmitted = (await tbApi.get<{ status: string }>(`/input_reports/${R["TB-Q4"]}`)).status === "SUBMITTED";
    check(G, "Trả lại với lý do rỗng / toàn dấu cách bị chặn ở UI", "báo 'Chưa nhập lý do', hộp còn mở, phiếu vẫn SUBMITTED",
      `rỗng=${emptyBlocked} cách=${spacesBlocked} SUBMITTED=${stillSubmitted}`, emptyBlocked && spacesBlocked && stillSubmitted);
    await rd.getByRole("textbox").fill("Biểu 1a dòng 1 chưa khớp danh sách chi trả.");
    await rd.getByRole("button", { name: "Trả lại phiếu" }).click();
    await expectToast(page, "Đã trả lại phiếu cho UBND phường Trấn Biên.");
    results.push({ group: G, case: "Trả lại có lý do từ UI", expect: "toast đã trả lại", got: "toast đã trả lại", ok: true });

    await page.goto("/report-review");
    const rowBL = page.getByRole("row").filter({ hasText: "UBND phường Bửu Long" }).filter({ hasText: `Quý IV/${YEAR}` }).first();
    await expect(rowBL).toBeVisible({ timeout: 30_000 });
    await rowBL.getByRole("button", { name: /Duyệt phiếu|Xem phiếu/ }).first().click();
    await page.getByRole("button", { name: "Phê duyệt", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Phê duyệt phiếu" }).click();
    await expectToast(page, `Đã phê duyệt phiếu Quý IV/${YEAR} của UBND phường Bửu Long.`);
    const so = await Api.as(ACCOUNTS.soDuyet);
    const blQ4 = await liveReport(so, P.Q4, unitBL);
    const tbQ4 = await liveReport(so, P.Q4, unitTB);
    check(G, "Máy chủ sau duyệt/trả lại từ UI", "B APPROVED; A RETURNED rev 2", `B=${blQ4.status}; A=${tbQ4.status} rev ${tbQ4.revisionNo}`,
      blQ4.status === "APPROVED" && tbQ4.status === "RETURNED" && tbQ4.revisionNo === 2);
    await so.dispose();

    // Đơn vị A thấy thẻ Bị trả lại = 1 và nút Sửa & nộp lại.
    await logout(page);
    await login(page, ACCOUNTS.donviBienHoa);
    await page.goto("/input-reports");
    await expect.poll(() => cardNum("Bị trả lại"), { timeout: 20_000 }).toBe(1);
    const fixBtn = await page.locator("tbody tr").filter({ hasText: `Quý IV/${YEAR}` }).getByRole("button", { name: "Sửa & nộp lại" }).count();
    check(G, "Đơn vị thấy thẻ Bị trả lại = 1 và nút Sửa & nộp lại", "1, có nút", `${await cardNum("Bị trả lại")}, nút=${fixBtn}`, fixBtn > 0);

    await tbApi.dispose();
    const realConsole = consoleErrors.filter((t) => !/favicon|DevTools/.test(t));
    // SecurityError localStorage @ <anonymous>: chính addInitScript của useReportYear chạy trong khung con about:srcdoc / chrome-error (origin rỗng), không phải mã app.
    const appErrors = pageErrors.filter((t) => !(t.includes("localStorage") && /@\s+at <anonymous>/.test(t)));
    check(G, "Không có pageerror từ mã app", "0", `${appErrors.length} ${appErrors.join(" | ")} (bỏ ${pageErrors.length - appErrors.length} lỗi do init script của test)`, appErrors.length === 0);
    check(G, "Không có HTTP 5xx", "0", `${http5xx.length} ${http5xx.join(" | ")}`, http5xx.length === 0);
    results.push({ group: G, case: "Khung con (iframe) đã mở (ghi nhận)", expect: "ghi nhận", got: [...new Set(frames)].join(" | ").slice(0, 300), ok: true });
    results.push({ group: G, case: "Lỗi console (ghi nhận)", expect: "ghi nhận", got: `${realConsole.length} ${realConsole.slice(0, 5).join(" | ")}`, ok: true });
  });

  test("tổng kết: mọi ca đạt kỳ vọng", () => {
    const failed = results.filter((r) => !r.ok).map((r) => `${r.group} — ${r.case}: kỳ vọng ${r.expect}, nhận ${r.got}`);
    expect(failed, failed.join("\n")).toEqual([]);
  });
});
