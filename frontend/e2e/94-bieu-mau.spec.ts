// Kiểm thử nhóm D (chạy tay): bộ mẫu, biểu mẫu, phiên bản mẫu (máy trạng thái), kịch bản +
// hộp cát GraalJS, Designer, Bản chất chỉ tiêu. Happy + worst + cheating, ghi bảng kết quả như
// spec 90. KHÔNG đụng biểu/bộ mẫu/phiên bản có sẵn: mọi thứ được sửa đều do spec này tạo, tên
// tiền tố "E2E-D-", xoá ở afterAll (biểu đã ban hành API không cho xoá → xoá thẳng trong CSDL thử).
// Năm riêng 2040 (kỳ Q1 để ghim phiên bản vào phiếu), dọn trước và sau.
import { request, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import pg from "pg";

import {
  ACCOUNTS,
  API_URL,
  Api,
  UNIT_TRAN_BIEN,
  createCalendar,
  periodByCode,
  reportOf,
  setupAndOpen,
  sheetsOf,
  unitByCode,
  type Account,
} from "./support/api";
import { databaseUrl, purgeYear } from "./support/db";
import { login } from "./support/ui";

const YEAR = 2040;
const P = "E2E-D-";
const VIEWER: Account = { username: "viewer", password: "User@123" } as unknown as Account;

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];

type Method = "get" | "post" | "put" | "patch" | "delete";
class Raw {
  private constructor(private readonly ctx: APIRequestContext) {}
  static async as(account: Account | null, token?: string) {
    let bearer = token;
    if (account) {
      const anon = await request.newContext();
      const res = await anon.post(`${API_URL}/auth/login`, { data: account });
      if (!res.ok()) throw new Error(`Đăng nhập ${account.username} lỗi ${res.status()}`);
      bearer = ((await res.json()) as { accessToken: string }).accessToken;
      await anon.dispose();
    }
    const ctx = await request.newContext({ extraHTTPHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
    return new Raw(ctx);
  }
  async send(method: Method, path: string, data?: unknown) {
    const t0 = Date.now();
    const res = await this.ctx[method](`${API_URL}${path}`, { ...(data === undefined ? {} : { data }), timeout: 120_000 });
    const text = await res.text();
    return { status: res.status(), body: text.slice(0, 700), full: text, ms: Date.now() - t0 };
  }
  dispose() {
    return this.ctx.dispose();
  }
}
type Res = { status: number; body: string; full?: string; ms?: number };

function record(group: string, name: string, got: Res, allowed: number[], note?: string) {
  const ok = allowed.includes(got.status);
  results.push({ group, case: name, expect: allowed.join("/"), got: `${got.status} ${got.body.replace(/\s+/g, " ").slice(0, 160)}`, ok, note });
}
function check(group: string, name: string, ok: boolean, expectText: string, gotText: string) {
  results.push({ group, case: name, expect: expectText, got: gotText.slice(0, 220), ok });
}
const json = <T>(r: Res) => JSON.parse(r.full ?? r.body) as T;

const DENIED = [400, 403, 404, 409, 422];
const BAD = [400, 422];
const FORBIDDEN = [401, 403];

/** Bảng tính tối thiểu một trang tên "E2E". */
function workbook(sheets = ["E2E"]) {
  const out: Record<string, unknown> = {};
  for (const name of sheets) {
    out[name] = {
      name,
      rowCount: 20,
      columnCount: 8,
      data: { dataTable: { 0: { 0: { value: `${P}biểu thử` } }, 2: { 1: { value: "Số người" } } } },
    };
  }
  return JSON.stringify({ version: "16.0.0", sheetCount: sheets.length, activeSheetIndex: 0, sheets: out });
}

const PROBE_SCRIPT = `return defineScript({
  validate(ctx) {
    var out = [];
    function probe(label, fn) {
      try { var r = fn(); out.push(label + '=ESCAPED:' + String(r).slice(0, 40)); }
      catch (e) { out.push(label + '=blocked'); }
    }
    probe('JavaType', function () { return Java.type('java.lang.Runtime'); });
    probe('requireFs', function () { return require('fs'); });
    probe('processEnv', function () { return process.env.PATH; });
    probe('loadFile', function () { return load('file:///C:/Windows/win.ini'); });
    probe('readFile', function () { return readFile('C:/Windows/win.ini'); });
    probe('Polyglot', function () { return Polyglot.eval('js', '1+1'); });
    probe('hostGetClass', function () { var c = ctx.cell.get.getClass(); if (!c) throw 1; return c.getName(); });
    probe('ctorEscape', function () { var g = (function(){}).constructor('return this')(); if (typeof g.Java === 'undefined') throw 1; return g.Java.type('java.io.File'); });
    ctx.issues.add({ severity: 'ERROR', message: 'PROBE ' + out.join(' | ') });
  }
});`;
const SYNTAX_SCRIPT = "return defineScript({ validate(ctx) { ctx.issues.add( } });";
const LOOP_SCRIPT = "return defineScript({ validate(ctx) { while (true) {} } });";

let setId: number;
let emptySetId: number | null = null;
let templateId: number;
let templateCode: string;
let v1: number;
let v2: number | null = null;
let draftOnlyTemplateId: number | null = null;
let periodId: number;
let reportId: number;
let sheetId: number;

async function cleanupE2ED() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    const tpl = `(SELECT t.id FROM asxh_templates t JOIN asxh_template_sets s ON s.id = t.template_set_id WHERE s.name LIKE 'E2E-D-%')`;
    await client.query(`UPDATE asxh_template_versions SET previous_version_id = NULL WHERE template_id IN ${tpl}`);
    await client.query(`DELETE FROM asxh_template_versions WHERE template_id IN ${tpl}`);
    await client.query(`DELETE FROM asxh_templates WHERE id IN ${tpl}`);
    await client.query(`DELETE FROM asxh_template_sets WHERE name LIKE 'E2E-D-%'`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

/** Cột khoá ngoại biểu → bộ mẫu có thể khác tên; dò một lần. */
async function ensureCleanupColumns() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  const r = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='asxh_templates' AND column_name LIKE '%set%'"
  );
  await client.end();
  if (!r.rows.some((x: { column_name: string }) => x.column_name === "template_set_id")) {
    throw new Error(`asxh_templates không có cột template_set_id: ${JSON.stringify(r.rows)}`);
  }
}

// Bảng kết quả là đầu ra (in ở afterAll); ca chỉ hỏng khi có lỗi cứng.
// serial: một ca hỏng thì bỏ qua các ca sau thay vì dựng worker mới (worker mới chạy lại beforeAll → dọn mất dữ liệu đang dùng).
test.describe.configure({ mode: "serial" });

test.describe("Nhóm D — biểu mẫu, phiên bản, kịch bản, Designer, bản chất chỉ tiêu", () => {
  test.beforeAll(async () => {
    await ensureCleanupColumns();
    await purgeYear(YEAR);
    await cleanupE2ED();
  });

  test.afterAll(async () => {
    await purgeYear(YEAR);
    await cleanupE2ED();
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync("test-results/94-bieu-mau.json", JSON.stringify(results, null, 2));
    console.log("\n=== TỔNG KẾT NHÓM D ===");
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.group} | ${r.case} | kỳ vọng ${r.expect} | nhận ${r.got}${r.note ? ` | ${r.note}` : ""}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ca đạt`);
  });

  test("1. bộ mẫu + biểu: happy, worst", async () => {
    const G = "Bộ mẫu/Biểu";
    const a = await Raw.as(ACCOUNTS.admin);

    // --- bộ mẫu
    const created = await a.send("post", "/template_sets", { name: `${P}Bộ thử`, description: "Bộ mẫu của e2e nhóm D" });
    record(G, "Tạo bộ mẫu hợp lệ", created, [201]);
    setId = json<{ id: number }>(created).id;
    record(G, "GET danh sách bộ mẫu", await a.send("get", "/template_sets?_start=0&_end=50"), [200]);
    record(G, "GET bộ mẫu theo id", await a.send("get", `/template_sets/${setId}`), [200]);
    record(G, "GET bộ mẫu id không tồn tại", await a.send("get", "/template_sets/987654321"), [404]);
    record(G, "Tạo bộ mẫu tên rỗng", await a.send("post", "/template_sets", { name: "   " }), BAD);
    record(G, "Tạo bộ mẫu tên 256 ký tự", await a.send("post", "/template_sets", { name: P + "x".repeat(250) }), BAD);
    record(G, "Tạo bộ mẫu mô tả 1001 ký tự", await a.send("post", "/template_sets", { name: `${P}Mô tả dài`, description: "x".repeat(1001) }), BAD);
    record(G, "Tạo bộ mẫu trùng tên (khác hoa thường)", await a.send("post", "/template_sets", { name: `${P}BỘ THỬ` }), [409]);
    record(G, "Tạo bộ mẫu không có thân", await a.send("post", "/template_sets", {}), BAD);
    record(G, "Sửa bộ mẫu (PUT đổi mô tả)", await a.send("put", `/template_sets/${setId}`, { description: "Đã sửa" }), [200]);
    record(G, "Sửa bộ mẫu (PATCH tên rỗng)", await a.send("patch", `/template_sets/${setId}`, { name: "" }), BAD);
    const xssSet = await a.send("post", "/template_sets", { name: `${P}<img src=x onerror="window.__xss=1">`, description: "<script>window.__xss=1</script>" });
    record(G, "Tạo bộ mẫu tên chứa HTML (dùng cho ca XSS ở UI)", xssSet, [201, 400]);
    if (xssSet.status === 201) emptySetId = json<{ id: number }>(xssSet).id;

    // --- biểu
    const tCreated = await a.send("post", "/templates", { set: { id: setId }, shortName: "E2E-D1", name: `${P}Biểu thử 1`, kind: "CHI_TIET" });
    record(G, "Tạo biểu hợp lệ (kèm phiên bản 1 Nháp)", tCreated, [201]);
    const t = json<{ id: number; code: string }>(tCreated);
    templateId = t.id;
    templateCode = t.code;
    check(G, "Mã biểu tự sinh dạng BM-xxxxxx", /^BM-\d{6}$/.test(templateCode), "BM-\\d{6}", templateCode);
    const vlist = await a.send("get", `/template_versions?template.id=${templateId}`);
    record(G, "GET danh sách phiên bản theo biểu", vlist, [200]);
    const versions = json<{ id: number; status: string; versionNo: number; workbookJson?: string }[]>(vlist);
    v1 = versions[0]!.id;
    check(G, "Biểu mới có đúng 1 phiên bản Nháp", versions.length === 1 && versions[0]!.status === "DRAFT", "1 DRAFT", JSON.stringify(versions.map((v) => v.status)));
    check(G, "Danh sách phiên bản không kèm workbook", !versions[0]!.workbookJson, "workbookJson rỗng", String(versions[0]!.workbookJson).slice(0, 40));
    record(G, "GET biểu theo id", await a.send("get", `/templates/${templateId}`), [200]);
    record(G, "GET danh sách biểu", await a.send("get", "/templates?_start=0&_end=100"), [200]);
    record(G, "GET biểu id không tồn tại", await a.send("get", "/templates/987654321"), [404]);
    record(G, "Tạo biểu trùng tên ngắn trong cùng bộ (hoa thường)", await a.send("post", "/templates", { set: { id: setId }, shortName: "e2e-d1", name: `${P}trùng` }), [409]);
    record(G, "Tạo biểu tên ngắn rỗng", await a.send("post", "/templates", { set: { id: setId }, shortName: " ", name: `${P}x` }), BAD);
    record(G, "Tạo biểu tên ngắn 33 ký tự", await a.send("post", "/templates", { set: { id: setId }, shortName: "x".repeat(33), name: `${P}x` }), BAD);
    record(G, "Tạo biểu tên 501 ký tự", await a.send("post", "/templates", { set: { id: setId }, shortName: "E2E-D9", name: P + "x".repeat(495) }), BAD);
    record(G, "Tạo biểu thiếu bộ mẫu", await a.send("post", "/templates", { shortName: "E2E-D9", name: `${P}x` }), BAD);
    record(G, "Tạo biểu vào bộ mẫu không tồn tại", await a.send("post", "/templates", { set: { id: 987654321 }, shortName: "E2E-D9", name: `${P}x` }), [404, 400]);
    record(G, "Tạo biểu thứ tự âm", await a.send("post", "/templates", { set: { id: setId }, shortName: "E2E-D9", name: `${P}x`, sortOrder: -1 }), BAD);
    record(G, "Tạo biểu loại không hợp lệ", await a.send("post", "/templates", { set: { id: setId }, shortName: "E2E-D9", name: `${P}x`, kind: "HACK" }), BAD);
    record(G, "Sửa biểu (PATCH đổi tên)", await a.send("patch", `/templates/${templateId}`, { name: `${P}Biểu thử 1 (đã sửa)` }), [200]);
    record(G, "Sửa biểu (PUT tên ngắn rỗng)", await a.send("put", `/templates/${templateId}`, { shortName: "" }), BAD);
    // Mass assignment: đổi mã biểu qua PATCH.
    const massCode = await a.send("patch", `/templates/${templateId}`, { code: "BM-000001", id: 1 });
    const afterCode = json<{ code: string; id: number }>(await a.send("get", `/templates/${templateId}`));
    check(G, "PATCH biểu kèm code/id lạ không đổi mã biểu", afterCode.code === templateCode && afterCode.id === templateId, `code=${templateCode}`, `${massCode.status} code=${afterCode.code}`);

    // Biểu chỉ có nháp: xoá được (nháp xoá cùng).
    const t2 = await a.send("post", "/templates", { set: { id: setId }, shortName: "E2E-D2", name: `${P}Biểu nháp` });
    record(G, "Tạo biểu thứ hai (chỉ nháp)", t2, [201]);
    draftOnlyTemplateId = json<{ id: number }>(t2).id;
    record(G, "resolve biểu chưa ban hành bản nào", await a.send("get", `/template_versions/resolve?templateId=${draftOnlyTemplateId}&date=${YEAR}-01-01`), [409]);
    record(G, "next_version khi biểu chỉ có nháp", await a.send("post", `/templates/${draftOnlyTemplateId}/next_version`), [409]);
    const t2versions = json<{ id: number }[]>(await a.send("get", `/template_versions?template.id=${draftOnlyTemplateId}`));
    record(G, "POST phiên bản khi biểu đã có phiên bản", await a.send("post", "/template_versions", { template: { id: draftOnlyTemplateId } }), [409]);
    record(G, "Xoá phiên bản nháp duy nhất", await a.send("delete", `/template_versions/${t2versions[0]!.id}`), [200]);
    record(G, "POST phiên bản đầu cho biểu đã hết phiên bản", await a.send("post", "/template_versions", { template: { id: draftOnlyTemplateId }, workbookJson: workbook() }), [201]);
    record(G, "POST phiên bản thiếu biểu", await a.send("post", "/template_versions", {}), BAD);
    record(G, "Xoá bộ mẫu đang có biểu", await a.send("delete", `/template_sets/${setId}`), [409]);
    record(G, "Xoá biểu chỉ có nháp", await a.send("delete", `/templates/${draftOnlyTemplateId}`), [200]);
    record(G, "Xoá biểu đã xoá (id không còn)", await a.send("delete", `/templates/${draftOnlyTemplateId}`), [404]);
    if (emptySetId) record(G, "Xoá bộ mẫu rỗng (bộ tên HTML)", await a.send("delete", `/template_sets/${emptySetId}`), [200]);
    // tạo lại bộ tên HTML cho ca UI XSS
    const xss2 = await a.send("post", "/template_sets", { name: `${P}<img src=x onerror="window.__xss=1">`, description: "<script>window.__xss=1</script>" });
    emptySetId = xss2.status === 201 ? json<{ id: number }>(xss2).id : null;
    await a.dispose();
  });

  test("2. phiên bản nháp: workbook & kịch bản sai / khổng lồ, mass assignment", async () => {
    const G = "Phiên bản (nháp)";
    const a = await Raw.as(ACCOUNTS.admin);
    const V = `/template_versions/${v1}`;
    record(G, "GET phiên bản theo id (đầy đủ)", await a.send("get", V), [200]);
    record(G, "GET phiên bản id không tồn tại", await a.send("get", "/template_versions/987654321"), [404]);
    record(G, "Lưu workbook chuỗi rỗng", await a.send("patch", V, { workbookJson: "" }), DENIED);
    record(G, "Lưu workbook không phải JSON", await a.send("patch", V, { workbookJson: "not-json{" }), DENIED);
    record(G, "Lưu workbook là mảng JSON", await a.send("patch", V, { workbookJson: "[1,2]" }), DENIED);
    record(G, "Lưu workbook không có trang", await a.send("patch", V, { workbookJson: '{"sheets":{}}' }), DENIED);
    const evalOnly = await a.send("patch", V, { workbookJson: JSON.stringify({ sheets: { "Evaluation Version": { name: "Evaluation Version" } } }) });
    record(G, "Lưu workbook chỉ có trang 'Evaluation Version'", evalOnly, DENIED);
    if (!process.env.D_SKIP_HUGE) {
      // Chỉ gửi một lần mỗi lượt chạy (máy chủ test ít heap).
      const huge = "x".repeat(20_971_521);
      const big = await a.send("patch", V, { workbookJson: JSON.stringify({ sheets: { E2E: { name: "E2E", pad: huge } } }) });
      record(G, "Lưu workbook > 20MB", big, [400, 413, 422]);
    }
    record(G, "Đổi ngày áp dụng sai định dạng", await a.send("patch", V, { effectiveFrom: "31/12/2040" }), BAD);

    // hai trang → lưu được nhưng ban hành bị chặn
    record(G, "Lưu workbook 2 trang", await a.send("patch", V, { workbookJson: workbook(["E2E", "Thừa"]) }), [200]);
    record(G, "Ban hành phiên bản có 2 trang", await a.send("post", `${V}/publish`, { effectiveFrom: "2026-01-01" }), [409]);
    const withEval = await a.send("patch", V, { workbookJson: JSON.parse(JSON.stringify(workbook(["E2E", "Evaluation Version"]))) });
    const evalStripped = !(json<{ workbookJson: string }>(withEval).workbookJson ?? "").includes("Evaluation Version");
    check(G, "Máy chủ cắt trang 'Evaluation Version' khi lưu", withEval.status === 200 && evalStripped, "200 + không còn trang", `${withEval.status} stripped=${evalStripped}`);
    record(G, "Lưu workbook hợp lệ 1 trang", await a.send("patch", V, { workbookJson: workbook() }), [200]);

    // Mass assignment trạng thái
    const mass = await a.send("put", V, { status: "PUBLISHED", publishedAt: "2026-01-01T00:00:00Z", publishedBy: "hacker", versionNo: 99, template: { id: 1 } });
    const after = json<{ status: string; versionNo: number; publishedBy: string | null; template: { id: number } }>(await a.send("get", V));
    check(G, "PUT phiên bản kèm status=PUBLISHED/versionNo/template lạ không có tác dụng", after.status === "DRAFT" && after.versionNo === 1 && !after.publishedBy && after.template.id === templateId, "DRAFT, v1, template của mình", `${mass.status} status=${after.status} no=${after.versionNo} by=${after.publishedBy} tpl=${after.template.id}`);

    // Kịch bản
    const S = `${V}/scripts`;
    record(G, "GET kịch bản (rỗng)", await a.send("get", S), [200]);
    record(G, "Lưu kịch bản tên rỗng", await a.send("put", S, [{ name: " ", code: "x" }]), BAD);
    record(G, "Lưu kịch bản tên 256 ký tự", await a.send("put", S, [{ name: "x".repeat(256), code: "" }]), BAD);
    record(G, "Lưu kịch bản gắn biểu khác (BM-000001)", await a.send("put", S, [{ name: "lạ", code: "", sheetCode: "BM-000001" }]), BAD);
    record(G, "Lưu kịch bản mã > 2.000.000 ký tự", await a.send("put", S, [{ name: "to", code: "x".repeat(2_000_001) }]), BAD);
    record(G, "Lưu kịch bản thân không phải mảng", await a.send("put", S, { name: "x" }), BAD);
    record(G, "Lưu 501 kịch bản qua PATCH", await a.send("patch", V, { scripts: Array.from({ length: 501 }, (_, i) => ({ name: `s${i}`, code: "" })) }), BAD);
    // id kịch bản của phiên bản khác (biểu 1a) → phải tạo mới, không ghi đè kịch bản biểu khác
    const foreignScriptId = 1;
    const put = await a.send("put", S, [
      { id: foreignScriptId, name: "probe", code: PROBE_SCRIPT, sheetCode: templateCode, declaredHooks: "validate" },
      { name: "syntax-error", code: SYNTAX_SCRIPT },
      { name: `${P}<img src=x onerror="window.__xss=1">loop`, code: LOOP_SCRIPT },
    ]);
    record(G, "Lưu 3 kịch bản (probe hộp cát, lỗi cú pháp, vòng lặp vô hạn)", put, [200]);
    const saved = put.status === 200 ? json<{ id: number }[]>(put) : [];
    check(G, "Kịch bản gửi id của phiên bản khác được tạo mới (id khác)", saved.length === 3 && saved[0]!.id !== foreignScriptId, "id mới", JSON.stringify(saved.map((s) => s.id)));
    await a.dispose();
  });

  test("3. Designer + Monaco (UI, phiên bản nháp)", async ({ page }) => {
    const G = "UI Designer";
    const errors = watch(page);
    await login(page, ACCOUNTS.admin);

    await page.goto(`/templates?set=${setId}&form=${templateId}&version=${v1}`);
    await page.waitForTimeout(3000);
    const body = await page.locator("body").innerText();
    check(G, "/templates hiện biểu E2E-D1 của bộ đã chọn", body.includes("E2E-D1"), "có E2E-D1", body.replace(/\s+/g, " ").slice(0, 160));
    const draftButtons = ["Mở thiết kế", "Ban hành phiên bản 1"];
    for (const name of draftButtons) {
      const n = await page.getByRole("button", { name, exact: false }).count();
      check(G, `Phiên bản Nháp có nút "${name}"`, n > 0, ">=1", `${n}`);
    }

    // Designer
    // Designer (SpreadDesigner không đăng ký móc __asxhE2E — chỉ SpreadWorkbook có — nên gõ ô
    // như người dùng: bấm vào vùng lưới rồi gõ phím).
    test.setTimeout(420_000);
    await page.goto(`/templates/designer/${v1}`);
    let loaded = true;
    try {
      // Thanh trạng thái "Ready" của Designer hiện khi lưới đã vẽ; khung 1600x900 cố định nên
      // ô B4 nằm ở toạ độ (410, 466) (đối chiếu ảnh chụp màn Designer).
      await page.getByText("Ready", { exact: true }).first().waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForTimeout(2000);
      await page.mouse.click(410, 466);
      await page.keyboard.type("42");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(800);
    } catch (e) {
      loaded = false;
      check(G, "Designer nạp bảng tính và gõ được ô", false, "gõ được", String(e).slice(0, 200));
    }
    await page.screenshot({ path: "C:/Users/Admin/AppData/Local/Temp/claude/X--DTH-Company-asxh-stc-dn-asxh/3636f09a-c43c-480e-82ca-e8a0105ee17c/scratchpad/d-designer.png" }).catch(() => {});
    if (loaded) {
      check(G, "Designer nạp bảng tính và gõ được ô", true, "gõ được", "ok");
      const resp = page.waitForResponse((r) => r.url().includes(`/template_versions/${v1}`) && ["PATCH", "PUT"].includes(r.request().method()), { timeout: 30_000 }).catch(() => null);
      await page.getByRole("button", { name: "Lưu", exact: true }).first().click();
      const r = await resp;
      check(G, "Bấm Lưu trong Designer → PATCH 200", r?.status() === 200, "200", r ? `${r.request().method()} ${r.status()}` : "không thấy request");
      const api = await Api.as(ACCOUNTS.admin);
      const v = await api.get<{ workbookJson: string }>(`/template_versions/${v1}`);
      const wb = JSON.parse(v.workbookJson) as { sheets: Record<string, { data?: { dataTable?: Record<string, Record<string, { value?: unknown }>> } }> };
      const table = wb.sheets["E2E"]?.data?.dataTable ?? {};
      const found = Object.values(table).some((row) => Object.values(row).some((c) => c?.value === 42 || c?.value === "42"));
      check(G, "Giá trị gõ trong Designer đã lưu vào máy chủ", found, "có ô = 42", found ? "có" : "không thấy ô 42");
      const scripts = await api.get<unknown[]>(`/template_versions/${v1}/scripts`);
      check(G, "Lưu Designer giữ nguyên 3 kịch bản", scripts.length === 3, "3", String(scripts.length));
      await api.dispose();
    }

    // Monaco
    let dialogFired = false;
    page.on("dialog", (d) => { dialogFired = true; void d.dismiss(); });
    await page.goto(`/templates/designer/${v1}?rules=1`);
    const aside = page.getByRole("complementary", { name: "Kịch bản của biểu" });
    const asideOk = await aside.first().waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false);
    check(G, "?rules=1 mở khung kịch bản", asideOk, "hiện", String(asideOk));
    const list = page.getByRole("list", { name: "Danh sách kịch bản" });
    await list.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await list.getByText("probe", { exact: false }).first().click({ timeout: 10_000 }).catch(() => {});
    const monaco = await page.locator(".monaco-editor").first().waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false);
    check(G, "Ô soạn Monaco hiện", monaco, "hiện", String(monaco));
    const names = await list.innerText().catch(() => "");
    check(G, "Danh sách kịch bản có 3 mục (probe, syntax-error, loop)", /probe/.test(names) && /syntax-error/.test(names), "có tên", names.replace(/\s+/g, " ").slice(0, 160));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "C:/Users/Admin/AppData/Local/Temp/claude/X--DTH-Company-asxh-stc-dn-asxh/3636f09a-c43c-480e-82ca-e8a0105ee17c/scratchpad/d-rules.png", timeout: 15_000 }).catch(() => {});
    // Trang có thể bị treo (vòng lặp JS) — không để một lệnh evaluate giữ cả ca.
    const xss = await Promise.race([
      page.evaluate(() => ((window as unknown as { __xss?: number }).__xss === 1 ? "ĐÃ CHẠY" : "không chạy")),
      new Promise<string>((r) => setTimeout(() => r("TRANG TREO (evaluate > 15 s)"), 15_000)),
    ]).catch((e) => `lỗi ${String(e).slice(0, 80)}`);
    check(G, "Tên kịch bản chứa <img onerror> không chạy script", xss === "không chạy" && !dialogFired, "không chạy", xss);
    reportErrors(G, "Designer", errors);
    await page.goto("about:blank", { timeout: 15_000 }).catch(() => {});
  });

  test("4. máy trạng thái phiên bản + hộp cát GraalJS + xoá bản đang dùng", async () => {
    const G = "Máy trạng thái";
    const a = await Raw.as(ACCOUNTS.admin);
    const V = (id: number) => `/template_versions/${id}`;

    record(G, "Khoá bản Nháp", await a.send("post", `${V(v1)}/lock`), [409]);
    record(G, "Mở khoá bản Nháp", await a.send("post", `${V(v1)}/unlock`), [409]);
    record(G, "Thu hồi bản Nháp", await a.send("post", `${V(v1)}/revoke`), [409]);
    record(G, "Trả về nháp khi đang Nháp (idempotent)", await a.send("post", `${V(v1)}/stop_testing`), [200]);
    const st = await a.send("post", `${V(v1)}/start_testing`);
    record(G, "Nháp → Đang thử nghiệm", st, [200]);
    check(G, "Trạng thái sau start_testing = TESTING", json<{ status: string }>(st).status === "TESTING", "TESTING", json<{ status: string }>(st).status);
    record(G, "start_testing lần hai (idempotent)", await a.send("post", `${V(v1)}/start_testing`), [200]);
    record(G, "Khoá bản Đang thử nghiệm", await a.send("post", `${V(v1)}/lock`), [409]);
    record(G, "Sửa workbook khi Đang thử nghiệm (được phép)", await a.send("patch", V(v1), { workbookJson: (await getWorkbook(a, v1)) }), [200]);
    const back = await a.send("post", `${V(v1)}/stop_testing`);
    record(G, "Đang thử nghiệm → Nháp", back, [200]);
    record(G, "Thao tác lên phiên bản không tồn tại (publish)", await a.send("post", "/template_versions/987654321/publish"), [404]);
    record(G, "Ban hành với ngày áp dụng sai định dạng", await a.send("post", `${V(v1)}/publish`, { effectiveFrom: "2026-13-45" }), BAD);

    const pub = await a.send("post", `${V(v1)}/publish`, { effectiveFrom: "2026-01-01" });
    record(G, "Ban hành phiên bản 1 (ngày áp dụng 01/01/2026)", pub, [200]);
    check(G, "Sau ban hành: PUBLISHED + publishedBy=admin", json<{ status: string; publishedBy: string }>(pub).status === "PUBLISHED" && json<{ publishedBy: string }>(pub).publishedBy === "admin", "PUBLISHED/admin", `${json<{ status: string }>(pub).status}/${json<{ publishedBy: string }>(pub).publishedBy}`);
    record(G, "Ban hành lần hai (bấm đúp)", await a.send("post", `${V(v1)}/publish`), [409]);
    record(G, "Sửa workbook bản đã ban hành", await a.send("patch", V(v1), { workbookJson: workbook() }), [409]);
    record(G, "Đổi ngày áp dụng bản đã ban hành", await a.send("patch", V(v1), { effectiveFrom: "2026-02-01" }), [409]);
    record(G, "Thay kịch bản bản đã ban hành", await a.send("put", `${V(v1)}/scripts`, []), [409]);
    record(G, "start_testing bản đã ban hành", await a.send("post", `${V(v1)}/start_testing`), [409]);
    record(G, "Thu hồi bản ban hành cuối cùng của biểu", await a.send("post", `${V(v1)}/revoke`), [409]);
    record(G, "Xoá biểu đã có bản ban hành", await a.send("delete", `/templates/${templateId}`), [409]);
    record(G, "Đổi loại biểu sau ban hành", await a.send("patch", `/templates/${templateId}`, { kind: "TONG_HOP" }), [409, 400]);
    const res = await a.send("get", `/template_versions/resolve?templateId=${templateId}&date=${YEAR}-03-01`);
    record(G, "resolve ngày 01/03/2040", res, [200]);
    check(G, "resolve trả phiên bản 1", json<{ id: number }>(res).id === v1, String(v1), String(json<{ id: number }>(res).id));
    const early = await a.send("get", `/template_versions/resolve?templateId=${templateId}&date=2020-01-01`);
    check(G, "resolve ngày trước mọi bản mượn bản sớm nhất", early.status === 200 && json<{ id: number }>(early).id === v1, `200 id=${v1}`, `${early.status} ${early.body.slice(0, 60)}`);
    record(G, "resolve thiếu templateId", await a.send("get", "/template_versions/resolve"), BAD);
    record(G, "resolve ngày sai định dạng", await a.send("get", `/template_versions/resolve?templateId=${templateId}&date=abc`), BAD);
    record(G, "resolve biểu không tồn tại", await a.send("get", "/template_versions/resolve?templateId=987654321"), [404, 409]);

    // Ghim phiên bản vào phiếu: kỳ Q1/2040, đơn vị Trấn Biên × biểu E2E-D1.
    const so = await Api.as(ACCOUNTS.soDieuHanh);
    await createCalendar(so, YEAR);
    const period = await periodByCode(so, YEAR, "Q1");
    periodId = period.id;
    const unit = await unitByCode(so, UNIT_TRAN_BIEN);
    await setupAndOpen(so, periodId, [{ unitId: unit.id, templateId }]);
    reportId = (await reportOf(so, periodId, unit.id)).id;
    await so.dispose();
    const donvi = await Api.as(ACCOUNTS.donviBienHoa);
    const sheet = (await sheetsOf(donvi, reportId))[0]!;
    sheetId = sheet.id;
    check(G, "Mở đợt Q1/2040 sinh phiếu dùng biểu E2E-D1", !!sheetId, "có tờ biểu", String(sheetId));

    // Hộp cát: lưu số liệu rồi Kiểm tra & hoàn tất → máy chủ chạy validate (probe + lỗi cú pháp + vòng lặp).
    const detail = await donvi.get<{ templateWorkbookJson: string; version: number }>(`/input_report_sheets/${sheetId}`);
    const wb = JSON.parse(detail.templateWorkbookJson) as { sheets: Record<string, { data: { dataTable: Record<string, Record<string, { value?: unknown }>> } }> };
    wb.sheets["E2E"]!.data.dataTable["3"] = { 1: { value: 5 } };
    await donvi.put(`/input_report_sheets/${sheetId}`, { dataJson: JSON.stringify(wb), version: detail.version });
    await donvi.dispose();
    const u = await Raw.as(ACCOUNTS.donviBienHoa);
    const done = await u.send("post", `/input_report_sheets/${sheetId}/complete`);
    record("Hộp cát GraalJS", "Hoàn tất biểu chạy script probe + lỗi cú pháp + while(true)", done, [409], `mất ${done.ms} ms`);
    const msg = done.full ?? "";
    for (const probe of ["JavaType", "requireFs", "processEnv", "loadFile", "readFile", "Polyglot", "hostGetClass", "ctorEscape"]) {
      const blocked = msg.includes(`${probe}=blocked`);
      const escaped = msg.includes(`${probe}=ESCAPED`);
      check("Hộp cát GraalJS", `Script gọi ${probe} bị chặn`, blocked && !escaped, `${probe}=blocked`, escaped ? msg.match(new RegExp(`${probe}=ESCAPED[^|]*`))?.[0] ?? "ESCAPED" : blocked ? "blocked" : `không thấy kết quả (${msg.slice(0, 120)})`);
    }
    check("Hộp cát GraalJS", "while(true) bị cắt, máy chủ trả lời trong < 30 s", (done.ms ?? 0) < 30_000, "< 30000 ms", `${done.ms} ms`);
    const health = await u.send("get", `/input_report_sheets/${sheetId}`);
    record("Hộp cát GraalJS", "Máy chủ vẫn phục vụ sau script vòng lặp", health, [200]);
    await u.dispose();

    // Xoá bản đang được phiếu dùng
    record(G, "Xoá phiên bản 1 đang được phiếu Q1/2040 dùng", await a.send("delete", V(v1)), [409]);

    // Khoá ⇄ mở khoá
    const lk = await a.send("post", `${V(v1)}/lock`);
    record(G, "Khoá bản đã ban hành mới nhất", lk, [200]);
    record(G, "Khoá lần hai (idempotent)", await a.send("post", `${V(v1)}/lock`), [200]);
    record(G, "Sửa bản đang khoá", await a.send("patch", V(v1), { workbookJson: workbook() }), [409]);
    record(G, "Thu hồi bản đang khoá", await a.send("post", `${V(v1)}/revoke`), [409]);
    record(G, "next_version khi bản mới nhất đang khoá", await a.send("post", `/templates/${templateId}/next_version`), [409]);
    record(G, "Ban hành bản đang khoá", await a.send("post", `${V(v1)}/publish`), [409]);
    const resLocked = await a.send("get", `/template_versions/resolve?templateId=${templateId}&date=${YEAR}-03-01`);
    record(G, "resolve khi bản duy nhất đang khoá (không được chọn)", resLocked, [409]);
    const ul = await a.send("post", `${V(v1)}/unlock`);
    record(G, "Mở khoá", ul, [200]);
    check(G, "Mở khoá giữ người ban hành cũ", json<{ status: string; publishedBy: string }>(ul).status === "PUBLISHED" && json<{ publishedBy: string }>(ul).publishedBy === "admin", "PUBLISHED/admin", `${json<{ status: string }>(ul).status}`);
    record(G, "Mở khoá lần hai (idempotent)", await a.send("post", `${V(v1)}/unlock`), [200]);

    // Phiên bản kế tiếp
    const nx = await a.send("post", `/templates/${templateId}/next_version`);
    record(G, "Tạo phiên bản kế tiếp", nx, [201]);
    const v2r = json<{ id: number; status: string; versionNo: number; previousVersionId: number; effectiveFrom: string | null }>(nx);
    v2 = v2r.id;
    check(G, "Phiên bản 2: DRAFT, no=2, nguồn=v1, ngày áp dụng trống", v2r.status === "DRAFT" && v2r.versionNo === 2 && v2r.previousVersionId === v1 && !v2r.effectiveFrom, "DRAFT/2/v1/null", `${v2r.status}/${v2r.versionNo}/${v2r.previousVersionId}/${v2r.effectiveFrom}`);
    const sc2 = json<unknown[]>(await a.send("get", `${V(v2)}/scripts`));
    check(G, "Phiên bản kế tiếp mang theo 3 kịch bản", sc2.length === 3, "3", String(sc2.length));
    record(G, "next_version lần hai khi đã có nháp", await a.send("post", `/templates/${templateId}/next_version`), [409]);
    record(G, "Xoá phiên bản 1 khi đã có bản mới hơn", await a.send("delete", V(v1)), [409]);
    record(G, "Ban hành v2 ngày áp dụng = ngày v1", await a.send("post", `${V(v2)}/publish`, { effectiveFrom: "2026-01-01" }), [409]);
    record(G, "Ban hành v2 ngày áp dụng trước v1", await a.send("post", `${V(v2)}/publish`, { effectiveFrom: "2025-06-01" }), [409]);
    record(G, "Ban hành v2 không có ngày áp dụng", await a.send("post", `${V(v2)}/publish`), [409]);
    record(G, "Thu hồi v1 khi chuỗi đang có nháp v2", await a.send("post", `${V(v1)}/revoke`), [409]);
    record(G, "Ban hành v2 ngày 01/06/2026", await a.send("post", `${V(v2)}/publish`, { effectiveFrom: "2026-06-01" }), [200]);
    const v1after = json<{ effectiveTo: string | null }>(await a.send("get", V(v1)));
    check(G, "v1 hết hiệu lực 31/05/2026 khi v2 ban hành", v1after.effectiveTo === "2026-05-31", "2026-05-31", String(v1after.effectiveTo));
    record(G, "Khoá v1 khi đã có v2 ban hành mới hơn", await a.send("post", `${V(v1)}/lock`), [409]);
    record(G, "Thu hồi v1 khi đã có bản kế tiếp", await a.send("post", `${V(v1)}/revoke`), [409]);
    const rv = await a.send("post", `${V(v2)}/revoke`);
    record(G, "Thu hồi v2 (còn v1 đang áp dụng)", rv, [200]);
    record(G, "Thu hồi v2 lần hai", await a.send("post", `${V(v2)}/revoke`), [409]);
    record(G, "Mở khoá bản đã thu hồi", await a.send("post", `${V(v2)}/unlock`), [409]);
    record(G, "Ban hành lại bản đã thu hồi", await a.send("post", `${V(v2)}/publish`), [409]);
    record(G, "Sửa kịch bản bản đã thu hồi", await a.send("put", `${V(v2)}/scripts`, []), [409]);
    const res2 = json<{ id: number }>(await a.send("get", `/template_versions/resolve?templateId=${templateId}&date=${YEAR}-03-01`));
    check(G, "Sau thu hồi v2, resolve lùi về v1", res2.id === v1, String(v1), String(res2.id));
    record(G, "Xoá v2 (đã thu hồi, mới nhất, chưa dùng)", await a.send("delete", V(v2)), [200]);
    v2 = null;
    record(G, "Xoá phiên bản không tồn tại", await a.send("delete", "/template_versions/987654321"), [404]);
    await a.dispose();
  });

  test("5. cheating: vai trò thấp gọi API ghi, không token", async () => {
    const G = "Cheating";
    const accounts: [string, Account][] = [
      ["donvi.bienhoa", ACCOUNTS.donviBienHoa],
      ["so.duyet", ACCOUNTS.soDuyet],
      ["viewer", VIEWER],
    ];
    for (const [label, acc] of accounts) {
      let c: Raw;
      try {
        c = await Raw.as(acc);
      } catch (e) {
        check(G, `${label} đăng nhập`, false, "đăng nhập được", String(e));
        continue;
      }
      const V = `/template_versions/${v1}`;
      const calls: [string, Method, string, unknown?][] = [
        ["tạo bộ mẫu", "post", "/template_sets", { name: `${P}hack-${label}` }],
        ["sửa bộ mẫu", "put", `/template_sets/${setId}`, { name: `${P}hack` }],
        ["xoá bộ mẫu", "delete", `/template_sets/${setId}`],
        ["tạo biểu", "post", "/templates", { set: { id: setId }, shortName: "HACK", name: `${P}hack` }],
        ["sửa biểu", "patch", `/templates/${templateId}`, { name: `${P}hack` }],
        ["xoá biểu", "delete", `/templates/${templateId}`],
        ["tạo phiên bản kế tiếp", "post", `/templates/${templateId}/next_version`],
        ["POST phiên bản", "post", "/template_versions", { template: { id: templateId } }],
        ["sửa workbook phiên bản", "patch", V, { workbookJson: workbook() }],
        ["xoá phiên bản", "delete", V],
        ["thay kịch bản", "put", `${V}/scripts`, []],
        ["ban hành", "post", `${V}/publish`],
        ["khoá", "post", `${V}/lock`],
        ["mở khoá", "post", `${V}/unlock`],
        ["thu hồi", "post", `${V}/revoke`],
        ["start_testing", "post", `${V}/start_testing`],
        ["stop_testing", "post", `${V}/stop_testing`],
        ["khai bản chất chỉ tiêu", "put", "/indicator_measures", { indicatorCodes: ["x"], measureKind: "TIEN" }],
      ];
      for (const [name, m, path, data] of calls) {
        record(G, `${label} ${name}`, await c.send(m, path, data), FORBIDDEN);
      }
      // đọc: ghi nhận, không coi là lỗi
      const r = await c.send("get", `${V}/scripts`);
      results.push({ group: G, case: `${label} đọc kịch bản phiên bản (thông tin)`, expect: "ghi nhận", got: `${r.status}`, ok: true });
      await c.dispose();
    }
    const v = json<{ status: string }>(await (await Raw.as(ACCOUNTS.admin)).send("get", `/template_versions/${v1}`));
    check(G, "Sau mọi ca gian lận v1 vẫn PUBLISHED", v.status === "PUBLISHED", "PUBLISHED", v.status);
    const anon = await Raw.as(null);
    record(G, "Không token GET /templates", await anon.send("get", "/templates"), [401]);
    record(G, "Không token publish phiên bản", await anon.send("post", `/template_versions/${v1}/publish`), [401]);
    const fake = await Raw.as(null, "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.");
    record(G, "Token giả alg=none tạo bộ mẫu", await fake.send("post", "/template_sets", { name: `${P}fake` }), [401]);
    await anon.dispose();
    await fake.dispose();
  });

  test("6. bản chất chỉ tiêu: đọc, khai idempotent, worst, quyền", async () => {
    const G = "Bản chất chỉ tiêu";
    const a = await Raw.as(ACCOUNTS.admin);
    const list = await a.send("get", "/indicator_measures?_start=0&_end=5");
    record(G, "GET danh mục (5 dòng đầu)", list, [200]);
    record(G, "GET /sheets", await a.send("get", "/indicator_measures/sheets"), [200]);
    record(G, "GET lọc measureKind=UNSET", await a.send("get", "/indicator_measures?_start=0&_end=5&measureKind=UNSET"), [200]);
    record(G, "GET lọc measureKind lạ", await a.send("get", "/indicator_measures?_start=0&_end=5&measureKind=HACK"), [200, 400]);
    record(G, "GET _end âm", await a.send("get", "/indicator_measures?_start=0&_end=-5"), [200, 400]);
    const rows = list.status === 200 ? json<{ indicatorCode: string; measureKind: string | null; note: string | null }[]>(list) : [];
    const target = rows.find((r) => r.measureKind) ?? rows[0];
    if (target) {
      // Ghi đúng giá trị đang có (không đổi gì) — PUT chỉ ghi mã được gửi, không ghi đè danh sách.
      const body = { indicatorCodes: [target.indicatorCode], measureKind: target.measureKind, note: target.note ?? undefined };
      const w = await a.send("put", "/indicator_measures", body);
      record(G, `admin khai lại nguyên trạng ${target.indicatorCode}=${target.measureKind}`, w, [200]);
      const tong = await Raw.as(ACCOUNTS.soTongHop);
      record(G, "so.tonghop (DEPT_REPORT_COMPILER) khai lại nguyên trạng", await tong.send("put", "/indicator_measures", body), [200]);
      await tong.dispose();
      const after = json<{ indicatorCode: string; measureKind: string | null; note: string | null }[]>(await a.send("get", "/indicator_measures?_start=0&_end=5"));
      const same = after.find((r) => r.indicatorCode === target.indicatorCode);
      check(G, "Sau khi khai lại, giá trị không đổi", same?.measureKind === target.measureKind && (same?.note ?? null) === (target.note ?? null), `${target.measureKind}`, `${same?.measureKind}/${same?.note}`);
      record(G, "Khai bản chất không hợp lệ", await a.send("put", "/indicator_measures", { indicatorCodes: [target.indicatorCode], measureKind: "HACK" }), BAD);
      record(G, "Khai ghi chú 1001 ký tự", await a.send("put", "/indicator_measures", { indicatorCodes: [target.indicatorCode], measureKind: "TIEN", note: "x".repeat(1001) }), BAD);
    } else {
      check(G, "Danh mục có chỉ tiêu để thử", false, ">=1", "0 dòng");
    }
    record(G, "Khai mã chỉ tiêu không tồn tại", await a.send("put", "/indicator_measures", { indicatorCodes: [`${P}không-có`], measureKind: "TIEN" }), BAD);
    record(G, "Khai danh sách rỗng", await a.send("put", "/indicator_measures", { indicatorCodes: [], measureKind: "TIEN" }), BAD);
    record(G, "Khai 1001 mã", await a.send("put", "/indicator_measures", { indicatorCodes: Array.from({ length: 1001 }, (_, i) => `${P}${i}`), measureKind: "TIEN" }), BAD);
    record(G, "Khai thân không phải JSON object", await a.send("put", "/indicator_measures", "abc"), [400, 415, 422]);
    await a.dispose();
  });

  test("7. UI /templates theo trạng thái + XSS tên bộ mẫu + /measure-kinds", async ({ page, browser, baseURL }) => {
    const G = "UI";
    const errors = watch(page);
    let dialogFired = false;
    page.on("dialog", (d) => { dialogFired = true; void d.dismiss(); });
    await login(page, ACCOUNTS.admin);

    await page.goto(`/templates?set=${setId}&form=${templateId}&version=${v1}`);
    await page.waitForTimeout(3000);
    for (const name of ["Xem thiết kế", "Tạo phiên bản kế tiếp"]) {
      const n = await page.getByRole("button", { name, exact: false }).count();
      check(G, `Phiên bản đã ban hành có nút "${name}"`, n > 0, ">=1", String(n));
    }
    const publishBtn = await page.getByRole("button", { name: "Ban hành phiên bản 1" }).count();
    check(G, "Phiên bản đã ban hành không còn nút Ban hành", publishBtn === 0, "0", String(publishBtn));
    // Menu ⋯ của phiên bản
    const menuBtn = page.getByRole("button", { name: /Thao tác với phiên bản 1/i }).first();
    if (await menuBtn.count()) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      const items = (await page.getByRole("menuitem").allInnerTexts()).map((s) => s.trim());
      check(G, "Menu ⋯ của bản đã ban hành có Khoá + Thu hồi", items.some((t) => /Khoá phiên bản/.test(t)) && items.some((t) => /Thu hồi/.test(t)), "Khoá, Thu hồi", items.join(", "));
      await page.keyboard.press("Escape");
    } else {
      check(G, "Có nút ⋯ Thao tác với phiên bản 1", false, "có", "không thấy");
    }

    // Bộ mẫu tên chứa HTML
    if (emptySetId) {
      await page.goto(`/templates?set=${emptySetId}`);
      await page.waitForTimeout(3000);
      const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);
      check(G, "Tên/mô tả bộ mẫu chứa <img onerror>/<script> không chạy", !xss && !dialogFired, "không chạy", xss ? "ĐÃ CHẠY" : "không chạy");
    }

    // Designer chỉ xem với bản đã ban hành
    await page.goto(`/templates/designer/${v1}`);
    await page.waitForTimeout(6000);
    const saveBtns = await page.getByRole("button", { name: "Lưu", exact: true }).count();
    const saveEnabled = saveBtns > 0 ? await page.getByRole("button", { name: "Lưu", exact: true }).first().isEnabled() : false;
    check(G, "Designer của bản đã ban hành không cho Lưu", saveBtns === 0 || !saveEnabled, "không có / bị khoá", `nút=${saveBtns} enabled=${saveEnabled}`);
    await page.goto("/templates/designer/987654321");
    await page.waitForTimeout(4000);
    const nf = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    check(G, "Designer id không tồn tại báo không tìm thấy (không trắng trang)", /không tìm thấy|không tồn tại|không mở được|lỗi/i.test(nf), "có câu báo", nf.slice(0, 160));

    // Bản chất chỉ tiêu
    await page.goto("/measure-kinds");
    await page.waitForTimeout(4000);
    const rows = await page.locator("tbody tr").count();
    check(G, "/measure-kinds hiện danh mục chỉ tiêu", rows > 0, ">0 dòng", String(rows));
    const search = page.getByRole("textbox", { name: "Tìm theo tên chỉ tiêu" });
    if (await search.count()) {
      await search.fill("<script>window.__xss=1</script>zzz-không-có");
      await page.waitForTimeout(2500);
      const empty = await page.getByText("Không có chỉ tiêu nào khớp bộ lọc").count();
      check(G, "Tìm chuỗi không khớp → trạng thái rỗng", empty > 0, "câu báo rỗng", String(empty));
    }
    reportErrors(G, "/templates + /measure-kinds", errors);

    // viewer / đơn vị vào màn biểu mẫu: không có nút ghi
    const ctx2 = await browser.newContext({ baseURL });
    const p2 = await ctx2.newPage();
    try {
      await login(p2, ACCOUNTS.soDuyet);
      await p2.goto(`/templates?set=${setId}&form=${templateId}&version=${v1}`);
      await p2.waitForTimeout(3000);
      const clone = await p2.getByRole("button", { name: "Tạo phiên bản kế tiếp" }).count();
      const cloneEnabled = clone > 0 ? await p2.getByRole("button", { name: "Tạo phiên bản kế tiếp" }).first().isEnabled() : false;
      check(G, "so.duyet (chỉ xem) không có nút Tạo phiên bản kế tiếp dùng được", clone === 0 || !cloneEnabled, "ẩn/khoá", `nút=${clone} enabled=${cloneEnabled}`);
    } finally {
      await ctx2.close();
    }
  });
});

async function getWorkbook(a: Raw, id: number) {
  return json<{ workbookJson: string }>(await a.send("get", `/template_versions/${id}`)).workbookJson;
}

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
  return errors;
}
function reportErrors(group: string, where: string, errors: string[]) {
  const serious = errors.filter((e) => e.startsWith("pageerror") || e.startsWith("HTTP 5"));
  results.push({ group, case: `${where}: không có pageerror / HTTP 5xx`, expect: "0", got: `${serious.length} nghiêm trọng; console error ${errors.length - serious.length}: ${errors.slice(0, 4).join(" || ")}`, ok: serious.length === 0 });
}
