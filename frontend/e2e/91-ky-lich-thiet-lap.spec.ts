// Kiểm thử mở rộng nhóm A (chạy tay, chưa đưa vào CI): lịch báo cáo, kỳ, ma trận thiết lập,
// mở đợt / chốt / gia hạn / thu hồi, lịch sử mở đợt — happy + worst + cheating, API + giao diện.
// Năm riêng 2035 (vòng đời kỳ qua API) và 2036 (CRUD lịch qua API, giao diện, khoá năm), dọn
// trước và sau. Mỗi ca ghi mã HTTP thật; ca cuối khẳng định mọi ca đạt rồi in bảng tổng kết.
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import pg from "pg";

import {
  ACCOUNTS,
  API_URL,
  Api,
  TEMPLATE_1A,
  reportOf,
  sheetsOf,
  unitSubmitsViaApi,
  type Account,
} from "./support/api";
import { databaseUrl, purgeYear } from "./support/db";
import { expectToast, login, logout, useReportYear } from "./support/ui";

const Y1 = 2035; // vòng đời kỳ qua API
const Y2 = 2036; // CRUD lịch qua API → giao diện → khoá năm
const VIEWER: Account = { username: "viewer", password: "User@123" } as unknown as Account;

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];

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
  async send(method: "get" | "post" | "put" | "patch" | "delete", path: string, data?: unknown) {
    const opts =
      data === undefined
        ? undefined
        : typeof data === "string"
          ? { data, headers: { "Content-Type": "application/json" } }
          : { data };
    const res = await this.ctx[method](`${API_URL}${path}`, opts);
    const body = await res.text();
    let json: ApiJson = null;
    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      /* không phải JSON */
    }
    return { status: res.status(), body: body.slice(0, 400), json };
  }
  dispose() {
    return this.ctx.dispose();
  }
}

/**
 * Thân JSON của API trong spec dò quyền / dò biên: dạng tuỳ endpoint, đọc trường tuỳ ý. Một kiểu
 * nới duy nhất ở đây thay cho ép kiểu từng chỗ (hàng trăm chỗ đọc thân phản hồi).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- thân JSON tuỳ endpoint, chỉ dùng trong test
type ApiJson = any;

const DENIED = [400, 403, 404, 409, 422];
const BAD = [400, 422];
const FORBIDDEN = [401, 403];
const OK = [200, 201, 204];

function record(group: string, name: string, got: { status: number; body: string }, allowed: number[], note?: string) {
  const ok = allowed.includes(got.status);
  results.push({
    group,
    case: name,
    expect: allowed.join("/"),
    got: `${got.status} ${String(got.body).replace(/\s+/g, " ").slice(0, 150)}`,
    ok,
    note,
  });
}
function check(group: string, name: string, expectText: string, gotText: string, ok: boolean, note?: string) {
  results.push({ group, case: name, expect: expectText, got: gotText.replace(/\s+/g, " ").slice(0, 200), ok, note });
}
/** Chạy một khối; lỗi bất ngờ (dựng dữ liệu hỏng, locator không thấy…) ghi thành ca FAIL thay vì dừng spec. */
async function step(group: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    check(group, `${name} (lỗi khi chạy)`, "chạy hết", String((error as Error).message).slice(0, 300), false);
  }
}

async function sql<T = ApiJson>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}
/** Dựng trạng thái Quá hạn (hạn nộp của năm e2e luôn ở tương lai, job ngày không tự đưa về). */
async function forceOverdue(periodId: number) {
  await sql(`UPDATE asxh_report_periods SET status = 'OVERDUE' WHERE id = $1`, [periodId]);
}
async function unitId(budgetCode: string): Promise<number> {
  const rows = await sql<{ id: string }>(`SELECT id FROM asxh_report_units WHERE budget_code = $1`, [budgetCode]);
  return Number(rows[0].id);
}
async function templateId(code: string): Promise<number> {
  const rows = await sql<{ id: string }>(`SELECT id FROM asxh_templates WHERE code = $1`, [code]);
  return Number(rows[0].id);
}

type P = { id: number; code: string; name: string; status: string; fromDate: string; toDate: string; openFrom: string; deadline: string; deadlineManual: boolean };
async function periodsOf(api: Raw, year: number): Promise<Record<string, P>> {
  const res = await api.send("get", `/report_periods?year=${year}&_start=0&_end=200`);
  const map: Record<string, P> = {};
  for (const p of (res.json ?? []) as P[]) map[p.code] = p;
  return map;
}
async function periodNow(api: Raw, id: number): Promise<P> {
  return (await api.send("get", `/report_periods/${id}`)).json as P;
}

let TB = 0; // UBND phường Trấn Biên
let BL = 0; // UBND phường Bửu Long
let HA = 0; // UBND phường Hoá An (không có tài khoản — chỉ để đợt bổ sung)
let TP = 0; // UBND phường Tân Phong (ngừng hoạt động)
let T1A = 0; // biểu chi tiết 1a
let TH = 0; // biểu tổng hợp

test.describe("Nhóm A — lịch, kỳ, thiết lập & điều hành, mở đợt, lịch sử mở đợt", () => {
  test.describe.configure({ timeout: 600_000 });

  test.beforeAll(async () => {
    await purgeYear(Y1);
    await purgeYear(Y2);
    TB = await unitId("1051101");
    BL = await unitId("1051102");
    HA = await unitId("1051103");
    TP = await unitId("1051104");
    T1A = await templateId(TEMPLATE_1A);
    TH = await templateId("BM-000003");
  });

  test.afterEach(() => saveResults());

  test.afterAll(async () => {
    await purgeYear(Y1);
    await purgeYear(Y2);
    saveResults();
    console.log("\n=== TỔNG KẾT NHÓM A ===");
    for (const r of results)
      console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}${r.note ? ` | ${r.note}` : ""}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ca đạt`);
  });

  // ---------------------------------------------------------------- 1. Lịch báo cáo
  test("API /report_calendars: tạo, xem, xem trước, cập nhật, xoá + biên + vượt quyền", async () => {
    const G = "Lịch";
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const duyet = await Raw.as(ACCOUNTS.soDuyet);
    const viewer = await Raw.as(VIEWER);
    const anon = await Raw.as(null);
    let calId = 0;

    await step(G, "happy", async () => {
      const created = await dh.send("post", `/report_calendars`, { year: Y2, deadlineDays: 10, kinds: ["thang", "quy"] });
      record(G, "Tạo lịch 2036 (tháng + quý, hạn 10 ngày)", created, [201]);
      calId = created.json?.id;
      check(G, "Tạo lịch sinh đúng 16 kỳ", "createdPeriods=16", `createdPeriods=${created.json?.createdPeriods}`, created.json?.createdPeriods === 16);
      const list = await dh.send("get", `/report_calendars?year=${Y2}`);
      check(G, "Danh sách lọc year=2036 có lịch vừa tạo", "1 dòng năm 2036", list.body, list.status === 200 && (list.json ?? []).some((c: ApiJson) => c.id === calId));
      record(G, "Xem lịch theo id", await dh.send("get", `/report_calendars/${calId}`), [200]);
      const preview = await dh.send("get", `/report_calendars/preview?year=${Y2}&deadlineDays=5&kinds=thang,quy`);
      check(G, "Xem trước: 16 kỳ, đều đánh dấu đã có", "16 dòng exists=true", `${preview.status} ${(preview.json ?? []).length} dòng, exists=${(preview.json ?? []).every((r: ApiJson) => r.exists)}`, preview.status === 200 && preview.json?.length === 16 && preview.json.every((r: ApiJson) => r.exists));
      const plan = await dh.send("get", `/report_calendars/${calId}/update_plan?deadlineDays=7&kinds=thang,quy,sau_thang,nam`);
      check(G, "update_plan thêm 6 tháng + năm = 3 kỳ mới", "addedKinds=2, createdPeriods=3", plan.body, plan.status === 200 && plan.json?.createdPeriods === 3);
      const patched = await dh.send("patch", `/report_calendars/${calId}`, { year: Y2, deadlineDays: 7, kinds: ["thang", "quy", "sau_thang", "nam"] });
      record(G, "PATCH thêm loại kỳ + đổi hạn 7 ngày", patched, [200]);
      const ps = await periodsOf(dh, Y2);
      check(G, "Sau PATCH có 19 kỳ, hạn Q1 = 07/04", "19 kỳ, Q1.deadline=2036-04-07", `${Object.keys(ps).length} kỳ, Q1.deadline=${ps.Q1?.deadline}`, Object.keys(ps).length === 19 && ps.Q1?.deadline === `${Y2}-04-07`);
      record(G, "PUT (cùng endpoint PATCH) chỉ đổi hạn 5 ngày", await dh.send("put", `/report_calendars/${calId}`, { deadlineDays: 5 }), [200]);
    });

    await step(G, "worst", async () => {
      record(G, "Tạo lịch thiếu năm", await dh.send("post", `/report_calendars`, {}), BAD);
      record(G, "Tạo lịch năm 1900 (ngoài khoảng)", await dh.send("post", `/report_calendars`, { year: 1900 }), BAD);
      record(G, "Tạo lịch năm 3000 (ngoài khoảng)", await dh.send("post", `/report_calendars`, { year: 3000 }), BAD);
      record(G, "Tạo trùng lịch năm 2036", await dh.send("post", `/report_calendars`, { year: Y2 }), [409]);
      record(G, "Tạo lịch hạn nộp 0 ngày", await dh.send("post", `/report_calendars`, { year: Y1, deadlineDays: 0 }), BAD);
      record(G, "Tạo lịch hạn nộp 366 ngày", await dh.send("post", `/report_calendars`, { year: Y1, deadlineDays: 366 }), BAD);
      record(G, "Tạo lịch hạn nộp âm (-5)", await dh.send("post", `/report_calendars`, { year: Y1, deadlineDays: -5 }), BAD);
      record(G, "Tạo lịch loại kỳ lạ ('xyz')", await dh.send("post", `/report_calendars`, { year: Y1, kinds: ["xyz"] }), BAD);
      record(G, "Tạo lịch năm là chữ ('abc')", await dh.send("post", `/report_calendars`, { year: "abc" }), BAD);
      const frac = await dh.send("post", `/report_calendars`, { year: 2035.5 });
      record(G, "Tạo lịch năm thập phân (2035.5)", frac, DENIED);
      if (frac.status === 201) await dh.send("delete", `/report_calendars/${frac.json?.id}`); // dọn để các ca sau đúng
      record(G, "Tạo lịch thân không phải JSON", await dh.send("post", `/report_calendars`, "{year: 2035"), BAD);
      const leftover = await sql(`SELECT 1 FROM asxh_report_calendars WHERE year_no = $1`, [Y1]);
      check(G, "Các lần tạo lỗi không để lại lịch 2035", "0 dòng", `${leftover.length} dòng`, leftover.length === 0);
      record(G, "Xem trước năm là chữ", await dh.send("get", `/report_calendars/preview?year=abc`), BAD);
      record(G, "Xem trước thiếu năm", await dh.send("get", `/report_calendars/preview`), BAD);
      record(G, "Xem trước hạn 0 ngày", await dh.send("get", `/report_calendars/preview?year=${Y1}&deadlineDays=0`), BAD);
      record(G, "Xem trước loại kỳ lạ", await dh.send("get", `/report_calendars/preview?year=${Y1}&kinds=xyz`), BAD);
      record(G, "Xem trước năm 3000", await dh.send("get", `/report_calendars/preview?year=3000`), BAD);
      record(G, "Xem lịch id không tồn tại", await dh.send("get", `/report_calendars/999999999`), [404]);
      record(G, "Xem lịch id là chữ", await dh.send("get", `/report_calendars/abc`), BAD);
      record(G, "update_plan bỏ hết loại kỳ (kinds rỗng)", await dh.send("get", `/report_calendars/${calId}/update_plan?kinds=`), [200, 400, 422], "kinds= rỗng ↔ giữ nguyên hoặc từ chối đều chấp nhận");
      record(G, "PATCH đổi năm của lịch", await dh.send("patch", `/report_calendars/${calId}`, { year: Y2 + 1 }), [409]);
      record(G, "PATCH bỏ hết loại kỳ", await dh.send("patch", `/report_calendars/${calId}`, { kinds: [] }), BAD);
      record(G, "PATCH hạn nộp 999 ngày", await dh.send("patch", `/report_calendars/${calId}`, { deadlineDays: 999 }), BAD);
      record(G, "PATCH lịch không tồn tại", await dh.send("patch", `/report_calendars/999999999`, { deadlineDays: 5 }), [404]);
      record(G, "Xoá lịch không tồn tại", await dh.send("delete", `/report_calendars/999999999`), [404]);
    });

    await step(G, "cheating", async () => {
      record(G, "Không token xem danh sách lịch", await anon.send("get", `/report_calendars`), [401]);
      record(G, "Token giả (alg=none)", await (await Raw.as(null, "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzby5kaWV1aGFuaCJ9.")).send("get", `/report_calendars`), [401]);
      record(G, "Đơn vị tạo lịch năm", await unit.send("post", `/report_calendars`, { year: Y1 }), FORBIDDEN);
      record(G, "Đơn vị sửa lịch", await unit.send("patch", `/report_calendars/${calId}`, { deadlineDays: 30 }), FORBIDDEN);
      record(G, "Đơn vị xoá lịch", await unit.send("delete", `/report_calendars/${calId}`), FORBIDDEN);
      record(G, "Sở duyệt tạo lịch năm", await duyet.send("post", `/report_calendars`, { year: Y1 }), FORBIDDEN);
      record(G, "Sở duyệt xoá lịch", await duyet.send("delete", `/report_calendars/${calId}`), FORBIDDEN);
      record(G, "Viewer sửa lịch", await viewer.send("patch", `/report_calendars/${calId}`, { deadlineDays: 30 }), FORBIDDEN);
      record(G, "Viewer xoá lịch", await viewer.send("delete", `/report_calendars/${calId}`), FORBIDDEN);
      record(G, "Đơn vị (có quyền đọc) xem lịch", await unit.send("get", `/report_calendars/${calId}`), [200], "quyền report_calendars:read được cấp cho đơn vị");
    });

    await step(G, "xoá lịch có kỳ đã dùng", async () => {
      const ps = await periodsOf(dh, Y2);
      await dh.send("put", `/period_assignments/matrix`, { periodId: ps.Q1.id, add: [{ unitId: TB, templateId: T1A }], remove: [] });
      record(G, "Xoá lịch khi có kỳ đã gán đơn vị", await dh.send("delete", `/report_calendars/${calId}`), [409]);
      record(G, "PATCH bỏ loại kỳ Quý (có kỳ đã gán)", await dh.send("patch", `/report_calendars/${calId}`, { kinds: ["thang"] }), [409]);
      record(G, "PATCH bỏ loại kỳ Năm (chưa dùng) — được", await dh.send("patch", `/report_calendars/${calId}`, { kinds: ["thang", "quy", "sau_thang"] }), [200]);
      await dh.send("put", `/period_assignments/matrix`, { periodId: ps.Q1.id, add: [], remove: [{ unitId: TB, templateId: T1A }] });
      record(G, "Xoá lịch khi mọi kỳ chưa thiết lập (happy)", await dh.send("delete", `/report_calendars/${calId}`), [200]);
      record(G, "Xoá lại lịch đã xoá", await dh.send("delete", `/report_calendars/${calId}`), [404]);
      const left = await sql(`SELECT count(*)::int n FROM asxh_report_periods p JOIN asxh_report_calendars c ON c.id=p.calendar_id WHERE c.year_no=$1`, [Y2]);
      check(G, "Xoá lịch xoá luôn các kỳ", "0 kỳ", `${left[0].n} kỳ`, left[0].n === 0);
    });

    for (const c of [dh, unit, duyet, viewer, anon]) await c.dispose();
  });

  // ---------------------------------------------------------------- 2. Kỳ báo cáo
  test("API /report_periods: xem, sửa cửa sổ nhập, xoá, setup + biên + mass assignment + vượt quyền", async () => {
    const G = "Kỳ";
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const duyet = await Raw.as(ACCOUNTS.soDuyet);
    const viewer = await Raw.as(VIEWER);
    await dh.send("post", `/report_calendars`, { year: Y1 }); // mặc định tháng + quý + 6 tháng, hạn 5 ngày
    const ps = await periodsOf(dh, Y1);

    await step(G, "happy", async () => {
      check(G, "Lịch mặc định sinh 18 kỳ", "18", String(Object.keys(ps).length), Object.keys(ps).length === 18);
      record(G, "Xem kỳ Q1 theo id", await dh.send("get", `/report_periods/${ps.Q1.id}`), [200]);
      const many = await dh.send("get", `/report_periods?ids[0]=${ps.Q1.id}&ids[1]=${ps.Q2.id}`);
      check(G, "getMany ids[0..1] trả đúng 2 kỳ", "2 dòng", `${many.status} ${(many.json ?? []).length} dòng`, many.status === 200 && many.json?.length === 2);
      const upd = await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `${Y1}-04-20` });
      record(G, "Sửa hạn nộp Q1 thành 20/04 (sau cuối kỳ)", upd, [200]);
      check(G, "Hạn sửa tay được đánh dấu deadlineManual", "deadline=2035-04-20, manual=true", `deadline=${upd.json?.deadline}, manual=${upd.json?.deadlineManual}`, upd.json?.deadline === `${Y1}-04-20` && upd.json?.deadlineManual === true);
      record(G, "Sửa hạn Q2 = 01/07 (ngày ngay sau cuối kỳ, biên dưới)", await dh.send("patch", `/report_periods/${ps.Q2.id}`, { deadline: `${Y1}-07-01` }), [200]);
      record(G, "Sửa ngày mở nhập Q1 = 05/01", await dh.send("patch", `/report_periods/${ps.Q1.id}`, { openFrom: `${Y1}-01-05` }), [200]);
      const setup = await dh.send("get", `/report_periods/${ps.Q1.id}/setup`);
      check(G, "setup kỳ DRAFT: không mở đợt/chốt/thu hồi được", "canPublish=false, canClose=false, canWithdraw=false", setup.body, setup.status === 200 && setup.json?.canPublish === false && setup.json?.canClose === false && setup.json?.canWithdraw === false);
      const locks = await dh.send("get", `/report_periods/setup_locks?ids[0]=${ps.Q1.id}&ids[1]=${ps.T1.id}`);
      check(G, "setup_locks khi chưa kỳ nào mở đợt → rỗng", "[]", locks.body, locks.status === 200 && Array.isArray(locks.json) && locks.json.length === 0);
      record(G, "Xoá kỳ T12 chưa thiết lập (happy)", await dh.send("delete", `/report_periods/${ps.T12.id}`), [200]);
      record(G, "Xem kỳ vừa xoá", await dh.send("get", `/report_periods/${ps.T12.id}`), [404]);
    });

    await step(G, "worst", async () => {
      record(G, "Hạn nộp = ngày cuối kỳ (31/03)", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `${Y1}-03-31` }), BAD);
      record(G, "Hạn nộp trước ngày cuối kỳ (15/03)", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `${Y1}-03-15` }), BAD);
      record(G, "Hạn nộp ở quá khứ (01/01/2020)", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `2020-01-01` }), BAD, "năm e2e ở tương lai nên luật 'trước cuối kỳ' bắt trước luật 'đã qua'");
      record(G, "Ngày mở nhập sau hạn nộp", await dh.send("put", `/report_periods/${ps.Q1.id}`, { openFrom: `${Y1}-05-01` }), BAD);
      record(G, "Hạn nộp là chữ ('abc')", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: "abc" }), BAD);
      record(G, "Hạn nộp ngày không có thật (30/02)", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `${Y1}-02-30` }), BAD);
      record(G, "Hạn nộp dạng dd/MM/yyyy", await dh.send("put", `/report_periods/${ps.Q1.id}`, { deadline: `20/04/${Y1}` }), BAD);
      record(G, "Sửa kỳ không tồn tại", await dh.send("put", `/report_periods/999999999`, { deadline: `${Y1}-04-20` }), [404]);
      record(G, "Xem kỳ không tồn tại", await dh.send("get", `/report_periods/999999999`), [404]);
      record(G, "setup của kỳ không tồn tại", await dh.send("get", `/report_periods/999999999/setup`), [404]);
      record(G, "setup_locks với id không tồn tại", await dh.send("get", `/report_periods/setup_locks?ids[0]=999999999`), [200, 404], "id lạ → 404 hoặc mảng rỗng");
      record(G, "setup_locks không truyền ids", await dh.send("get", `/report_periods/setup_locks`), [200]);
      record(G, "Xoá kỳ không tồn tại", await dh.send("delete", `/report_periods/999999999`), [404]);
      record(G, "POST tạo kỳ trực tiếp (không có endpoint)", await dh.send("post", `/report_periods`, { code: "X" }), [400, 404, 405]);
    });

    await step(G, "mass assignment", async () => {
      const before = await periodNow(dh, ps.Q4.id);
      const res = await dh.send("put", `/report_periods/${ps.Q4.id}`, {
        deadline: `${Y1 + 1}-01-10`,
        status: "open",
        name: "HACK",
        code: "HACK",
        fromDate: `${Y1}-01-01`,
        toDate: `${Y1}-01-02`,
        kind: "nam",
        deadlineManual: false,
        calendar: { id: 1, year: 2026 },
      });
      const after = await periodNow(dh, ps.Q4.id);
      const leaked = after.status !== before.status || after.name !== before.name || after.code !== before.code || after.fromDate !== before.fromDate || after.toDate !== before.toDate;
      check(G, "PUT kỳ kèm status/name/code/fromDate/calendar lạ", "chỉ đổi deadline; status/name/code/khoảng giữ nguyên", `${res.status}; status=${after.status} name=${after.name} code=${after.code} from=${after.fromDate} to=${after.toDate} deadline=${after.deadline}`, !leaked);
    });

    await step(G, "cheating", async () => {
      record(G, "Đơn vị đổi hạn nộp kỳ", await unit.send("put", `/report_periods/${ps.Q2.id}`, { deadline: `${Y1}-12-31` }), FORBIDDEN);
      record(G, "Đơn vị xoá kỳ", await unit.send("delete", `/report_periods/${ps.T11.id}`), FORBIDDEN);
      record(G, "Sở duyệt đổi hạn nộp kỳ", await duyet.send("patch", `/report_periods/${ps.Q2.id}`, { deadline: `${Y1}-12-31` }), FORBIDDEN);
      record(G, "Viewer xoá kỳ", await viewer.send("delete", `/report_periods/${ps.T11.id}`), FORBIDDEN);
      record(G, "Đơn vị đọc setup kỳ (cần quyền thiết lập)", await unit.send("get", `/report_periods/${ps.Q1.id}/setup`), FORBIDDEN);
      record(G, "Viewer đọc setup_locks", await viewer.send("get", `/report_periods/setup_locks?ids[0]=${ps.Q1.id}`), FORBIDDEN);
      const still = await sql(`SELECT 1 FROM asxh_report_periods WHERE id = $1`, [ps.T11.id]);
      check(G, "Kỳ T11 còn nguyên sau các lần xoá trái quyền", "còn", still.length ? "còn" : "mất", still.length === 1);
    });

    for (const c of [dh, unit, duyet, viewer]) await c.dispose();
  });

  // ---------------------------------------------------------------- 3. Ma trận + điều hành
  test("API ma trận, sao thiết lập, mở đợt, chốt, gia hạn, thu hồi, lịch sử mở đợt", async () => {
    test.setTimeout(600_000);
    const G = "Thiết lập & điều hành";
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const unit = await Raw.as(ACCOUNTS.donviBienHoa);
    const unitBL = await Raw.as(ACCOUNTS.donviBuuLong);
    const duyet = await Raw.as(ACCOUNTS.soDuyet);
    const viewer = await Raw.as(VIEWER);
    const ps = await periodsOf(dh, Y1);
    const Q1 = ps.Q1.id;
    const M = (periodId: number, add: unknown[] = [], remove: unknown[] = []) =>
      dh.send("put", `/period_assignments/matrix`, { periodId, add, remove });
    const cell = (u: number, t = T1A) => ({ unitId: u, templateId: t });

    await step(G, "ma trận happy + worst", async () => {
      const r = await M(Q1, [cell(TB), cell(BL)]);
      record(G, "Gán 1a cho Trấn Biên + Bửu Long (Q1)", r, [200]);
      check(G, "Lưu ma trận: kỳ sang Đã thiết lập, added=2", "status=ready added=2", `status=${r.json?.periodStatus ?? r.json?.status} added=${r.json?.added}`, (r.json?.periodStatus ?? r.json?.status) === "ready" && r.json?.added === 2);
      const dup = await M(Q1, [cell(TB)]);
      check(G, "Gán trùng ô đã có → không thêm (unchanged)", "200 added=0 unchanged=1", `${dup.status} added=${dup.json?.added} unchanged=${dup.json?.unchanged}`, dup.status === 200 && dup.json?.added === 0);
      const dupInReq = await M(ps.Q4.id, [cell(TB), cell(TB), cell(TB)]);
      check(G, "Một lượt gửi trùng 3 lần cùng ô → chỉ thêm 1", "added=1", `${dupInReq.status} added=${dupInReq.json?.added}`, dupInReq.json?.added === 1);
      record(G, "Gỡ ô vừa thêm ở Q4 (kỳ chưa mở)", await M(ps.Q4.id, [], [cell(TB)]), [200]);
      check(G, "Gỡ hết ô → kỳ về Chưa thiết lập", "draft", (await periodNow(dh, ps.Q4.id)).status, (await periodNow(dh, ps.Q4.id)).status === "draft");
      record(G, "Gỡ ô không tồn tại", await M(ps.Q4.id, [], [cell(HA)]), [200, 409], "bỏ qua êm hoặc từ chối");
      record(G, "Ma trận rỗng (không add/remove)", await M(Q1), [409]);
      record(G, "Thiếu periodId", await dh.send("put", `/period_assignments/matrix`, { add: [cell(TB)] }), BAD);
      record(G, "periodId không tồn tại", await M(999999999, [cell(TB)]), [404]);
      record(G, "Đơn vị không tồn tại", await M(ps.Q4.id, [cell(999999999)]), [404]);
      record(G, "Biểu không tồn tại", await M(ps.Q4.id, [cell(TB, 999999999)]), [404]);
      record(G, "Ô thiếu unitId", await M(ps.Q4.id, [{ templateId: T1A }]), BAD);
      record(G, "Giao biểu tổng hợp (TH) cho đơn vị", await M(ps.Q4.id, [cell(TB, TH)]), [409]);
      record(G, "Giao cho đơn vị ngừng hoạt động (Tân Phong)", await M(ps.Q4.id, [cell(TP)]), [409]);
      record(G, "unitId là chữ", await M(ps.Q4.id, [{ unitId: "abc", templateId: T1A }]), BAD);
      const q4 = await sql(`SELECT count(*)::int n FROM asxh_period_assignments WHERE period_id = $1`, [ps.Q4.id]);
      check(G, "Các lần gán lỗi không ghi ô nào vào Q4", "0 ô", `${q4[0].n} ô`, q4[0].n === 0);
      // Hai phiên cùng gán một ô.
      const [a, b] = await Promise.all([M(ps.Q4.id, [cell(BL)]), M(ps.Q4.id, [cell(BL)])]);
      const n = (await sql(`SELECT count(*)::int n FROM asxh_period_assignments WHERE period_id = $1`, [ps.Q4.id]))[0].n;
      check(G, "Hai phiên cùng gán một ô (đồng thời)", "không 5xx, đúng 1 ô", `${a.status}/${b.status}, ${n} ô`, a.status < 500 && b.status < 500 && n === 1);
      await M(ps.Q4.id, [], [cell(BL)]);

      const list = await dh.send("get", `/period_assignments?period.id=${Q1}&_start=0&_end=100`);
      check(G, "GET /period_assignments?period.id=Q1 → 2 ô", "2", `${list.status} ${(list.json ?? []).length}`, list.json?.length === 2);
      record(G, "GET /period_assignments/{id}", await dh.send("get", `/period_assignments/${list.json?.[0]?.id}`), [200]);
      record(G, "GET /period_assignments/{id} không tồn tại", await dh.send("get", `/period_assignments/999999999`), [404]);
      record(G, "So.duyệt (quyền đọc) xem ô thiết lập", await duyet.send("get", `/period_assignments?period.id=${Q1}`), [200]);
    });

    await step(G, "sao thiết lập", async () => {
      const copy = await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [ps.Q2.id, ps.Q3.id] });
      record(G, "Áp dụng thiết lập Q1 cho Q2 + Q3", copy, [200]);
      check(G, "Sao thiết lập: thêm 4 ô, Q2/Q3 sang Đã thiết lập", "added=4", `added=${copy.json?.added} Q2=${(await periodNow(dh, ps.Q2.id)).status}`, copy.json?.added === 4 && (await periodNow(dh, ps.Q2.id)).status === "ready");
      const again = await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [ps.Q2.id] });
      check(G, "Sao lại lần hai → không thêm trùng", "added=0 unchanged=2", `${again.status} added=${again.json?.added} unchanged=${again.json?.unchanged}`, again.json?.added === 0);
      record(G, "Sao với danh sách kỳ đích rỗng", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [] }), BAD);
      record(G, "Sao sang chính kỳ nguồn", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [Q1] }), [409]);
      record(G, "Sao từ kỳ chưa có thiết lập (T5)", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: ps.T5.id, toPeriodIds: [ps.T6.id] }), [409]);
      record(G, "Sao từ kỳ không tồn tại", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: 999999999, toPeriodIds: [ps.T6.id] }), [404]);
      record(G, "Sao sang kỳ không tồn tại", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [999999999] }), [404]);
      record(G, "Đơn vị gọi sao thiết lập", await unit.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [ps.T6.id] }), FORBIDDEN);
      record(G, "Sở duyệt gọi sao thiết lập", await duyet.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [ps.T6.id] }), FORBIDDEN);
      record(G, "Đơn vị sửa ma trận", await unit.send("put", `/period_assignments/matrix`, { periodId: Q1, add: [cell(HA)], remove: [] }), FORBIDDEN);
      record(G, "Sở duyệt sửa ma trận", await duyet.send("put", `/period_assignments/matrix`, { periodId: Q1, add: [cell(HA)], remove: [] }), FORBIDDEN);
      record(G, "Viewer xem ô thiết lập", await viewer.send("get", `/period_assignments?period.id=${Q1}`), FORBIDDEN);
      record(G, "Đơn vị xem ô thiết lập", await unit.send("get", `/period_assignments?period.id=${Q1}`), FORBIDDEN);
    });

    await step(G, "mở đợt", async () => {
      // T1 (trùng Q1) thiết lập sẵn để kiểm khoá cả kỳ sau khi Q1 mở.
      await M(ps.T1.id, [cell(TB)]);
      record(G, "Đơn vị mở đợt", await unit.send("post", `/report_periods/${Q1}/publish`), FORBIDDEN);
      record(G, "Sở duyệt mở đợt", await duyet.send("post", `/report_periods/${Q1}/publish`), FORBIDDEN);
      record(G, "Viewer mở đợt", await viewer.send("post", `/report_periods/${Q1}/publish`), FORBIDDEN);
      record(G, "Mở đợt kỳ chưa thiết lập (T4)", await dh.send("post", `/report_periods/${ps.T4.id}/publish`), [409]);
      record(G, "Mở đợt kỳ không tồn tại", await dh.send("post", `/report_periods/999999999/publish`), [404]);
      const pub = await dh.send("post", `/report_periods/${Q1}/publish`);
      record(G, "Mở đợt Q1 (happy)", pub, [200]);
      check(G, "Mở đợt: kỳ Đang mở, tạo 2 phiếu", "status=open reportCount=2", `status=${pub.json?.period?.status ?? pub.json?.status} ${pub.json?.message}`, (await periodNow(dh, Q1)).status === "open" && /tạo 2 phiếu/.test(pub.json?.message ?? ""));
      record(G, "Mở đợt Q1 lần hai (không có ô mới)", await dh.send("post", `/report_periods/${Q1}/publish`), [409]);
      const pubs = (await dh.send("get", `/publications?period.id=${Q1}`)).json ?? [];
      check(G, "Mở hai lần chỉ có 1 đợt", "1 đợt", `${pubs.length} đợt`, pubs.length === 1);

      // Hai phiên cùng bấm Mở đợt Q2.
      const [a, b] = await Promise.all([
        dh.send("post", `/report_periods/${ps.Q2.id}/publish`),
        dh.send("post", `/report_periods/${ps.Q2.id}/publish`),
      ]);
      const q2pubs = (await dh.send("get", `/publications?period.id=${ps.Q2.id}`)).json ?? [];
      const q2reports = (await sql(`SELECT count(*)::int n FROM asxh_input_reports WHERE period_id=$1`, [ps.Q2.id]))[0].n;
      check(G, "Bấm đúp Mở đợt Q2 (2 yêu cầu đồng thời)", "1 thành công, 1 đợt, 2 phiếu, không 5xx", `${a.status}/${b.status}; ${q2pubs.length} đợt; ${q2reports} phiếu`, [a.status, b.status].filter((s) => s === 200).length === 1 && a.status < 500 && b.status < 500 && q2pubs.length === 1 && q2reports === 2);

      const locks = await dh.send("get", `/report_periods/setup_locks?ids[0]=${ps.T1.id}&ids[1]=${ps["6TĐN"].id}&ids[2]=${ps.Q3.id}&ids[3]=${Q1}`);
      const locked = new Set((locks.json ?? []).map((l: ApiJson) => l.periodId));
      check(G, "Sau mở Q1+Q2: T1, 6TĐN bị khoá; Q3 và Q1 không", "T1,6TĐN khoá", locks.body, locked.has(ps.T1.id) && locked.has(ps["6TĐN"].id) && !locked.has(ps.Q3.id) && !locked.has(Q1));
      record(G, "Mở đợt T1 (trùng Q1 đã mở)", await dh.send("post", `/report_periods/${ps.T1.id}/publish`), [409]);
      record(G, "Gán thêm vào T1 (bị khoá cả kỳ)", await M(ps.T1.id, [cell(BL)]), [409]);
      record(G, "Sao thiết lập sang T2 (bị khoá)", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: Q1, toPeriodIds: [ps.T2.id] }), [409]);
      record(G, "Gỡ ô thừa ở T1 bị khoá vì trùng (UC-31 1a cho phép)", await M(ps.T1.id, [], [cell(TB)]), [200]);
      record(G, "Sửa hạn nộp kỳ đang mở", await dh.send("put", `/report_periods/${Q1}`, { deadline: `${Y1}-05-30` }), [409]);
      record(G, "Xoá kỳ đang mở", await dh.send("delete", `/report_periods/${Q1}`), [409]);
      const calId = (await dh.send("get", `/report_calendars?year=${Y1}`)).json?.[0]?.id;
      record(G, "Bỏ loại kỳ Quý khi có kỳ đang mở", await dh.send("patch", `/report_calendars/${calId}`, { kinds: ["thang", "sau_thang"] }), [409]);
      record(G, "Xoá lịch năm khi có kỳ đang mở", await dh.send("delete", `/report_calendars/${calId}`), [409]);
      record(G, "Gỡ ô ở kỳ đang mở", await M(Q1, [], [cell(BL)]), [409]);
      const setup = await dh.send("get", `/report_periods/${Q1}/setup`);
      check(G, "setup kỳ Đang mở: chốt + thu hồi được, không mở lần đầu", "canClose canWithdraw !canPublish", setup.body.slice(0, 200), setup.json?.canClose === true && setup.json?.canWithdraw === true && setup.json?.canPublish === false && (setup.json?.issuedCells ?? []).length === 2);
      const sup = await M(Q1, [cell(HA)]);
      check(G, "Gán thêm Hoá An vào kỳ đang mở → đợt bổ sung", "publication.kind=BO_SUNG", `${sup.status} ${sup.json?.message}`, sup.status === 200 && sup.json?.publication?.kind === "BO_SUNG");
    });

    await step(G, "lịch sử mở đợt", async () => {
      const list = await dh.send("get", `/publications?period.id=${Q1}`);
      check(G, "Q1 có 2 đợt (Lần đầu + Bổ sung)", "2", `${(list.json ?? []).map((p: ApiJson) => p.kind).join(",")}`, list.json?.length === 2);
      const first = (list.json ?? []).find((p: ApiJson) => p.kind === "LAN_DAU");
      record(G, "GET /publications/{id}", await dh.send("get", `/publications/${first?.id}`), [200]);
      const items = await dh.send("get", `/publications/${first?.id}/items`);
      const names = ((items.json?.items ?? []) as ApiJson[]).map((i) => i.unit?.name).join(", ");
      check(G, "GET /publications/{id}/items liệt kê 2 đơn vị", "200, có Trấn Biên + Bửu Long", `${items.status} ${names}`, items.status === 200 && /Trấn Biên/.test(names) && /Bửu Long/.test(names));
      const byYear = await dh.send("get", `/publications?year=${Y1}`);
      check(G, "Lọc đợt theo năm 2035", "3 đợt (Q1×2 + Q2)", `${(byYear.json ?? []).length}`, byYear.json?.length === 3);
      record(G, "Đợt không tồn tại", await dh.send("get", `/publications/999999999`), [404]);
      record(G, "Items của đợt không tồn tại", await dh.send("get", `/publications/999999999/items`), [404]);
      record(G, "Đơn vị xem lịch sử mở đợt", await unit.send("get", `/publications?period.id=${Q1}`), FORBIDDEN);
      record(G, "Đơn vị xem items đợt", await unit.send("get", `/publications/${first?.id}/items`), FORBIDDEN);
      record(G, "Viewer xem lịch sử mở đợt", await viewer.send("get", `/publications`), FORBIDDEN);
      record(G, "Sở duyệt (quyền đọc) xem lịch sử", await duyet.send("get", `/publications/${first?.id}`), [200]);
    });

    await step(G, "chốt đợt", async () => {
      record(G, "Gia hạn kỳ đang mở (chưa quá hạn)", await dh.send("post", `/report_periods/${Q1}/extend`, { deadline: `${Y1}-06-30` }), [409]);
      record(G, "Đơn vị chốt đợt", await unit.send("post", `/report_periods/${Q1}/close`), FORBIDDEN);
      record(G, "Sở duyệt chốt đợt", await duyet.send("post", `/report_periods/${Q1}/close`), FORBIDDEN);
      record(G, "Chốt kỳ chưa mở đợt (Q3 Đã thiết lập)", await dh.send("post", `/report_periods/${ps.Q3.id}/close`), [409]);
      const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
      const repTB = (await reportOf(tbApi, Q1, TB)).id;
      await unitSubmitsViaApi(tbApi, repTB, 12, 34_500_000);
      record(G, "Chốt khi còn phiếu chờ duyệt", await dh.send("post", `/report_periods/${Q1}/close`), [409]);
      record(G, "Duyệt phiếu Trấn Biên (dựng)", await duyet.send("post", `/input_reports/${repTB}/approve`), OK);
      const closed = await dh.send("post", `/report_periods/${Q1}/close`);
      record(G, "Chốt đợt Q1 (happy)", closed, [200]);
      check(G, "Sau chốt kỳ Đã đóng", "closed", (await periodNow(dh, Q1)).status, (await periodNow(dh, Q1)).status === "closed");
      record(G, "Chốt lại lần hai", await dh.send("post", `/report_periods/${Q1}/close`), [409]);

      // Đơn vị Bửu Long chưa nộp: phiếu đã bị chốt, không lưu/nộp được nữa.
      const blApi = await Api.as(ACCOUNTS.donviBuuLong);
      const repBL = await reportOf(blApi, Q1, BL);
      const sheetBL = (await sheetsOf(blApi, repBL.id))[0];
      const detail = (await unitBL.send("get", `/input_report_sheets/${sheetBL.id}`)).json;
      record(G, "Kỳ đã chốt: đơn vị vẫn lưu số liệu", await unitBL.send("put", `/input_report_sheets/${sheetBL.id}`, { dataJson: detail?.dataJson || detail?.templateWorkbookJson, version: detail?.version }), DENIED, `phiếu BL: ${repBL.status}`);
      record(G, "Kỳ đã chốt: đơn vị hoàn tất biểu", await unitBL.send("post", `/input_report_sheets/${sheetBL.id}/complete`), DENIED);
      record(G, "Kỳ đã chốt: đơn vị nộp phiếu", await unitBL.send("post", `/input_reports/${repBL.id}/submit`), DENIED);
      record(G, "Kỳ đã chốt: gán thêm ô", await M(Q1, [cell(HA, T1A), cell(BL, T1A)]), [409]);
      record(G, "Kỳ đã chốt: mở đợt", await dh.send("post", `/report_periods/${Q1}/publish`), [409]);
      record(G, "Kỳ đã chốt: gia hạn", await dh.send("post", `/report_periods/${Q1}/extend`, { deadline: `${Y1}-06-30` }), [409]);
      record(G, "Kỳ đã chốt: thu hồi", await dh.send("post", `/report_periods/${Q1}/withdraw`, { confirmName: ps.Q1.name }), [409]);
      record(G, "Kỳ đã chốt: sửa hạn nộp", await dh.send("patch", `/report_periods/${Q1}`, { deadline: `${Y1}-06-30` }), [409]);
      await tbApi.dispose();
      await blApi.dispose();
    });

    await step(G, "thu hồi", async () => {
      const Q2 = ps.Q2.id;
      const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
      const rep = (await reportOf(tbApi, Q2, TB)).id;
      await unitSubmitsViaApi(tbApi, rep, 5, 1_000_000);
      record(G, "Duyệt phiếu Trấn Biên Q2 (dựng)", await duyet.send("post", `/input_reports/${rep}/approve`), OK);
      record(G, "Sở duyệt thu hồi kỳ", await duyet.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: ps.Q2.name }), FORBIDDEN);
      record(G, "Đơn vị thu hồi kỳ", await unit.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: ps.Q2.name }), FORBIDDEN);
      record(G, "Thu hồi thiếu tên xác nhận", await dh.send("post", `/report_periods/${Q2}/withdraw`, {}), BAD);
      record(G, "Thu hồi tên xác nhận chỉ khoảng trắng", await dh.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: "   " }), BAD);
      record(G, "Thu hồi gõ sai tên kỳ", await dh.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: "Quý I/2035" }), [409]);
      record(G, "Thu hồi kỳ chưa mở đợt (Q3)", await dh.send("post", `/report_periods/${ps.Q3.id}/withdraw`, { confirmName: ps.Q3.name }), [409]);
      const w = await dh.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: `  ${ps.Q2.name} ` });
      record(G, "Thu hồi Q2 đã có phiếu được duyệt (nghiệp vụ cho phép, UC-29)", w, [200], "hộp xác nhận báo trước 'kể cả số liệu đã được phê duyệt'");
      const reports = (await sql(`SELECT count(*)::int n FROM asxh_input_reports WHERE period_id=$1`, [Q2]))[0].n;
      const ledger = (await sql(`SELECT count(*)::int n FROM asxh_ledger_entries WHERE period_id=$1`, [Q2]))[0].n;
      const pubs = (await dh.send("get", `/publications?period.id=${Q2}`)).json ?? [];
      check(G, "Sau thu hồi: kỳ Đã thiết lập, 0 phiếu, 0 dòng sổ cái, đợt Đã thu hồi, ô giữ nguyên", "ready, 0, 0, CANCELLED, 2 ô",
        `${(await periodNow(dh, Q2)).status}, ${reports} phiếu, ${ledger} sổ cái, ${pubs.map((p: ApiJson) => p.status).join(",")}, ${(await dh.send("get", `/period_assignments?period.id=${Q2}`)).json?.length} ô`,
        (await periodNow(dh, Q2)).status === "ready" && reports === 0 && ledger === 0 && pubs.every((p: ApiJson) => p.status === "CANCELLED"));
      record(G, "Thu hồi lại lần hai", await dh.send("post", `/report_periods/${Q2}/withdraw`, { confirmName: ps.Q2.name }), [409]);
      const again = await dh.send("post", `/report_periods/${Q2}/publish`);
      check(G, "Mở lại sau thu hồi được tính là Lần đầu", "kind=LAN_DAU", `${again.status} ${again.json?.publication?.kind}`, again.status === 200 && again.json?.publication?.kind === "LAN_DAU");
      await tbApi.dispose();
    });

    await step(G, "gia hạn", async () => {
      const Q3 = ps.Q3.id;
      await dh.send("post", `/report_periods/${Q3}/publish`);
      await forceOverdue(Q3);
      const setup = await dh.send("get", `/report_periods/${Q3}/setup`);
      check(G, "setup kỳ Quá hạn: gia hạn + chốt được", "canExtend canClose", setup.body.slice(0, 160), setup.json?.canExtend === true && setup.json?.canClose === true);
      // Quá hạn = khoá nhập hẳn.
      const tbApi = await Api.as(ACCOUNTS.donviBienHoa);
      const rep = await reportOf(tbApi, Q3, TB);
      const sheet = (await sheetsOf(tbApi, rep.id))[0];
      const d = (await unit.send("get", `/input_report_sheets/${sheet.id}`)).json;
      record(G, "Kỳ quá hạn: đơn vị lưu số liệu", await unit.send("put", `/input_report_sheets/${sheet.id}`, { dataJson: d?.dataJson || d?.templateWorkbookJson, version: d?.version }), DENIED);
      record(G, "Đơn vị gia hạn", await unit.send("post", `/report_periods/${Q3}/extend`, { deadline: `${Y1}-10-31` }), FORBIDDEN);
      record(G, "Sở duyệt gia hạn", await duyet.send("post", `/report_periods/${Q3}/extend`, { deadline: `${Y1}-10-31` }), FORBIDDEN);
      record(G, "Gia hạn thiếu ngày", await dh.send("post", `/report_periods/${Q3}/extend`, {}), BAD);
      record(G, "Gia hạn ngày là chữ", await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: "abc" }), BAD);
      record(G, "Gia hạn về ngày đã qua (01/01/2020)", await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: "2020-01-01" }), DENIED);
      record(G, "Gia hạn kỳ không tồn tại", await dh.send("post", `/report_periods/999999999/extend`, { deadline: `${Y1}-10-31` }), [404]);
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
      record(G, "Gia hạn = hôm nay (trước ngày mở nhập 2035 của kỳ)", await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: today }), DENIED, "cửa sổ nhập mở từ 01/07/2035");
      const early = await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: `${Y1}-08-01` });
      record(G, "Gia hạn về ngày TRƯỚC ngày cuối kỳ (01/08 < 30/09)", early, DENIED, "PUT kỳ chặn hạn ≤ ngày cuối kỳ (requireDeadlineAllowed); gia hạn phải nhất quán");
      if (early.status === 200) await forceOverdue(Q3);
      const ok = await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: `${Y1}-10-31` });
      record(G, "Gia hạn Q3 đến 31/10/2035 (happy)", ok, [200]);
      const after = await periodNow(dh, Q3);
      check(G, "Sau gia hạn: Đang mở, hạn mới", "open, 2035-10-31", `${after.status}, ${after.deadline}`, after.status === "open" && after.deadline === `${Y1}-10-31`);
      record(G, "Gia hạn lại khi đã Đang mở", await dh.send("post", `/report_periods/${Q3}/extend`, { deadline: `${Y1}-11-30` }), [409]);
      await tbApi.dispose();
    });

    for (const c of [dh, unit, unitBL, duyet, viewer]) await c.dispose();
  });

  // ---------------------------------------------------------------- 4. Giao diện
  test("Giao diện: lịch báo cáo (chọn hạn bằng lịch), thiết lập & điều hành, lịch sử mở đợt", async ({ page }) => {
    test.setTimeout(600_000);
    const G = "UI";
    const problems: string[] = [];
    watch(page, problems);
    await useReportYear(page, Y2);
    await login(page, ACCOUNTS.soDieuHanh);
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);

    await step(G, "lịch báo cáo", async () => {
      await page.goto("/report-calendar");
      await expect(page.getByText(`Năm ${Y2} chưa có lịch báo cáo`)).toBeVisible();
      await page.getByRole("button", { name: "Tạo lịch báo cáo" }).click();
      const picker = page.getByRole("button", { name: new RegExp(`^Hạn nộp Quý I/${Y2}:`) });
      await expect(picker).toBeVisible();
      check(G, "Form tạo: ô hạn Quý I mặc định 05/04/2036", "05/04/2036", (await picker.textContent()) ?? "", /05\/04\/2036/.test((await picker.textContent()) ?? ""));
      await picker.click();
      const pop = page.locator("[data-radix-popper-content-wrapper]");
      await expect(pop.getByText(`Tháng 4/${Y2}`)).toBeVisible();
      await pop.getByRole("button", { name: "Tháng trước" }).click();
      await expect(pop.getByText(`Tháng 3/${Y2}`)).toBeVisible();
      const marchDays = await dayStates(page);
      const m31 = marchDays.find((d) => d.text === "31" && !d.outside);
      const m15 = marchDays.find((d) => d.text === "15" && !d.outside);
      check(G, "Lịch chọn hạn: 31/03 (ngày cuối kỳ) bị khoá", "disabled", JSON.stringify(m31), m31?.disabled === true);
      check(G, "Lịch chọn hạn: 15/03 (trước cuối kỳ) bị khoá", "disabled", JSON.stringify(m15), m15?.disabled === true);
      await pop.getByRole("button", { name: "Tháng sau" }).click();
      const aprDays = await dayStates(page);
      const a1 = aprDays.find((d) => d.text === "1" && !d.outside);
      check(G, "Lịch chọn hạn: 01/04 (ngay sau cuối kỳ) chọn được", "enabled", JSON.stringify(a1), a1?.disabled === false);
      await page.locator("[data-radix-popper-content-wrapper] button[name='day']:not([disabled])").filter({ hasText: /^20$/ }).first().click();
      check(G, "Chọn 20/04 hiện lên ô hạn nộp", "20/04/2036", (await picker.textContent()) ?? "", /20\/04\/2036/.test((await picker.textContent()) ?? ""));

      // Worst: số ngày hạn nộp sai.
      const daysInput = page.locator("input[inputmode='numeric']").first();
      await daysInput.fill("0");
      await page.waitForTimeout(400);
      const msg0 = await page.locator("[data-slot='form-message'], .text-destructive-text, [id$='-form-item-message']").allInnerTexts();
      check(G, "Gõ 0 ngày hạn nộp hiện lỗi", "có thông báo lỗi", msg0.join(" | ") || "(không có)", msg0.join(" ").trim().length > 0);
      await daysInput.fill("abc");
      check(G, "Gõ chữ vào ô số ngày bị lọc bỏ", "ô rỗng", `"${await daysInput.inputValue()}"`, (await daysInput.inputValue()) === "");
      await daysInput.fill("5");

      await page.getByRole("button", { name: "Tạo lịch", exact: true }).click();
      await expectToast(page, new RegExp(`Đã tạo lịch báo cáo năm ${Y2} với 18 kỳ`));
      const ps = await periodsOf(dh, Y2);
      check(G, "Tạo lịch qua giao diện lưu hạn Q1 sửa tay 20/04", "18 kỳ, Q1=2036-04-20 manual", `${Object.keys(ps).length} kỳ, Q1=${ps.Q1?.deadline} manual=${ps.Q1?.deadlineManual}`, Object.keys(ps).length === 18 && ps.Q1?.deadline === `${Y2}-04-20` && ps.Q1?.deadlineManual === true);
      await expect(page.getByRole("button", { name: "Lưu lịch" })).toBeVisible();
    });

    const ps = await periodsOf(dh, Y2);
    const Q1 = `Quý I/${Y2}`;
    const primary = (name: string | RegExp) => page.getByRole("button", { name });

    await step(G, "thiết lập & mở đợt", async () => {
      await page.goto("/period-setup");
      await expect(page.getByRole("heading", { name: "Thiết lập & điều hành" })).toBeVisible();
      await page.getByText(Q1, { exact: true }).first().click();
      await expect(page.getByRole("heading", { name: Q1 })).toBeVisible();
      const openBtn = primary("Mở đợt báo cáo");
      check(G, "Kỳ Chưa thiết lập: nút Mở đợt bị khoá", "disabled", String(await openBtn.isDisabled()), await openBtn.isDisabled());
      for (const u of ["UBND phường Trấn Biên", "UBND phường Bửu Long"]) {
        const box = page.getByRole("checkbox", { name: `${u} — biểu 1a` });
        await box.click();
        await expect(box).toBeChecked();
      }
      check(G, "Có ô chờ lưu: nút chính đổi thành Lưu thay đổi", "visible", "", await primary("Lưu thay đổi").isVisible());
      await primary("Lưu thay đổi").click();
      await expectToast(page, /Đã lưu 2 ô/);
      await expect(primary("Mở đợt báo cáo")).toBeEnabled();
      check(G, "Sau lưu: Mở đợt bật", "enabled", "enabled", true);
      await page.getByRole("button", { name: "Thao tác khác" }).last().click();
      const wItem = page.getByRole("menuitem", { name: /Thu hồi & thiết lập lại/ });
      check(G, "Kỳ Đã thiết lập: mục Thu hồi bị khoá", "aria-disabled", String(await wItem.getAttribute("data-disabled")), (await wItem.getAttribute("data-disabled")) !== null);
      await page.keyboard.press("Escape");
      await primary("Mở đợt báo cáo").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(`Mở đợt báo cáo ${Q1}?`)).toBeVisible();
      await dialog.getByRole("button", { name: `Mở đợt ${Q1}` }).click();
      await expectToast(page, /đã mở, tạo 2 phiếu/);
      await expect(primary("Chốt đợt báo cáo")).toBeVisible();
      check(G, "Mở đợt qua giao diện → Đang mở, nút chính Chốt đợt", "open", (await periodNow(dh, ps.Q1.id)).status, (await periodNow(dh, ps.Q1.id)).status === "open");
      const issued = page.getByRole("checkbox", { name: "UBND phường Trấn Biên — biểu 1a" });
      check(G, "Ô đã phát phiếu không bỏ tích được", "aria-disabled=true", String(await issued.getAttribute("aria-disabled")), (await issued.getAttribute("aria-disabled")) === "true");
    });

    await step(G, "thu hồi", async () => {
      await page.getByRole("button", { name: "Thao tác khác" }).last().click();
      await page.getByRole("menuitem", { name: /Thu hồi & thiết lập lại/ }).click();
      const dialog = page.getByRole("dialog");
      const btn = dialog.getByRole("button", { name: `Thu hồi kỳ ${Q1}` });
      await dialog.getByLabel(/Gõ tên kỳ để xác nhận/).fill("Quý I/2035");
      check(G, "Gõ sai tên kỳ: nút Thu hồi bị khoá", "disabled", String(await btn.isDisabled()), await btn.isDisabled());
      await dialog.getByLabel(/Gõ tên kỳ để xác nhận/).fill(Q1);
      await btn.click();
      await expectToast(page, /Đã thu hồi kỳ/);
      await expect(primary("Mở đợt báo cáo")).toBeEnabled();
      check(G, "Thu hồi qua giao diện → kỳ Đã thiết lập", "ready", (await periodNow(dh, ps.Q1.id)).status, (await periodNow(dh, ps.Q1.id)).status === "ready");
      // Mở lại rồi chốt.
      await primary("Mở đợt báo cáo").click();
      await page.getByRole("dialog").getByRole("button", { name: `Mở đợt ${Q1}` }).click();
      await expectToast(page, /đã mở, tạo 2 phiếu/);
      await primary("Chốt đợt báo cáo").click();
      await page.getByRole("dialog").getByRole("button", { name: `Chốt đợt ${Q1}` }).click();
      await expectToast(page, /Đã chốt kỳ/);
      await page.waitForTimeout(1000);
      const closedHasPrimary = await page.getByRole("button", { name: /^(Mở đợt báo cáo|Chốt đợt báo cáo|Lưu thay đổi|Gia hạn & mở lại)$/ }).count();
      const boxes = page.getByRole("checkbox", { name: /— biểu/ });
      const states = await boxes.evaluateAll((els) => els.map((el) => el.getAttribute("aria-disabled")));
      const boxDisabled = states.length > 0 && states.every((v) => v === "true") ? "true" : `${states.filter((v) => v !== "true").length}/${states.length} ô còn bấm được`;
      check(G, "Kỳ Đã đóng: không còn nút chính, ô ma trận bị khoá", "0 nút, aria-disabled=true", `${closedHasPrimary} nút, ${boxDisabled}`, closedHasPrimary === 0 && boxDisabled === "true");
    });

    await step(G, "gia hạn", async () => {
      const Q2 = ps.Q2.id;
      await dh.send("put", `/period_assignments/matrix`, { periodId: Q2, add: [{ unitId: TB, templateId: T1A }], remove: [] });
      await dh.send("post", `/report_periods/${Q2}/publish`);
      await forceOverdue(Q2);
      await page.reload();
      await page.getByText(`Quý II/${Y2}`, { exact: true }).first().click();
      await expect(primary("Gia hạn & mở lại")).toBeVisible();
      await primary("Gia hạn & mở lại").click();
      const dialog = page.getByRole("dialog");
      const input = dialog.getByLabel(/Hạn nộp mới/);
      await input.fill("01/01/2020");
      await dialog.getByRole("button", { name: "Gia hạn và mở lại" }).click();
      check(G, "Gia hạn về ngày đã qua: báo lỗi tại chỗ", "Hạn nộp mới phải từ ngày … trở đi.", await dialog.innerText(), /Hạn nộp mới phải từ ngày \d{2}\/\d{2}\/\d{4} trở đi/.test(await dialog.innerText()));
      await input.fill("31/13/2036");
      await dialog.getByRole("button", { name: "Gia hạn và mở lại" }).click();
      check(G, "Gia hạn ngày không có thật (31/13)", "báo sai dạng ngày", await dialog.innerText(), /chưa đúng dạng|từ hôm nay/.test(await dialog.innerText()));
      await input.fill(`31/07/${Y2}`);
      await dialog.getByRole("button", { name: "Gia hạn và mở lại" }).click();
      await expectToast(page, /Đã gia hạn/);
      const after = await periodNow(dh, Q2);
      check(G, "Gia hạn qua giao diện → Đang mở, hạn 31/07/2036", "open 2036-07-31", `${after.status} ${after.deadline}`, after.status === "open" && after.deadline === `${Y2}-07-31`);
    });

    await step(G, "lịch sử mở đợt", async () => {
      await page.goto("/publication-history");
      await expect(page.getByRole("heading", { name: "Lịch sử mở đợt" })).toBeVisible();
      await page.waitForTimeout(1500);
      const rows = await page.locator("tbody tr").allInnerTexts();
      const q1Rows = rows.filter((r) => r.includes(Q1));
      check(G, "Lịch sử có 2 đợt Quý I (1 Đã thu hồi, 1 Đã tạo phiếu) + Quý II", "Q1×2, có 'Đã thu hồi', Q2×1",
        rows.map((r) => r.replace(/\s+/g, " ").slice(0, 80)).join(" || "),
        q1Rows.length === 2 && q1Rows.some((r) => /Đã thu hồi/.test(r)) && rows.some((r) => r.includes(`Quý II/${Y2}`)));
      const pubs = (await dh.send("get", `/publications?year=${Y2}`)).json ?? [];
      const live = pubs.find((p: ApiJson) => p.period.name === Q1 && p.status === "PUBLISHED");
      await page.goto(`/publication-history/${live.id}`);
      await expect(page.getByText("UBND phường Bửu Long").first()).toBeVisible();
      check(G, "Chi tiết đợt hiện các đơn vị đã phát", "có Trấn Biên + Bửu Long", "", await page.getByText("UBND phường Trấn Biên").first().isVisible());
      const cancelled = pubs.find((p: ApiJson) => p.status === "CANCELLED");
      await page.goto(`/publication-history/${cancelled.id}`);
      await expect(page.getByText(/Phiếu của đợt đã bị xoá khi thu hồi kỳ/)).toBeVisible();
      check(G, "Chi tiết đợt đã thu hồi báo phiếu đã xoá", "thấy câu báo", "thấy", true);
      await page.goto(`/publication-history/999999999`);
      await expect(page.getByText("Không tìm thấy đợt mở").first()).toBeVisible();
      check(G, "Đợt không tồn tại → 'Không tìm thấy đợt mở'", "thấy", "thấy", true);
    });

    await step(G, "vượt quyền giao diện", async () => {
      await logout(page);
      await login(page, ACCOUNTS.donviBienHoa);
      for (const path of ["/period-setup", "/publication-history"]) {
        await page.goto(path);
        await page.waitForTimeout(2500);
        const text = await page.locator("body").innerText();
        check(G, `Đơn vị gõ thẳng ${path}`, "Bạn chưa có quyền xem trang này", text.slice(0, 120), /chưa có quyền/.test(text));
      }
      await page.goto("/report-calendar");
      await expect(page.getByRole("heading", { name: new RegExp(`Lịch báo cáo năm`) })).toBeVisible();
      await page.waitForTimeout(1500);
      const writeBtns = await page.getByRole("button", { name: /^(Tạo lịch|Lưu lịch|Tạo lịch báo cáo)$/ }).count();
      const pk = page.getByRole("button", { name: /^Hạn nộp / }).first();
      const pkDisabled = (await pk.count()) > 0 ? await pk.isDisabled() : null;
      check(G, "Đơn vị mở Lịch báo cáo: chỉ xem (không nút ghi, ô hạn khoá)", "0 nút ghi, picker disabled", `${writeBtns} nút, picker disabled=${pkDisabled}`, writeBtns === 0 && pkDisabled === true);
      await logout(page);
      await login(page, VIEWER);
      await page.goto("/publication-history");
      await page.waitForTimeout(2500);
      const vt = await page.locator("body").innerText();
      check(G, "Viewer gõ thẳng /publication-history", "chưa có quyền", vt.slice(0, 120), /chưa có quyền/.test(vt));
    });

    check(G, "Không lỗi console / pageerror / HTTP 5xx trong suốt lượt UI", "0", problems.length ? problems.slice(0, 8).join(" || ") : "0", problems.length === 0);
    await dh.dispose();
  });

  // ---------------------------------------------------------------- 5. Khoá năm
  test("Khoá năm sau báo cáo năm (UC-60/UC-31): mọi thao tác thiết lập của năm bị chặn", async () => {
    const G = "Khoá năm";
    const dh = await Raw.as(ACCOUNTS.soDieuHanh);
    const ps = await periodsOf(dh, Y2);
    const ps1 = await periodsOf(dh, Y1);
    const cell = { unitId: TB, templateId: T1A };

    await step(G, "khoá năm", async () => {
      record(G, "Thiết lập sẵn Q3/2036 (trước khoá)", await dh.send("put", `/period_assignments/matrix`, { periodId: ps.Q3.id, add: [cell], remove: [] }), [200]);
      record(G, "Sao từ 2035 sang kỳ năm 2036", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: ps1.Q3.id, toPeriodIds: [ps.Q4.id] }), [409]);
      await forceOverdue(ps.Q2.id);
      await sql(
        `INSERT INTO asxh_dept_ledger_years (year_no, current_version, lock_state, lock_note, locked_at, locked_by, created_at, updated_at)
         VALUES ($1, 0, 'SUBMITTED', NULL, now(), 'e2e-A', now(), now())
         ON CONFLICT (year_no) DO UPDATE SET lock_state = 'SUBMITTED', locked_at = now(), locked_by = 'e2e-A'`,
        [Y2]
      );
      const locks = await dh.send("get", `/report_periods/setup_locks?ids[0]=${ps.Q3.id}&ids[1]=${ps.Q4.id}&ids[2]=${ps.Q2.id}`);
      check(G, "setup_locks: mọi kỳ 2036 khoá loại YEAR", "3 dòng YEAR", locks.body.slice(0, 200), (locks.json ?? []).length === 3 && locks.json.every((l: ApiJson) => l.kind === "YEAR"));
      record(G, "Năm khoá: gán thêm ô (Q4)", await dh.send("put", `/period_assignments/matrix`, { periodId: ps.Q4.id, add: [cell], remove: [] }), [409]);
      record(G, "Năm khoá: gỡ ô (Q3)", await dh.send("put", `/period_assignments/matrix`, { periodId: ps.Q3.id, add: [], remove: [cell] }), [409]);
      record(G, "Năm khoá: mở đợt Q3", await dh.send("post", `/report_periods/${ps.Q3.id}/publish`), [409]);
      record(G, "Năm khoá: sao thiết lập Q3 → Q4", await dh.send("post", `/period_assignments/copy`, { fromPeriodId: ps.Q3.id, toPeriodIds: [ps.Q4.id] }), [409]);
      record(G, "Năm khoá: gia hạn Q2 quá hạn", await dh.send("post", `/report_periods/${ps.Q2.id}/extend`, { deadline: `${Y2}-08-31` }), [409]);
      const setup = await dh.send("get", `/report_periods/${ps.Q3.id}/setup`);
      check(G, "setup Q3 năm khoá: không gán/mở đợt", "locked canAssign=false canPublish=false", setup.body.slice(0, 200), setup.json?.locked === true && setup.json?.canAssign === false && setup.json?.canPublish === false);
      const setupQ2 = await dh.send("get", `/report_periods/${ps.Q2.id}/setup`);
      check(G, "setup Q2 quá hạn năm khoá: không gia hạn", "canExtend=false", setupQ2.body.slice(0, 200), setupQ2.json?.canExtend === false);
      const n = (await sql(`SELECT count(*)::int n FROM asxh_period_assignments WHERE period_id = $1`, [ps.Q4.id]))[0].n;
      check(G, "Năm khoá: Q4 không có ô nào bị ghi lén", "0", String(n), n === 0);
      // Ghi nhận (không phải số liệu): sửa hạn kỳ chưa thiết lập / thêm loại kỳ ở năm đã khoá.
      const dl = await dh.send("put", `/report_periods/${ps.Q4.id}`, { deadline: `${Y2 + 1}-01-20` });
      record(G, "Năm khoá: sửa hạn nộp kỳ chưa thiết lập (Q4)", dl, [200, 409], `ghi nhận: nhận ${dl.status}`);
      const calId = (await dh.send("get", `/report_calendars?year=${Y2}`)).json?.[0]?.id;
      const addKind = await dh.send("patch", `/report_calendars/${calId}`, { kinds: ["thang", "quy", "sau_thang", "nam"] });
      record(G, "Năm khoá: thêm loại kỳ Năm vào lịch", addKind, [200, 409], `ghi nhận: nhận ${addKind.status}`);
    });

    await dh.dispose();
  });

  // ---------------------------------------------------------------- 6. Tổng kết
  test("Tổng kết: mọi ca đạt kỳ vọng", async () => {
    const failed = results.filter((r) => !r.ok).map((r) => `${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}`);
    expect(failed, failed.join(" || ")).toEqual([]);
  });
});

/** Ghi bảng kết quả ra file sau mỗi test — một ca hỏng (worker khởi động lại) không làm mất bảng. */
function saveResults() {
  const out = process.env.E2E_RESULTS_91 ?? "test-results-91/91-ky-lich-thiet-lap.json";
  fs.mkdirSync(out.replace(/[/][^/]+$/, ""), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
}

/** Ghi lỗi console / pageerror / HTTP 5xx của trang. */
function watch(page: Page, problems: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error" && !/ws:\/\/localhost:5001|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text().slice(0, 160)}`);
  });
  // Bỏ qua: lỗi localStorage của chính addInitScript (useReportYear) chạy trên about:blank, và
  // websocket HMR của vite dev (ws://localhost:5001) — môi trường test, không phải lỗi app.
  page.on("pageerror", (e) => {
    if (/Failed to read the 'localStorage' property/.test(e.message)) return;
    problems.push(`pageerror: ${e.message.slice(0, 160)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.status() < 500 && !/999999999/.test(r.url()) && r.status() !== 401)
      problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
  });
}

/** Trạng thái các ô ngày trong lịch đang mở (react-day-picker 8). */
async function dayStates(page: Page) {
  return page.locator("[data-radix-popper-content-wrapper] button[name='day']").evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent ?? "").trim(),
      disabled: (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true",
      outside: /outside/.test(el.className) || el.closest("[class*='outside']") !== null || /day-outside|rdp-day_outside/.test(el.className),
    }))
  );
}
