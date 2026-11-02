// Kiểm thử mở rộng (chạy tay, chưa đưa vào CI): ca lỗi nhập liệu (worst case) và ca gian
// lận / vượt quyền (cheating case) trên luồng phiếu nhập. Mỗi ca ghi lại mã HTTP thật và so
// với kỳ vọng; dùng expect.soft để chạy hết mọi ca rồi in bảng tổng kết.
// Năm riêng 2045, dọn trước và sau (support/db.ts từ chối CSDL thật).
import { expect, request, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";

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
  unitByCode,
  type Account,
  type Sheet,
} from "./support/api";
import { purgeYear } from "./support/db";
import { login, useReportYear } from "./support/ui";

const YEAR = 2045;

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];

/** Client thô: trả mã HTTP + thân, không ném lỗi — để ghi nhận cả ca bị từ chối. */
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
    const ctx = await request.newContext({
      extraHTTPHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    });
    return new Raw(ctx);
  }
  async send(method: "get" | "post" | "put" | "delete", path: string, data?: unknown) {
    const res = await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data });
    return { status: res.status(), body: (await res.text()).slice(0, 300) };
  }
  async upload(path: string, file: { name: string; mimeType: string; buffer: Buffer }) {
    const res = await this.ctx.post(`${API_URL}${path}`, { multipart: { file } });
    return { status: res.status(), body: (await res.text()).slice(0, 300) };
  }
  dispose() {
    return this.ctx.dispose();
  }
}

/** Ghi một ca: `allowed` là các mã chấp nhận được (vd. từ chối = 400/403/404/409/422). */
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
  expect.soft(allowed, `${group} — ${name}: nhận ${got.status} ${got.body}`).toContain(got.status);
}

const DENIED = [400, 403, 404, 409, 422];
const FORBIDDEN = [401, 403, 404];

let periodId: number;
let reportA: number; // phiếu của Trấn Biên (donvi.bienhoa)
let reportB: number; // phiếu của Bửu Long (donvi.buulong)
let sheetA: Sheet;
let sheetB: Sheet;

/** Khung mẫu của từng biểu, đọc lúc dựng — máy chủ chỉ trả khung khi biểu chưa có bản lưu. */
const templateJson = new Map<number, string>();

async function workbookWith(api: Api, sheetId: number, cells: { row: number; col: number; value: unknown }[]) {
  const detail = await api.get<Sheet & { templateWorkbookJson: string }>(`/input_report_sheets/${sheetId}`);
  let raw = detail.dataJson || detail.templateWorkbookJson;
  try {
    JSON.parse(raw);
  } catch {
    raw = templateJson.get(sheetId)!; // bản lưu hỏng (ca "không phải JSON") → dựng lại từ khung mẫu
  }
  const wb = JSON.parse(raw) as {
    sheets: Record<string, { data?: { dataTable?: Record<string, Record<string, { value?: unknown }>> } }>;
  };
  const table = wb.sheets["1a"]!.data!.dataTable!;
  for (const { row, col, value } of cells) {
    table[row] ??= {};
    table[row][col] = { ...(table[row][col] ?? {}), value };
  }
  return { dataJson: JSON.stringify(wb), version: detail.version };
}


test.describe("Kiểm thử biên + gian lận trên phiếu nhập", () => {
  test.beforeAll(async () => {
    await purgeYear(YEAR);
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    const period = await periodByCode(so, YEAR, "Q1");
    const tranBien = await unitByCode(so, UNIT_TRAN_BIEN);
    const buuLong = await unitByCode(so, UNIT_BUU_LONG);
    const template = await templateByCode(so, TEMPLATE_1A);
    await setupAndOpen(so, period.id, [
      { unitId: tranBien.id, templateId: template.id },
      { unitId: buuLong.id, templateId: template.id },
    ]);
    periodId = period.id;
    reportA = (await reportOf(so, period.id, tranBien.id)).id;
    reportB = (await reportOf(so, period.id, buuLong.id)).id;
    await so.dispose();
    const a = await Api.as(ACCOUNTS.donviBienHoa);
    sheetA = (await sheetsOf(a, reportA))[0]!;
    templateJson.set(sheetA.id, (await a.get<{ templateWorkbookJson: string }>(`/input_report_sheets/${sheetA.id}`)).templateWorkbookJson);
    await a.dispose();
    const b = await Api.as(ACCOUNTS.donviBuuLong);
    sheetB = (await sheetsOf(b, reportB))[0]!;
    templateJson.set(sheetB.id, (await b.get<{ templateWorkbookJson: string }>(`/input_report_sheets/${sheetB.id}`)).templateWorkbookJson);
    await b.dispose();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
    const out = "test-results/kiem-thu-bien-gian-lan.json";
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    console.log("\n=== TỔNG KẾT ===");
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ca đạt`);
  });

  test("worst case: nhập liệu sai, thiếu điều kiện, thao tác sai thứ tự", async () => {
    const G = "Worst case";
    const unitApi = await Api.as(ACCOUNTS.donviBienHoa);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const so = await Raw.as(ACCOUNTS.soDuyet);

    record(G, "Nộp phiếu khi biểu chưa hoàn tất", await unit.send("post", `/input_reports/${reportA}/submit`), DENIED);
    record(G, "Sở duyệt phiếu còn Đang nhập (chưa nộp)", await so.send("post", `/input_reports/${reportA}/approve`), DENIED);
    record(G, "Lưu biểu thiếu dataJson", await unit.send("put", `/input_report_sheets/${sheetA.id}`, { version: sheetA.version }), [400, 422]);
    record(G, "Lưu dataJson không phải JSON", await unit.send("put", `/input_report_sheets/${sheetA.id}`, { dataJson: "not-json{", version: sheetA.version }), DENIED, "máy chủ ghi chú 'lưu nguyên, không đọc nội dung'");

    // Số âm, chữ, số khổng lồ: lưu rồi thử Hoàn tất (hook validate của biểu chạy lúc hoàn tất).
    // CSDL thử chạy kịch bản seed 114 của biểu 1a — chỉ kiểm số âm. Chữ / 1e20 / 2.5 người do kịch
    // bản 1a thật chặn (changeset 172, chạy trên trình duyệt), nên ở đây máy chủ còn nhận (200).
    const SEED_ONLY_CHECKS_NEGATIVE = [200];
    for (const [label, value, expected] of [
      ["Số âm (-5 người)", -5, DENIED],
      ["Chữ trong ô số ('abc')", "abc", SEED_ONLY_CHECKS_NEGATIVE],
      ["Số khổng lồ (1e20)", 1e20, SEED_ONLY_CHECKS_NEGATIVE],
      ["Số thập phân số người (2.5)", 2.5, SEED_ONLY_CHECKS_NEGATIVE],
    ] as const) {
      const body = await workbookWith(unitApi, sheetA.id, [{ row: 6, col: 2, value }]);
      const saved = await unit.send("put", `/input_report_sheets/${sheetA.id}`, body);
      const done = await unit.send("post", `/input_report_sheets/${sheetA.id}/complete`);
      record(G, `${label} → Kiểm tra & hoàn tất`, done, [...expected], `lưu: ${saved.status}`);
      if (done.status < 300) await unit.send("post", `/input_report_sheets/${sheetA.id}/reopen`);
    }

    // Ghi đè bản cũ (khoá lạc quan): lưu hai lần cùng version.
    const fresh = await workbookWith(unitApi, sheetA.id, [{ row: 6, col: 2, value: 3 }]);
    await unit.send("put", `/input_report_sheets/${sheetA.id}`, fresh);
    record(G, "Lưu bằng version cũ (hai tab cùng sửa)", await unit.send("put", `/input_report_sheets/${sheetA.id}`, fresh), [409]);

    // Đính kèm giả PDF.
    record(G, "Đính kèm file .pdf nhưng nội dung là EXE", await unit.upload(`/input_reports/${reportA}/attachments`, { name: "kho-bac.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\x90\x00 fake exe", "latin1") }), DENIED);
    record(G, "Đính kèm file .exe", await unit.upload(`/input_reports/${reportA}/attachments`, { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") }), DENIED);
    record(G, "Xác nhận Kho bạc thiếu giá trị", await unit.send("put", `/input_reports/${reportA}/treasury_confirmation`, {}), [400, 422]);

    // Hoàn tất hợp lệ nhưng chưa có Kho bạc → nộp phải bị chặn.
    await fillAndCompleteSheet(unitApi, sheetA.id, "1a", [{ row: 6, col: 2, value: 12 }, { row: 6, col: 4, value: 34_500_000 }]);
    record(G, "Nộp phiếu khi chưa đính kèm xác nhận Kho bạc", await unit.send("post", `/input_reports/${reportA}/submit`), DENIED);

    await attachTreasury(unitApi, reportA);
    const first = await unit.send("post", `/input_reports/${reportA}/submit`);
    record(G, "Nộp phiếu hợp lệ (đối chứng)", first, [200, 201, 204]);
    record(G, "Nộp lại lần hai (bấm đúp)", await unit.send("post", `/input_reports/${reportA}/submit`), DENIED);
    record(G, "Sửa số liệu sau khi đã nộp", await unit.send("put", `/input_report_sheets/${sheetA.id}`, await workbookWith(unitApi, sheetA.id, [{ row: 6, col: 2, value: 99 }])), DENIED);
    record(G, "Mở lại biểu sau khi đã nộp", await unit.send("post", `/input_report_sheets/${sheetA.id}/reopen`), DENIED);

    record(G, "Trả lại phiếu không có lý do", await so.send("post", `/input_reports/${reportA}/return`, { reason: "  " }), [400, 422]);
    record(G, "Trả lại phiếu lý do 1001 ký tự", await so.send("post", `/input_reports/${reportA}/return`, { reason: "x".repeat(1001) }), [400, 422]);

    // Hạn nộp lùi về quá khứ / trước ngày cuối kỳ.
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    record(G, "Đặt hạn nộp trước ngày cuối kỳ", await dh.send("put", `/report_periods/${periodId}`, { deadline: `${YEAR}-03-15` }), DENIED);
    record(G, "Ngày đầu kỳ sau ngày cuối kỳ", await dh.send("put", `/report_periods/${periodId}`, { fromDate: `${YEAR}-05-01`, toDate: `${YEAR}-04-01` }), DENIED);
    record(G, "Tạo lịch năm ngoài khoảng cho phép (1900)", await dh.send("post", `/report_calendars`, { year: 1900 }), DENIED);
    record(G, "Tạo trùng lịch năm đã có", await dh.send("post", `/report_calendars`, { year: YEAR }), DENIED);

    for (const c of [unit, so, dh]) await c.dispose();
    await unitApi.dispose();
  });

  test("cheating case: vượt quyền, xem/sửa phiếu đơn vị khác, giả token", async () => {
    const G = "Cheating case";
    const other = await Raw.as(ACCOUNTS.donviBuuLong); // không phải chủ phiếu A
    const owner = await Raw.as(ACCOUNTS.donviBienHoa);
    const ownerApi = await Api.as(ACCOUNTS.donviBienHoa);

    record(G, "Đơn vị B xem phiếu của đơn vị A theo id", await other.send("get", `/input_reports/${reportA}`), FORBIDDEN);
    const listById = await other.send("get", `/input_reports?id=${reportA}`);
    record(G, "Đơn vị B xem phiếu A qua lọc ?id= (getMany)", { status: listById.body.includes(`"id":${reportA}`) ? 299 : 200, body: listById.body }, [200], "299 = lộ phiếu A");
    record(G, "Đơn vị B đọc biểu của phiếu A", await other.send("get", `/input_report_sheets/${sheetA.id}`), FORBIDDEN);
    const sheetsList = await other.send("get", `/input_report_sheets?report.id=${reportA}`);
    record(G, "Đơn vị B liệt kê biểu của phiếu A", { status: sheetsList.body.includes(`"id":${sheetA.id}`) ? 299 : 200, body: sheetsList.body }, [200], "299 = lộ biểu A");
    record(G, "Đơn vị B ghi số liệu vào biểu đơn vị A", await other.send("put", `/input_report_sheets/${sheetA.id}`, { dataJson: "{}", version: null }), FORBIDDEN.concat([409]));
    record(G, "Đơn vị B tải tệp đính kèm của phiếu A", await other.send("get", `/input_reports/${reportA}/attachments`), FORBIDDEN);
    record(G, "Đơn vị B nộp hộ phiếu đơn vị A", await other.send("post", `/input_reports/${reportA}/submit`), FORBIDDEN.concat([409]));
    record(G, "Đơn vị B xem sổ cái/đơn vị số liệu phiếu A", await other.send("get", `/input_reports/${reportA}/data_units`), FORBIDDEN);

    record(G, "Đơn vị tự duyệt phiếu của mình", await owner.send("post", `/input_reports/${reportA}/approve`), FORBIDDEN);
    record(G, "Đơn vị tự trả lại phiếu", await owner.send("post", `/input_reports/${reportA}/return`, { reason: "tự trả" }), FORBIDDEN);
    record(G, "Đơn vị mở đợt kỳ báo cáo", await owner.send("post", `/report_periods/${periodId}/publish`), FORBIDDEN);
    record(G, "Đơn vị sửa ma trận thiết lập", await owner.send("put", `/period_assignments/matrix`, { periodId, add: [], remove: [] }), FORBIDDEN);
    record(G, "Đơn vị đổi hạn nộp của kỳ", await owner.send("put", `/report_periods/${periodId}`, { deadline: `${YEAR}-12-31` }), FORBIDDEN);
    record(G, "Đơn vị xem danh sách người dùng", await owner.send("get", `/users`), FORBIDDEN);
    record(G, "Đơn vị xem danh sách vai trò", await owner.send("get", `/roles`), FORBIDDEN);
    record(G, "Đơn vị huỷ / khoá phiếu", await owner.send("post", `/input_reports/${reportB}/cancel`), FORBIDDEN);

    const list = await owner.send("get", `/input_reports?period.id=${periodId}`);
    record(G, "Danh sách phiếu của đơn vị A không chứa phiếu B", { status: list.body.includes(`"id":${reportB}`) ? 299 : 200, body: list.body }, [200], "299 = lộ phiếu B");

    // Sở duyệt phiếu A rồi thử sửa sau duyệt. Phiếu A chưa nộp (ca trước dừng giữa chừng) thì nộp trước.
    const statusA = (await ownerApi.get<{ status: string }>(`/input_reports/${reportA}`)).status;
    if (statusA !== "SUBMITTED") {
      await fillAndCompleteSheet(ownerApi, sheetA.id, "1a", [{ row: 6, col: 2, value: 12 }, { row: 6, col: 4, value: 34_500_000 }]);
      await attachTreasury(ownerApi, reportA);
      await ownerApi.post(`/input_reports/${reportA}/submit`);
    }
    const soDuyet = await Raw.as(ACCOUNTS.soDuyet);
    record(G, "Sở duyệt phiếu A (đối chứng)", await soDuyet.send("post", `/input_reports/${reportA}/approve`), [200, 201, 204]);
    record(G, "Đơn vị sửa số liệu sau khi Sở đã duyệt", await owner.send("put", `/input_report_sheets/${sheetA.id}`, await workbookWith(ownerApi, sheetA.id, [{ row: 6, col: 2, value: 1 }])), DENIED);
    record(G, "Sở duyệt lại phiếu đã duyệt", await soDuyet.send("post", `/input_reports/${reportA}/approve`), DENIED);
    record(G, "Sở điều hành (không có quyền duyệt) duyệt phiếu B", await (await Raw.as(ACCOUNTS.soDieuHanh)).send("post", `/input_reports/${reportB}/approve`), FORBIDDEN.concat(DENIED));

    // Gửi kèm trường lạ để đổi trạng thái (mass assignment).
    const b = await Api.as(ACCOUNTS.donviBuuLong);
    const bodyB = await workbookWith(b, sheetB.id, [{ row: 6, col: 2, value: 7 }]);
    const mass = await other.send("put", `/input_report_sheets/${sheetB.id}`, { ...bodyB, completion: "DONE", status: "APPROVED", reportId: reportA });
    const after = await b.get<Sheet>(`/input_report_sheets/${sheetB.id}`);
    record(G, "Gửi kèm completion=DONE/status=APPROVED khi lưu", { status: after.completion === "DONE" ? 299 : mass.status, body: `completion=${after.completion} ${mass.body}` }, [200, 400], "299 = trường lạ có tác dụng");
    await b.dispose();

    const anon = await Raw.as(null);
    record(G, "Không có token gọi danh sách phiếu", await anon.send("get", `/input_reports`), [401]);
    const fake = await Raw.as(null, "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.");
    record(G, "Token giả (alg=none, sub=admin)", await fake.send("get", `/users`), [401]);
    const anonCtx = await request.newContext();
    const bad = await anonCtx.post(`${API_URL}/auth/login`, { data: { username: "admin", password: "' OR 1=1 --" } });
    record(G, "Đăng nhập bằng chuỗi SQL injection", { status: bad.status(), body: (await bad.text()).slice(0, 200) }, [400, 401]);
    await anonCtx.dispose();

    for (const c of [other, owner, soDuyet, anon, fake]) await c.dispose();
    await ownerApi.dispose();
  });

  test("giao diện: đăng nhập sai, đơn vị vào màn của Sở, lý do trả lại chứa script", async ({ page }) => {
    const G = "UI";
    await page.goto("/login");
    await page.getByPlaceholder("Nhập tên đăng nhập").fill("donvi.buulong");
    await page.getByPlaceholder("Nhập mật khẩu").fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForTimeout(2000);
    const stillLogin = page.url().includes("/login");
    results.push({ group: G, case: "Đăng nhập sai mật khẩu ở lại màn đăng nhập", expect: "ở /login", got: page.url(), ok: stillLogin });
    expect.soft(stillLogin).toBe(true);

    // Sở trả lại phiếu B với lý do chứa script, đơn vị B mở phiếu: script không được chạy.
    const unitB = await Api.as(ACCOUNTS.donviBuuLong);
    await fillAndCompleteSheet(unitB, sheetB.id, "1a", [{ row: 6, col: 2, value: 4 }, { row: 6, col: 4, value: 1_000_000 }]);
    await attachTreasury(unitB, reportB);
    await unitB.post(`/input_reports/${reportB}/submit`);
    await unitB.dispose();
    const so = await Api.as(ACCOUNTS.soDuyet);
    const xss = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>Thiếu số liệu`;
    await so.post(`/input_reports/${reportB}/return`, { reason: xss });
    await so.dispose();

    let dialogFired = false;
    page.on("dialog", (d) => { dialogFired = true; void d.dismiss(); });
    await useReportYear(page, YEAR);
    await login(page, ACCOUNTS.donviBuuLong);
    await page.goto("/input-reports");
    await page.waitForTimeout(3000);
    const live = (await reportOf(await Api.as(ACCOUNTS.donviBuuLong), periodId, (await unitByCode(await Api.as(ACCOUNTS.soDieuHanh), UNIT_BUU_LONG)).id)).id;
    await page.goto(`/input-reports/${live}`);
    await page.waitForTimeout(6000);
    const executed = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);
    results.push({ group: G, case: "Lý do trả lại chứa <script>/<img onerror> không chạy", expect: "không chạy", got: executed || dialogFired ? "SCRIPT ĐÃ CHẠY" : "không chạy", ok: !executed && !dialogFired });
    expect.soft(executed).toBe(false);

    for (const path of ["/period-setup", "/users", "/roles", "/report-review", "/templates"]) {
      await page.goto(path);
      await page.waitForTimeout(2500);
      const text = (await page.locator("main, body").first().innerText()).slice(0, 400);
      const blocked = !page.url().endsWith(path) || /không có quyền|403|không được phép|Forbidden/i.test(text);
      const rows = await page.locator("tbody tr").count();
      results.push({ group: G, case: `Đơn vị gõ thẳng URL ${path}`, expect: "bị chặn hoặc không có dữ liệu", got: `url=${page.url().replace(/^https?:\/\/[^/]+/, "")} rows=${rows} ${text.replace(/\s+/g, " ").slice(0, 80)}`, ok: blocked || rows === 0 });
    }
  });
});
