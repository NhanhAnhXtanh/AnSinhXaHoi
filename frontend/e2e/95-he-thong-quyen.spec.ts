// Nhóm E — Đăng nhập & phiên, người dùng, vai trò & quyền, phạm vi dữ liệu (row-level),
// đơn vị, tổ chức, phòng ban, thông báo, hồ sơ cá nhân. Chạy tay (chưa đưa vào CI).
// Mỗi ca ghi mã HTTP thật và so với kỳ vọng; expect.soft để chạy hết rồi in bảng tổng kết.
// Không đụng 9 tài khoản có sẵn (chỉ đăng nhập / đọc), mọi dữ liệu tự tạo mang tiền tố
// E2E-E- (username e2e-e-…, mã vai trò E2E_E_…) và được xoá ở afterAll.
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { API_URL } from "./support/api";

type Acc = { username: string; password: string };
const ADMIN: Acc = { username: "admin", password: "Admin@123" };
const EXISTING: Record<string, Acc> = {
  admin: ADMIN,
  "donvi.bienhoa": { username: "donvi.bienhoa", password: "User@123" },
  "donvi.buulong": { username: "donvi.buulong", password: "User@123" },
  "so.dieuhanh": { username: "so.dieuhanh", password: "User@123" },
  "so.duyet": { username: "so.duyet", password: "User@123" },
  "so.tonghop": { username: "so.tonghop", password: "User@123" },
  "ubnd.duyet": { username: "ubnd.duyet", password: "User@123" },
  manager: { username: "manager", password: "Manager@123" },
  viewer: { username: "viewer", password: "User@123" },
};
const PW = "E2e-Pass#2026";

type Row = { group: string; case: string; expect: string; got: string; ok: boolean; note?: string };
const results: Row[] = [];
type Res = { status: number; body: string; json?: any; headers?: Record<string, string> };

async function rawLogin(acc: Acc) {
  const anon = await request.newContext();
  const res = await anon.post(`${API_URL}/auth/login`, { data: acc });
  const status = res.status();
  const text = await res.text();
  await anon.dispose();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    /* không phải JSON */
  }
  return { status, body: text.slice(0, 300), json };
}

/** Client thô: trả mã HTTP + thân, không ném lỗi. */
class Raw {
  private constructor(private readonly ctx: APIRequestContext, readonly token?: string) {}
  static async as(acc: Acc | null, token?: string) {
    let bearer = token;
    if (acc) {
      const r = await rawLogin(acc);
      if (r.status !== 200) throw new Error(`Đăng nhập ${acc.username} lỗi ${r.status}: ${r.body}`);
      bearer = r.json.accessToken;
    }
    const ctx = await request.newContext({ extraHTTPHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
    return new Raw(ctx, bearer);
  }
  async send(method: "get" | "post" | "put" | "delete", path: string, data?: unknown): Promise<Res> {
    const res = await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      /* không phải JSON */
    }
    return { status: res.status(), body: text.slice(0, 300), json, headers: res.headers() };
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
  expect.soft(allowed, `${group} — ${name}: nhận ${got.status} ${got.body}`).toContain(got.status);
}
/** Ca kiểm bằng điều kiện (không phải mã HTTP). */
function check(group: string, name: string, expectText: string, gotText: string, ok: boolean, note?: string) {
  results.push({ group, case: name, expect: expectText, got: gotText.replace(/\s+/g, " ").slice(0, 160), ok, note });
  expect.soft(ok, `${group} — ${name}: ${gotText}`).toBe(true);
}

const OK = [200, 201, 204];
const DENIED = [400, 403, 404, 409, 422];
const BAD = [400, 422];
const UNAUTH = [401];
const FORBID = [403];

// ---- dữ liệu tự tạo ----
const ids: {
  role?: number;
  roleUnused?: number;
  unit?: number;
  unitXss?: number;
  users: Record<string, number>;
  permByCode: Record<string, number>;
  roleByCode: Record<string, number>;
} = { users: {}, permByCode: {}, roleByCode: {} };
const XSS = `<img src=x onerror="window.__xss=1">E2E-E-XSS`;

function userBody(username: string, roleIds: number[], extra: Record<string, unknown> = {}) {
  return {
    username,
    email: `${username}@e2e.local`,
    fullName: `E2E-E ${username}`,
    password: PW,
    status: "active",
    roles: roleIds.map((id) => ({ id })),
    ...extra,
  };
}

async function cleanup() {
  const admin = await Raw.as(ADMIN);
  const users = (await admin.send("get", `/users?_start=0&_end=500`)).json ?? [];
  for (const u of users) if (/^e2e-e-/i.test(u.username)) await admin.send("delete", `/users/${u.id}`);
  const pols = (await admin.send("get", `/row_level_policies?_start=0&_end=500`)).json ?? [];
  for (const p of pols) if (/^E2E-E-/.test(p.name)) await admin.send("delete", `/row_level_policies/${p.id}`);
  const roles = (await admin.send("get", `/roles?_start=0&_end=500`)).json ?? [];
  for (const r of roles) if (/^E2E_E_/.test(r.code)) await admin.send("delete", `/roles/${r.id}`);
  const units = (await admin.send("get", `/report_units?_start=0&_end=2000`)).json ?? [];
  // con trước, cha sau
  const mine = units.filter((u: any) => /^E2E-E-/.test(u.budgetCode));
  mine.sort((a: any, b: any) => (b.parent ? 1 : 0) - (a.parent ? 1 : 0));
  for (const u of mine) await admin.send("delete", `/report_units/${u.id}`);
  for (const u of mine) await admin.send("delete", `/report_units/${u.id}`);
  const depts = (await admin.send("get", `/departments?_start=0&_end=500`)).json ?? [];
  for (const d of depts) if (/^E2E-E-/.test(d.code)) await admin.send("delete", `/departments/${d.id}`);
  const orgs = (await admin.send("get", `/organizations?_start=0&_end=500`)).json ?? [];
  for (const o of orgs) if (/^E2E-E-/.test(o.code)) await admin.send("delete", `/organizations/${o.id}`);
  await admin.dispose();
}

async function createUser(admin: Raw, key: string, roleIds: number[], extra: Record<string, unknown> = {}) {
  const r = await admin.send("post", `/users`, userBody(key, roleIds, extra));
  if (r.status !== 201 && r.status !== 200) throw new Error(`Tạo user ${key} lỗi ${r.status}: ${r.body}`);
  ids.users[key] = r.json.id;
  return r.json;
}

// Không dùng serial: một ca soft-fail không được chặn các nhóm sau. Mỗi worker mới chạy lại beforeAll (dọn + dựng lại).

test.describe("Nhóm E — hệ thống, quyền, phiên", () => {
  test.beforeAll(async () => {
    await cleanup();
    const admin = await Raw.as(ADMIN);
    for (const p of (await admin.send("get", `/permissions?_start=0&_end=500`)).json) ids.permByCode[p.code] = p.id;
    for (const r of (await admin.send("get", `/roles?_start=0&_end=500`)).json) ids.roleByCode[r.code] = r.id;
    const role = await admin.send("post", `/roles`, {
      code: "E2E_E_BASIC",
      name: "E2E-E vai trò cơ bản",
      description: "Vai trò e2e nhóm E — tự xoá",
      permissions: [{ id: ids.permByCode["notifications:read"] }, { id: ids.permByCode["notifications:delete"] }],
    });
    if (role.status !== 201 && role.status !== 200) throw new Error(`Tạo vai trò lỗi ${role.status} ${role.body}`);
    ids.role = role.json.id;
    const unit = await admin.send("post", `/report_units`, {
      budgetCode: "E2E-E-U1",
      name: "E2E-E đơn vị thử",
      unitType: "ubnd_xa",
      block: "xa",
      active: true,
      receivesReports: true,
    });
    if (unit.status !== 201 && unit.status !== 200) throw new Error(`Tạo đơn vị lỗi ${unit.status} ${unit.body}`);
    ids.unit = unit.json.id;
    await createUser(admin, "e2e-e-a", [ids.role!]);
    await createUser(admin, "e2e-e-b", [ids.role!]);
    await createUser(admin, "e2e-e-pw", [ids.role!]);
    await createUser(admin, "e2e-e-ui-pw", [ids.role!]);
    await createUser(admin, "e2e-e-brute", [ids.role!]);
    await createUser(admin, "e2e-e-unit", [ids.roleByCode["ORGANIZATION_REPORTER"]], { reportUnit: { id: ids.unit } });
    await admin.dispose();
  });

  test.afterAll(async () => {
    await cleanup();
    const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
    const lines = results.map(
      (r) => `${r.ok ? "PASS" : "FAIL"} | ${pad(r.group, 10)} | ${pad(r.case, 70)} | ${pad(r.expect, 16)} | ${r.got}${r.note ? " — " + r.note : ""}`
    );
    console.log("\n==== KẾT QUẢ NHÓM E ====\n" + lines.join("\n"));
    // Ghi ra thư mục tạm của máy: test-results/ bị các lượt Playwright song song xoá.
    fs.appendFileSync(path.join(os.tmpdir(), "e2e-95-he-thong-quyen.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  });

  // ------------------------------------------------------------------ AUTH
  test("API /auth: đăng nhập, làm mới, đăng xuất, đổi mật khẩu", async () => {
    const G = "auth";
    const anon = await Raw.as(null);
    record(G, "Đăng nhập đúng (user tự tạo)", await anon.send("post", `/auth/login`, { username: "e2e-e-a", password: PW }), [200]);
    record(G, "Đăng nhập bằng email", await anon.send("post", `/auth/login`, { username: "e2e-e-a@e2e.local", password: PW }), [200], "LoginRequest: 'Username or email'");
    const wrong = await anon.send("post", `/auth/login`, { username: "e2e-e-a", password: "sai-mat-khau" });
    record(G, "Sai mật khẩu", wrong, UNAUTH);
    const nouser = await anon.send("post", `/auth/login`, { username: "e2e-e-khong-ton-tai", password: "sai-mat-khau" });
    record(G, "User không tồn tại", nouser, UNAUTH);
    check(G, "Thông báo sai MK và user không tồn tại giống nhau (chống dò tài khoản)", "giống nhau",
      `${wrong.json?.message} | ${nouser.json?.message}`, wrong.json?.message === nouser.json?.message);
    record(G, "Rỗng cả hai", await anon.send("post", `/auth/login`, { username: "", password: "" }), BAD);
    record(G, "Thân rỗng {}", await anon.send("post", `/auth/login`, {}), BAD);
    record(G, "Không có thân", await anon.send("post", `/auth/login`), BAD);
    record(G, "SQL injection username", await anon.send("post", `/auth/login`, { username: "admin' OR '1'='1' --", password: "x" }), UNAUTH);
    record(G, "SQL injection password", await anon.send("post", `/auth/login`, { username: "admin", password: "' OR 1=1 --" }), UNAUTH);
    record(G, "NoSQL injection (object thay chuỗi)", await anon.send("post", `/auth/login`, { username: { $ne: null }, password: { $ne: null } }), BAD);
    record(G, "Username 10.000 ký tự", await anon.send("post", `/auth/login`, { username: "a".repeat(10_000), password: "x" }), [400, 401, 422]);
    record(G, "Password 100.000 ký tự", await anon.send("post", `/auth/login`, { username: "e2e-e-a", password: "x".repeat(100_000) }), [400, 401, 413, 422]);

    // Khoá sau nhiều lần sai? — đo trên user tự tạo.
    let lastWrong = 0;
    for (let i = 0; i < 12; i++) lastWrong = (await anon.send("post", `/auth/login`, { username: "e2e-e-brute", password: `sai-${i}` })).status;
    const afterBrute = await anon.send("post", `/auth/login`, { username: "e2e-e-brute", password: PW });
    check(G, "12 lần sai liên tiếp rồi đúng mật khẩu — có khoá / chặn tần suất?", "bị khoá hoặc 429 (khuyến nghị)",
      `lần sai cuối ${lastWrong}, lần đúng ${afterBrute.status}`, afterBrute.status !== 200 || lastWrong === 429,
      "Không có cơ chế khoá/giới hạn tần suất → dò mật khẩu không giới hạn");

    // refresh
    const s1 = await rawLogin({ username: "e2e-e-a", password: PW });
    const refresh1 = s1.json.refreshToken as string;
    const access1 = s1.json.accessToken as string;
    const r1 = await anon.send("post", `/auth/refresh`, { refreshToken: refresh1 });
    record(G, "Refresh token hợp lệ", r1, [200]);
    record(G, "Dùng lại refresh token đã dùng (rotation)", await anon.send("post", `/auth/refresh`, { refreshToken: refresh1 }), UNAUTH);
    record(G, "Refresh token giả", await anon.send("post", `/auth/refresh`, { refreshToken: "gia-mao-123" }), UNAUTH);
    record(G, "Refresh token rỗng", await anon.send("post", `/auth/refresh`, { refreshToken: "" }), BAD);
    record(G, "Dùng access token làm refresh token", await anon.send("post", `/auth/refresh`, { refreshToken: access1 }), UNAUTH);
    const refresh2 = r1.json?.refreshToken as string;
    const access2 = r1.json?.accessToken as string;
    const a2 = await Raw.as(null, access2);
    record(G, "GET /auth/me", await a2.send("get", `/auth/me`), [200]);
    const perms = await a2.send("get", `/auth/permissions`);
    record(G, "GET /auth/permissions", perms, [200]);
    record(G, "Logout", await anon.send("post", `/auth/logout`, { refreshToken: refresh2 }), OK);
    record(G, "Refresh sau khi logout", await anon.send("post", `/auth/refresh`, { refreshToken: refresh2 }), UNAUTH);
    record(G, "Access token cũ sau logout (JWT không thu hồi được, TTL 15 phút)", await a2.send("get", `/auth/me`), [200, 401],
      "200 = token còn dùng tới hết hạn (thiết kế)");
    record(G, "Logout với token rác (không bao giờ lỗi)", await anon.send("post", `/auth/logout`, { refreshToken: "rac" }), OK);
    record(G, "Không token gọi /auth/me", await anon.send("get", `/auth/me`), UNAUTH);
    const fake = await Raw.as(null, "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.");
    record(G, "Token alg=none sub=1 (admin)", await fake.send("get", `/auth/me`), UNAUTH);
    // token chữ ký bị sửa
    const parts = access1.split(".");
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: "1", uid: 1 })).toString("base64url")}.${parts[2]}`;
    const tamp = await Raw.as(null, tampered);
    record(G, "Token sửa payload (sub=1) giữ chữ ký cũ", await tamp.send("get", `/users`), UNAUTH);

    // đổi mật khẩu — user e2e-e-pw
    const pwLogin = await rawLogin({ username: "e2e-e-pw", password: PW });
    const pw = await Raw.as(null, pwLogin.json.accessToken);
    record(G, "Đổi MK: mật khẩu cũ sai", await pw.send("post", `/auth/change-password`, { currentPassword: "sai", newPassword: "MatKhauMoi#1" }), DENIED);
    record(G, "Đổi MK: mật khẩu mới yếu (<8)", await pw.send("post", `/auth/change-password`, { currentPassword: PW, newPassword: "123" }), BAD);
    record(G, "Đổi MK: mật khẩu mới rỗng", await pw.send("post", `/auth/change-password`, { currentPassword: PW, newPassword: "" }), BAD);
    record(G, "Đổi MK: 'aaaaaaaa' (8 ký tự toàn một chữ)", await pw.send("post", `/auth/change-password`, { currentPassword: PW, newPassword: "aaaaaaaa" }), [200, 400, 422],
      "chỉ kiểm độ dài (chủ ý theo comment UserRequest)");
    // nếu 'aaaaaaaa' được nhận thì mật khẩu hiện tại là aaaaaaaa
    let current = PW;
    const me = await rawLogin({ username: "e2e-e-pw", password: "aaaaaaaa" });
    let tokenNow = pwLogin.json.accessToken;
    if (me.status === 200) {
      current = "aaaaaaaa";
      tokenNow = me.json.accessToken;
    }
    const pw2 = await Raw.as(null, tokenNow);
    const same = await pw2.send("post", `/auth/change-password`, { currentPassword: current, newPassword: current });
    record(G, "Đổi MK: mật khẩu mới giống mật khẩu cũ", same, [200, 400, 409, 422], "200 = cho phép trùng mật khẩu cũ");
    const oldRefresh = (await rawLogin({ username: "e2e-e-pw", password: current })).json.refreshToken;
    const pw3 = await Raw.as({ username: "e2e-e-pw", password: current });
    const changed = await pw3.send("post", `/auth/change-password`, { currentPassword: current, newPassword: "MatKhauMoi#2026" });
    record(G, "Đổi MK hợp lệ", changed, [200]);
    record(G, "Refresh token của phiên khác sau khi đổi MK", await anon.send("post", `/auth/refresh`, { refreshToken: oldRefresh }), UNAUTH);
    record(G, "Đăng nhập bằng mật khẩu cũ sau khi đổi", await anon.send("post", `/auth/login`, { username: "e2e-e-pw", password: current }), UNAUTH);
    record(G, "Đăng nhập bằng mật khẩu mới", await anon.send("post", `/auth/login`, { username: "e2e-e-pw", password: "MatKhauMoi#2026" }), [200]);
    record(G, "Không token gọi change-password", await anon.send("post", `/auth/change-password`, { currentPassword: "x", newPassword: "yyyyyyyy" }), UNAUTH);

    // user bị ngừng hoạt động
    const admin = await Raw.as(ADMIN);
    const live = await rawLogin({ username: "e2e-e-b", password: PW });
    await admin.send("put", `/users/${ids.users["e2e-e-b"]}`, { status: "inactive" });
    record(G, "Đăng nhập tài khoản đã ngừng hoạt động", await anon.send("post", `/auth/login`, { username: "e2e-e-b", password: PW }), UNAUTH);
    record(G, "Refresh của tài khoản vừa bị ngừng", await anon.send("post", `/auth/refresh`, { refreshToken: live.json.refreshToken }), UNAUTH);
    const bLive = await Raw.as(null, live.json.accessToken);
    record(G, "Access token còn hạn của tài khoản vừa bị ngừng", await bLive.send("get", `/notifications`), [401, 403], "cache quyền bị xoá khi đổi trạng thái");
    await admin.send("put", `/users/${ids.users["e2e-e-b"]}`, { status: "active" });
    for (const c of [anon, a2, fake, tamp, pw, pw2, pw3, admin, bLive]) await c.dispose();
  });

  // ------------------------------------------------------------------ USERS
  test("API /users: CRUD, trùng, sai, tự hạ / tự xoá, mass assignment", async () => {
    const G = "users";
    const admin = await Raw.as(ADMIN);
    const c = await admin.send("post", `/users`, userBody("e2e-e-crud", [ids.role!]));
    record(G, "Admin tạo user hợp lệ", c, [200, 201]);
    const id = c.json?.id;
    if (id) ids.users["e2e-e-crud"] = id;
    record(G, "GET /users/{id}", await admin.send("get", `/users/${id}`), [200]);
    check(G, "Phản hồi user không lộ passwordHash", "không có trường mật khẩu", c.body, !/password/i.test(c.body));
    record(G, "Tạo username trùng", await admin.send("post", `/users`, { ...userBody("e2e-e-crud", [ids.role!]), email: "khac@e2e.local" }), [409, 400, 422]);
    record(G, "Tạo username trùng khác hoa/thường (E2E-E-CRUD)", await admin.send("post", `/users`, { ...userBody("E2E-E-CRUD", [ids.role!]), email: "khac2@e2e.local" }), [409, 400, 422]);
    record(G, "Tạo email trùng", await admin.send("post", `/users`, { ...userBody("e2e-e-crud2", [ids.role!]), email: "e2e-e-crud@e2e.local" }), [409, 400, 422]);
    record(G, "Email sai định dạng", await admin.send("post", `/users`, { ...userBody("e2e-e-crud3", [ids.role!]), email: "khong-phai-email" }), BAD);
    record(G, "Username có dấu cách/ký tự lạ", await admin.send("post", `/users`, userBody("e2e e <x>", [ids.role!])), BAD);
    record(G, "Username 2 ký tự", await admin.send("post", `/users`, userBody("ab", [ids.role!])), BAD);
    record(G, "Mật khẩu 7 ký tự", await admin.send("post", `/users`, { ...userBody("e2e-e-crud4", [ids.role!]), password: "1234567" }), BAD);
    record(G, "Không có vai trò", await admin.send("post", `/users`, userBody("e2e-e-crud5", [])), BAD);
    record(G, "Vai trò không tồn tại (id 999999)", await admin.send("post", `/users`, userBody("e2e-e-crud6", [999999])), [400, 404, 422]);
    record(G, "Họ tên 300 ký tự", await admin.send("post", `/users`, { ...userBody("e2e-e-crud7", [ids.role!]), fullName: "x".repeat(300) }), BAD);
    record(G, "Status lạ 'superuser'", await admin.send("post", `/users`, { ...userBody("e2e-e-crud8", [ids.role!]), status: "superuser" }), BAD);
    record(G, "Gắn đơn vị đã có tài khoản (E2E-E-U1 của e2e-e-unit)", await admin.send("post", `/users`, userBody("e2e-e-crud9", [ids.role!], { reportUnit: { id: ids.unit } })), [409, 400, 422],
      "BR: mỗi đơn vị một tài khoản hoạt động");
    record(G, "Gắn đơn vị không tồn tại", await admin.send("post", `/users`, userBody("e2e-e-crud10", [ids.role!], { reportUnit: { id: 99999999 } })), [400, 404, 422]);
    const xssU = await admin.send("post", `/users`, { ...userBody("e2e-e-xss", [ids.role!]), fullName: XSS });
    record(G, "Tạo user họ tên chứa <img onerror> (lưu nguyên văn, UI phải escape)", xssU, [200, 201]);
    if (xssU.json?.id) ids.users["e2e-e-xss"] = xssU.json.id;

    record(G, "PUT đổi họ tên", await admin.send("put", `/users/${id}`, { fullName: "E2E-E đã sửa" }), [200]);
    record(G, "PUT danh sách vai trò rỗng", await admin.send("put", `/users/${id}`, { roles: [] }), BAD);
    record(G, "PUT username trùng người khác (e2e-e-a)", await admin.send("put", `/users/${id}`, { username: "e2e-e-a" }), [409, 400, 422]);
    record(G, "PUT id không tồn tại", await admin.send("put", `/users/99999999`, { fullName: "x" }), [404]);
    record(G, "Admin đặt lại MK user: quá ngắn", await admin.send("post", `/users/${id}/password`, { password: "123" }), BAD);
    record(G, "Admin đặt lại MK user hợp lệ", await admin.send("post", `/users/${id}/password`, { password: "DatLai#2026" }), [200]);
    record(G, "Đăng nhập bằng MK admin vừa đặt", await (await Raw.as(null)).send("post", `/auth/login`, { username: "e2e-e-crud", password: "DatLai#2026" }), [200]);
    record(G, "Lọc ?q=e2e-e-crud", await admin.send("get", `/users?q=e2e-e-crud`), [200]);
    const page = await admin.send("get", `/users?_start=0&_end=2`);
    check(G, "Phân trang _start/_end trả 2 dòng + X-Total-Count", "2 dòng, total ≥ 9",
      `rows=${page.json?.length} total=${page.headers?.["x-total-count"]}`, page.json?.length === 2 && Number(page.headers?.["x-total-count"]) >= 9);
    record(G, "Phân trang _end âm", await admin.send("get", `/users?_start=-5&_end=-1`), [200, 400, 422]);
    const asc = await admin.send("get", `/users?_sort=passwordHash&_order=asc`);
    const desc = await admin.send("get", `/users?_sort=passwordHash&_order=desc`);
    const order = (r: Res) => (r.json as any[] | undefined)?.map((u) => u.id).join(",");
    check(G, "Sắp xếp theo passwordHash (dò hash qua thứ tự)", "bị bỏ qua: asc = desc", `asc=${asc.status} desc=${desc.status} cùng thứ tự=${order(asc) === order(desc)}`,
      [200, 400, 422].includes(asc.status) && (asc.status !== 200 || order(asc) === order(desc)), "SORTABLE whitelist ở UserService");
    const all = await admin.send("get", `/users`);
    const zz = await admin.send("get", `/users?passwordHash_like=zzzz`);
    check(G, "Lọc theo passwordHash_like=zzzz (oracle hash)", "bị bỏ qua: tổng không đổi", `all=${all.headers?.["x-total-count"]} zz=${zz.status}/${zz.headers?.["x-total-count"]}`,
      zz.status !== 200 || zz.headers?.["x-total-count"] === all.headers?.["x-total-count"]);

    // user thường (e2e-e-a: chỉ notifications:read/delete) — tự nâng quyền
    const a = await Raw.as({ username: "e2e-e-a", password: PW });
    const aId = ids.users["e2e-e-a"];
    record(G, "User thường GET /users", await a.send("get", `/users`), FORBID);
    record(G, "User thường GET /users/{chính mình}", await a.send("get", `/users/${aId}`), FORBID);
    record(G, "User thường PUT chính mình roles=[ADMIN] (mass assignment)", await a.send("put", `/users/${aId}`, { roles: [{ id: ids.roleByCode["ADMIN"] }] }), FORBID);
    record(G, "User thường đặt MK cho admin", await a.send("post", `/users/1/password`, { password: "Hacked#2026" }), FORBID);
    record(G, "User thường xoá user khác", await a.send("delete", `/users/${id}`), FORBID);
    record(G, "User thường tạo user", await a.send("post", `/users`, userBody("e2e-e-hack", [ids.roleByCode["ADMIN"]])), FORBID);
    const roleAfter = (await admin.send("get", `/users/${aId}`)).json?.roles?.map((r: any) => r.code).join(",");
    check(G, "Sau các ca trên, e2e-e-a vẫn chỉ có E2E_E_BASIC", "E2E_E_BASIC", String(roleAfter), roleAfter === "E2E_E_BASIC");

    // admin tự xoá / tự hạ — dùng admin e2e riêng (không đụng admin thật)
    await createUser(admin, "e2e-e-admin", [ids.roleByCode["ADMIN"]]);
    const ea = await Raw.as({ username: "e2e-e-admin", password: PW });
    const eaId = ids.users["e2e-e-admin"];
    record(G, "Admin tự xoá chính mình", await ea.send("delete", `/users/${eaId}`), [409]);
    record(G, "Admin tự chuyển mình sang inactive", await ea.send("put", `/users/${eaId}`, { status: "inactive" }), [200, 409],
      "còn admin khác nên có thể được phép");
    const st = (await admin.send("get", `/users/${eaId}`)).json?.status;
    if (st !== "active") await admin.send("put", `/users/${eaId}`, { status: "active" });
    const ea2 = await Raw.as({ username: "e2e-e-admin", password: PW });
    record(G, "Admin tự bỏ vai trò ADMIN của mình (còn admin khác)", await ea2.send("put", `/users/${eaId}`, { roles: [{ id: ids.role }] }), [200, 409],
      "nghiệp vụ chỉ chặn khi là admin cuối cùng");
    // admin thật: chỉ thử xoá chính mình (bị chặn bởi CurrentUser) — không đụng vai trò/trạng thái
    record(G, "Admin thật tự xoá chính mình", await admin.send("delete", `/users/1`), [409]);

    record(G, "Admin xoá user e2e-e-crud", await admin.send("delete", `/users/${id}`), OK);
    delete ids.users["e2e-e-crud"];
    record(G, "Xoá lại user vừa xoá", await admin.send("delete", `/users/${id}`), [404]);
    record(G, "Đăng nhập user đã xoá", await (await Raw.as(null)).send("post", `/auth/login`, { username: "e2e-e-crud", password: "DatLai#2026" }), UNAUTH);
    for (const x of [admin, a, ea, ea2]) await x.dispose();
  });

  // ------------------------------------------------------------------ ROLES
  test("API /roles + /permissions", async () => {
    const G = "roles";
    const admin = await Raw.as(ADMIN);
    record(G, "GET /permissions", await admin.send("get", `/permissions`), [200]);
    record(G, "GET /permissions/{id} không tồn tại", await admin.send("get", `/permissions/999999`), [404]);
    record(G, "POST /permissions (không có API ghi)", await admin.send("post", `/permissions`, { code: "x:y", name: "x" }), [403, 404, 405]);
    const c = await admin.send("post", `/roles`, { code: "E2E_E_CRUD", name: "E2E-E crud", permissions: [{ id: ids.permByCode["notifications:read"] }] });
    record(G, "Tạo vai trò hợp lệ", c, [200, 201]);
    const rid = c.json?.id;
    ids.roleUnused = rid;
    record(G, "Tạo mã trùng", await admin.send("post", `/roles`, { code: "E2E_E_CRUD", name: "dup", permissions: [] }), [409, 400, 422]);
    record(G, "Mã chữ thường 'e2e_e_x'", await admin.send("post", `/roles`, { code: "e2e_e_x", name: "x", permissions: [] }), BAD);
    record(G, "Mã ADMIN (trùng vai trò hệ thống)", await admin.send("post", `/roles`, { code: "ADMIN", name: "x", permissions: [] }), [409, 400, 422]);
    record(G, "Gán quyền không tồn tại (id 999999)", await admin.send("post", `/roles`, { code: "E2E_E_BADPERM", name: "x", permissions: [{ id: 999999 }] }), [400, 404, 422]);
    record(G, "Thiếu permissions", await admin.send("post", `/roles`, { code: "E2E_E_NOPERM", name: "x" }), BAD);
    record(G, "Tên rỗng", await admin.send("post", `/roles`, { code: "E2E_E_NONAME", name: "", permissions: [] }), BAD);
    record(G, "Mô tả 600 ký tự", await admin.send("post", `/roles`, { code: "E2E_E_LONG", name: "x", description: "x".repeat(600), permissions: [] }), BAD);
    record(G, "Sửa tên + quyền", await admin.send("put", `/roles/${rid}`, { name: "E2E-E crud 2", permissions: [{ id: ids.permByCode["notifications:read"] }, { id: ids.permByCode["notifications:delete"] }] }), [200]);
    record(G, "Sửa: gán quyền không tồn tại", await admin.send("put", `/roles/${rid}`, { permissions: [{ id: 999999 }] }), [400, 404, 422]);
    record(G, "Đổi mã vai trò hệ thống ADMIN", await admin.send("put", `/roles/${ids.roleByCode["ADMIN"]}`, { code: "ADMIN" }), [200, 409],
      "gửi lại đúng mã cũ: không đổi gì");
    record(G, "Xoá vai trò hệ thống ADMIN", await admin.send("delete", `/roles/${ids.roleByCode["ADMIN"]}`), [409]);
    record(G, "Xoá vai trò đang gán user (E2E_E_BASIC)", await admin.send("delete", `/roles/${ids.role}`), [409]);
    record(G, "Xoá vai trò không tồn tại", await admin.send("delete", `/roles/999999`), [404]);
    const a = await Raw.as({ username: "e2e-e-a", password: PW });
    record(G, "User thường GET /roles", await a.send("get", `/roles`), FORBID);
    record(G, "User thường thêm quyền users:write vào vai trò của mình", await a.send("put", `/roles/${ids.role}`, { permissions: [{ id: ids.permByCode["users:write"] }] }), FORBID);
    record(G, "User thường GET /permissions", await a.send("get", `/permissions`), FORBID);
    record(G, "Xoá vai trò không còn ai giữ", await admin.send("delete", `/roles/${rid}`), OK);
    for (const x of [admin, a]) await x.dispose();
  });

  // ------------------------------------------------------------------ ROW LEVEL
  test("API /row_level_policies + lọc dữ liệu thật theo đơn vị", async () => {
    const G = "row-level";
    const admin = await Raw.as(ADMIN);
    record(G, "GET danh sách", await admin.send("get", `/row_level_policies`), [200]);
    record(G, "GET /coverage", await admin.send("get", `/row_level_policies/coverage`), [200]);
    record(G, "GET /metadata?resource=input_reports", await admin.send("get", `/row_level_policies/metadata?resource=input_reports`), [200]);
    record(G, "GET /metadata resource không quản lý", await admin.send("get", `/row_level_policies/metadata?resource=khong_co`), BAD);
    record(G, "GET /metadata thiếu resource", await admin.send("get", `/row_level_policies/metadata`), BAD);
    const base = {
      kind: "SCOPE",
      role: { id: ids.role },
      resource: "blog_posts",
      action: "read",
      name: "E2E-E-scope-thu",
      scope: { field: "status", op: "eq", value: { lit: "DRAFT" } },
      enabled: false,
    };
    const c = await admin.send("post", `/row_level_policies`, base);
    record(G, "Tạo SCOPE (tắt) cho vai trò E2E", c, [200, 201]);
    const pid = c.json?.id;
    record(G, "GET /{id}", await admin.send("get", `/row_level_policies/${pid}`), [200]);
    record(G, "Sửa (đổi tên, bật)", await admin.send("put", `/row_level_policies/${pid}`, { name: "E2E-E-scope-thu-2", enabled: true }), [200]);
    record(G, "FILTER có gắn vai trò (sai luật)", await admin.send("post", `/row_level_policies`, { ...base, kind: "FILTER", name: "E2E-E-filter-sai" }), BAD);
    record(G, "SCOPE không có vai trò", await admin.send("post", `/row_level_policies`, { ...base, role: null, name: "E2E-E-scope-norole" }), BAD);
    record(G, "kind lạ", await admin.send("post", `/row_level_policies`, { ...base, kind: "ALLOW_ALL", name: "E2E-E-kind" }), BAD);
    record(G, "Trường không tồn tại trong scope", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-field", scope: { field: "passwordHash", op: "eq", value: { lit: "x" } } }), BAD);
    record(G, "Toán tử sai cho kiểu (like trên enum)", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-op", scope: { field: "status", op: "like", value: { lit: "D%" } } }), BAD);
    record(G, "Giá trị enum không hợp lệ", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-enum", scope: { field: "status", op: "eq", value: { lit: "HACK" } } }), BAD);
    record(G, "ctx không tồn tại", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-ctx", scope: { field: "id", op: "eq", value: { ctx: "user.password" } } }), BAD);
    record(G, "Scope là chuỗi SQL", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-sql", scope: "1=1; DROP TABLE users" }), BAD);
    record(G, "Resource không quản lý", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-res", resource: "users" }), BAD);
    record(G, "Action lạ", await admin.send("post", `/row_level_policies`, { ...base, name: "E2E-E-act", action: "approve_all" }), BAD);
    record(G, "Scope lồng sâu 200 cấp", await admin.send("post", `/row_level_policies`, {
      ...base,
      name: "E2E-E-deep",
      scope: Array.from({ length: 200 }).reduce((acc: any) => ({ not: acc }), { field: "id", op: "eq", value: { lit: 1 } }),
    }), [201, 400, 422], "201 = nhận (không giới hạn độ sâu)");
    // Bỏ ca lồng 3000 cấp: cùng họ với ca 5000 lá (scope lớn), không thử trên backend dùng chung.
    // ĐÃ GỠ ca "Scope 'all' 5000 lá": máy chủ NHẬN (201) chính sách ~264 KB, rồi GET/DELETE chính
    // sách đó làm backend hết heap (OutOfMemoryError ở RowLevelPolicyService.get → findById, các
    // quan hệ EAGER nhân bản cột scope). Chạy lại sẽ đánh sập backend dùng chung — đừng bật lại.
    record(G, "Xoá policy", await admin.send("delete", `/row_level_policies/${pid}`), OK);
    record(G, "Xoá lại policy đã xoá", await admin.send("delete", `/row_level_policies/${pid}`), [404]);

    // lọc dữ liệu thật
    const unitTB = Object.values((await admin.send("get", `/report_units?budgetCode=1051101`)).json as any[])[0];
    const allReports = (await admin.send("get", `/input_reports?_start=0&_end=1000`)).json as any[];
    const otherReport = allReports.find((r) => r.unit?.id !== unitTB.id);
    const tb = await Raw.as(EXISTING["donvi.bienhoa"]);
    const tbList = await tb.send("get", `/input_reports?_start=0&_end=1000`);
    const foreign = (tbList.json as any[] | undefined)?.filter((r) => r.unit?.id !== unitTB.id) ?? [];
    check(G, "donvi.bienhoa GET /input_reports chỉ thấy phiếu của Trấn Biên", "0 phiếu đơn vị khác",
      `status ${tbList.status}, tổng ${tbList.json?.length}, đơn vị khác ${foreign.length} (admin thấy ${allReports.length})`, tbList.status === 200 && foreign.length === 0);
    if (otherReport) {
      record(G, `donvi.bienhoa GET /input_reports/{phiếu đơn vị khác #${otherReport.id}} (IDOR)`, await tb.send("get", `/input_reports/${otherReport.id}`), [403, 404]);
      record(G, "donvi.bienhoa GET /input_report_sheets?report.id=<phiếu đơn vị khác>", await tb.send("get", `/input_report_sheets?report.id=${otherReport.id}`), [200, 403, 404]);
      const sh = await tb.send("get", `/input_report_sheets?report.id=${otherReport.id}`);
      check(G, "…không trả tờ biểu nào của đơn vị khác", "0 dòng", `status ${sh.status} rows=${Array.isArray(sh.json) ? sh.json.length : "-"}`, sh.status !== 200 || (sh.json as any[]).length === 0);
      record(G, "Lách lọc: ?unit.id=<đơn vị khác>", await tb.send("get", `/input_reports?unit.id=${otherReport.unit.id}`), [200, 400, 403]);
      const lach = await tb.send("get", `/input_reports?unit.id=${otherReport.unit.id}`);
      check(G, "…kết quả lách lọc rỗng", "0 dòng", `rows=${Array.isArray(lach.json) ? lach.json.length : "-"}`, !Array.isArray(lach.json) || lach.json.length === 0);
      const sim = await admin.send("post", `/row_level_policies/simulate`, { resource: "input_reports", action: "read", userId: 5, recordId: otherReport.id });
      record(G, "POST /simulate (donvi.bienhoa đọc phiếu đơn vị khác)", sim, [200]);
      check(G, "…simulate kết luận không được", "allowed=false", sim.body, sim.json?.allowed === false);
    } else {
      check(G, "Có phiếu của đơn vị khác để thử IDOR", "có", "không có phiếu nào", false);
    }
    record(G, "GET /explain", await admin.send("get", `/row_level_policies/explain?resource=input_reports&action=read&userId=5`), [200]);
    record(G, "GET /explain userId không tồn tại", await admin.send("get", `/row_level_policies/explain?resource=input_reports&action=read&userId=99999999`), [400, 404, 422]);
    record(G, "POST /simulate recordId không tồn tại", await admin.send("post", `/row_level_policies/simulate`, { resource: "input_reports", action: "read", userId: 5, recordId: 99999999 }), [200, 404]);
    record(G, "POST /simulate thiếu trường", await admin.send("post", `/row_level_policies/simulate`, { resource: "input_reports" }), BAD);
    const eu = await Raw.as({ username: "e2e-e-unit", password: PW });
    const euList = await eu.send("get", `/input_reports`);
    check(G, "e2e-e-unit (đơn vị mới, chưa có phiếu) thấy 0 phiếu", "0", `status ${euList.status} rows=${euList.json?.length}`, euList.status === 200 && euList.json?.length === 0);
    const euUnits = await eu.send("get", `/report_units?_start=0&_end=2000`);
    check(G, "Cán bộ đơn vị GET /report_units (danh mục)", "200 (danh mục chung, không số liệu)",
      `status ${euUnits.status} rows=${Array.isArray(euUnits.json) ? euUnits.json.length : "-"}`, [200, 403].includes(euUnits.status), "chỉ ghi nhận");
    record(G, "Cán bộ đơn vị GET /row_level_policies", await eu.send("get", `/row_level_policies`), FORBID);
    record(G, "Cán bộ đơn vị POST /simulate", await eu.send("post", `/row_level_policies/simulate`, { resource: "input_reports", action: "read", userId: 5, recordId: 1 }), FORBID);
    record(G, "Cán bộ đơn vị tạo policy SCOPE cho vai trò của mình", await eu.send("post", `/row_level_policies`, { ...base, name: "E2E-E-hack", role: { id: ids.roleByCode["ORGANIZATION_REPORTER"] }, resource: "input_reports" }), FORBID);
    for (const x of [admin, tb, eu]) await x.dispose();
  });

  // ------------------------------------------------------------------ UNITS / ORGS / DEPTS
  test("API /report_units, /organizations, /departments, /master/organization-units", async () => {
    const G = "danh-muc";
    const admin = await Raw.as(ADMIN);
    const p = await admin.send("post", `/report_units`, { budgetCode: "E2E-E-P1", name: "E2E-E cha", unitType: "ubnd_huyen", block: "huyen" });
    record(G, "Tạo đơn vị cha", p, [200, 201]);
    const ch = await admin.send("post", `/report_units`, { budgetCode: "E2E-E-C1", name: "E2E-E con", unitType: "ubnd_xa", block: "xa", parent: { id: p.json?.id } });
    record(G, "Tạo đơn vị con", ch, [200, 201]);
    record(G, "Mã QHNS trùng (E2E-E-C1)", await admin.send("post", `/report_units`, { budgetCode: "E2E-E-C1", name: "trùng", unitType: "ubnd_xa" }), [409, 400, 422]);
    record(G, "Mã QHNS trùng khác hoa/thường (e2e-e-c1)", await admin.send("post", `/report_units`, { budgetCode: "e2e-e-c1", name: "trùng", unitType: "ubnd_xa" }), [409, 400, 422], "201 = trùng mã khác hoa thường lọt qua");
    record(G, "Mã QHNS trùng đơn vị có sẵn 1051101", await admin.send("post", `/report_units`, { budgetCode: "1051101", name: "E2E-E trùng", unitType: "ubnd_xa" }), [409, 400, 422]);
    record(G, "Mã rỗng", await admin.send("post", `/report_units`, { budgetCode: "", name: "E2E-E x", unitType: "ubnd_xa" }), BAD);
    record(G, "Mã có ký tự lạ ' OR 1=1", await admin.send("post", `/report_units`, { budgetCode: "E2E' OR 1=1", name: "E2E-E x", unitType: "ubnd_xa" }), BAD);
    record(G, "Thiếu loại đơn vị", await admin.send("post", `/report_units`, { budgetCode: "E2E-E-X2", name: "E2E-E x" }), BAD);
    record(G, "Loại đơn vị lạ", await admin.send("post", `/report_units`, { budgetCode: "E2E-E-X3", name: "E2E-E x", unitType: "hacker" }), BAD);
    record(G, "Cấp trên không tồn tại", await admin.send("post", `/report_units`, { budgetCode: "E2E-E-X4", name: "E2E-E x", unitType: "ubnd_xa", parent: { id: 99999999 } }), [400, 404, 422]);
    record(G, "Tên 300 ký tự", await admin.send("post", `/report_units`, { budgetCode: "E2E-E-X5", name: "x".repeat(300), unitType: "ubnd_xa" }), BAD);
    record(G, "Chọn chính mình làm cấp trên (chu trình)", await admin.send("put", `/report_units/${p.json?.id}`, { parent: { id: p.json?.id } }), [409, 400, 422]);
    record(G, "Chọn con làm cấp trên (chu trình 2 bước)", await admin.send("put", `/report_units/${p.json?.id}`, { parent: { id: ch.json?.id } }), [409, 400, 422]);
    record(G, "Sửa mã sang mã đã có (1051101)", await admin.send("put", `/report_units/${ch.json?.id}`, { budgetCode: "1051101" }), [409, 400, 422]);
    record(G, "Sửa mã sang chuỗi rỗng (PATCH không có @NotBlank)", await admin.send("put", `/report_units/${ch.json?.id}`, { budgetCode: "" }), [400, 409, 422]);
    const cAfter = (await admin.send("get", `/report_units/${ch.json?.id}`)).json;
    if (cAfter?.budgetCode !== "E2E-E-C1") await admin.send("put", `/report_units/${ch.json?.id}`, { budgetCode: "E2E-E-C1" });
    record(G, "Sửa mã có ký tự lạ (PATCH)", await admin.send("put", `/report_units/${ch.json?.id}`, { budgetCode: "E2E <x>" }), [400, 409, 422]);
    const cAfter2 = (await admin.send("get", `/report_units/${ch.json?.id}`)).json;
    if (cAfter2?.budgetCode !== "E2E-E-C1") await admin.send("put", `/report_units/${ch.json?.id}`, { budgetCode: "E2E-E-C1" });
    record(G, "Xoá đơn vị còn đơn vị con", await admin.send("delete", `/report_units/${p.json?.id}`), [409]);
    record(G, "Xoá đơn vị còn tài khoản gắn (E2E-E-U1)", await admin.send("delete", `/report_units/${ids.unit}`), [409]);
    const xu = await admin.send("post", `/report_units`, { budgetCode: "E2E-E-XSS", name: XSS, unitType: "ubnd_xa", block: "xa" });
    record(G, "Tạo đơn vị tên chứa <img onerror>", xu, [200, 201]);
    ids.unitXss = xu.json?.id;
    record(G, "Xoá đơn vị con", await admin.send("delete", `/report_units/${ch.json?.id}`), OK);
    record(G, "Xoá đơn vị cha (đã hết con)", await admin.send("delete", `/report_units/${p.json?.id}`), OK);
    record(G, "Lọc ?budgetCode=1051101", await admin.send("get", `/report_units?budgetCode=1051101`), [200]);
    record(G, "Lọc trường lạ ?hack_like=x", await admin.send("get", `/report_units?hack_like=x`), [200, 400, 422]);

    const tb = await Raw.as(EXISTING["donvi.bienhoa"]);
    record(G, "Cán bộ đơn vị tạo đơn vị", await tb.send("post", `/report_units`, { budgetCode: "E2E-E-HACK", name: "E2E-E hack", unitType: "ubnd_xa" }), FORBID);
    record(G, "Cán bộ đơn vị sửa tên đơn vị của mình", await tb.send("put", `/report_units/14`, { name: "Hack" }), FORBID);
    record(G, "Cán bộ đơn vị xoá đơn vị", await tb.send("delete", `/report_units/${ids.unitXss}`), FORBID);
    record(G, "Cán bộ đơn vị GET /master/organization-units", await tb.send("get", `/master/organization-units`), [200, 403], "comment: cho cả report_units:read");
    record(G, "Admin GET /master/organization-units?orgType=XA", await admin.send("get", `/master/organization-units?orgType=XA`), [200]);
    record(G, "Không token GET /master/organization-units", await (await Raw.as(null)).send("get", `/master/organization-units`), UNAUTH);

    // organizations / departments (base)
    const o = await admin.send("post", `/organizations`, { code: "E2E-E-ORG", name: "E2E-E tổ chức", email: "org@e2e.local" });
    record(G, "Tạo tổ chức", o, [200, 201]);
    record(G, "Tổ chức mã trùng", await admin.send("post", `/organizations`, { code: "E2E-E-ORG", name: "dup" }), [409, 400, 422]);
    record(G, "Tổ chức email sai", await admin.send("post", `/organizations`, { code: "E2E-E-ORG2", name: "x", email: "sai" }), BAD);
    const d = await admin.send("post", `/departments`, { code: "E2E-E-DEP", name: "E2E-E phòng", organization: { id: o.json?.id } });
    record(G, "Tạo phòng ban", d, [200, 201]);
    record(G, "Phòng ban thiếu tổ chức", await admin.send("post", `/departments`, { code: "E2E-E-DEP2", name: "x" }), BAD);
    record(G, "Phòng ban tổ chức không tồn tại", await admin.send("post", `/departments`, { code: "E2E-E-DEP3", name: "x", organization: { id: 99999999 } }), [400, 404, 422]);
    record(G, "Xoá tổ chức còn phòng ban", await admin.send("delete", `/organizations/${o.json?.id}`), [409]);
    record(G, "Sửa tổ chức", await admin.send("put", `/organizations/${o.json?.id}`, { name: "E2E-E tổ chức 2" }), [200]);
    record(G, "Cán bộ đơn vị tạo tổ chức", await tb.send("post", `/organizations`, { code: "E2E-E-HACKO", name: "x" }), FORBID);
    record(G, "Xoá phòng ban", await admin.send("delete", `/departments/${d.json?.id}`), OK);
    record(G, "Xoá tổ chức", await admin.send("delete", `/organizations/${o.json?.id}`), OK);
    for (const x of [admin, tb]) await x.dispose();
  });

  // ------------------------------------------------------------------ NOTIFICATIONS
  test("API /notifications + IDOR giữa hai user", async () => {
    const G = "thong-bao";
    const admin = await Raw.as(ADMIN);
    const aId = ids.users["e2e-e-a"];
    const bId = ids.users["e2e-e-b"];
    const nA = await admin.send("post", `/notifications`, { recipientId: aId, level: "INFO", title: "E2E-E cho A", body: "nội dung A" });
    record(G, "Admin tạo thông báo cho A", nA, [200, 201]);
    const nA2 = await admin.send("post", `/notifications`, { recipientId: aId, level: "WARNING", title: XSS, body: XSS, link: "javascript:alert(1)" });
    record(G, "Tạo thông báo tiêu đề <img onerror> + link javascript:", nA2, [200, 201, 400, 422], "201 = link javascript: được lưu (xem UI)");
    const nB = await admin.send("post", `/notifications`, { recipientId: bId, level: "INFO", title: "E2E-E cho B" });
    record(G, "Admin tạo thông báo cho B", nB, [200, 201]);
    record(G, "Thiếu tiêu đề", await admin.send("post", `/notifications`, { recipientId: aId, title: "" }), BAD);
    record(G, "Người nhận không tồn tại", await admin.send("post", `/notifications`, { recipientId: 99999999, title: "x" }), [400, 404, 422]);
    record(G, "Level lạ", await admin.send("post", `/notifications`, { recipientId: aId, level: "PANIC", title: "x" }), BAD);
    record(G, "Body 3000 ký tự", await admin.send("post", `/notifications`, { recipientId: aId, title: "x", body: "x".repeat(3000) }), BAD);

    const a = await Raw.as({ username: "e2e-e-a", password: PW });
    const b = await Raw.as({ username: "e2e-e-b", password: PW });
    const listA = await a.send("get", `/notifications`);
    record(G, "A GET /notifications", listA, [200]);
    check(G, "A chỉ thấy thông báo của mình", "không có 'cho B'", listA.body, !String(listA.body).includes("cho B"));
    record(G, "A GET /recent", await a.send("get", `/notifications/recent`), [200]);
    const uc = await a.send("get", `/notifications/unread-count`);
    record(G, "A GET /unread-count", uc, [200]);
    record(G, "A GET /{id} của mình", await a.send("get", `/notifications/${nA.json?.id}`), [200]);
    record(G, "A GET /{id} thông báo của B (IDOR)", await a.send("get", `/notifications/${nB.json?.id}`), [403, 404]);
    record(G, "A đánh dấu đã đọc thông báo của B", await a.send("post", `/notifications/${nB.json?.id}/read`), [403, 404]);
    record(G, "A xoá thông báo của B", await a.send("delete", `/notifications/${nB.json?.id}`), [403, 404]);
    const bStill = await b.send("get", `/notifications/${nB.json?.id}`);
    check(G, "Thông báo của B còn nguyên, chưa đọc", "200, chưa đọc", bStill.body, bStill.status === 200 && !bStill.json?.readAt && bStill.json?.read !== true);
    record(G, "A lọc ?recipient.id=<B> (lách lọc)", await a.send("get", `/notifications?recipient.id=${bId}`), [200, 400]);
    const lach = await a.send("get", `/notifications?recipient.id=${bId}`);
    check(G, "…không lộ thông báo của B", "không có 'cho B'", lach.body, !String(lach.body).includes("cho B"));
    record(G, "A đánh dấu đã đọc của mình", await a.send("post", `/notifications/${nA.json?.id}/read`), [200]);
    record(G, "A đánh dấu đọc lại lần 2 (idempotent)", await a.send("post", `/notifications/${nA.json?.id}/read`), [200]);
    record(G, "A read-all", await a.send("post", `/notifications/read-all`), [200]);
    const uc2 = await a.send("get", `/notifications/unread-count`);
    check(G, "Sau read-all A còn 0 chưa đọc", "0", uc2.body, /"?(count|unread)"?\s*:\s*0/.test(uc2.body) || uc2.body.trim() === "0");
    const ucB = await b.send("get", `/notifications/unread-count`);
    check(G, "read-all của A không đụng B (B còn ≥1 chưa đọc)", "≥1", ucB.body, !/:\s*0\b/.test(ucB.body));
    record(G, "A tạo thông báo (cần users:write)", await a.send("post", `/notifications`, { recipientId: bId, title: "giả mạo" }), FORBID);
    record(G, "A xoá thông báo của mình", await a.send("delete", `/notifications/${nA.json?.id}`), OK);
    record(G, "A GET thông báo đã xoá", await a.send("get", `/notifications/${nA.json?.id}`), [404]);
    record(G, "GET /notifications/abc (id không phải số)", await a.send("get", `/notifications/abc`), [400, 404]);
    record(G, "Không token GET /notifications", await (await Raw.as(null)).send("get", `/notifications`), UNAUTH);
    for (const x of [admin, a, b]) await x.dispose();
  });

  // ------------------------------------------------------------------ MATRIX
  test("Ma trận quyền: mỗi tài khoản có sẵn × API quản trị", async () => {
    const G = "ma-tran";
    const admin = await Raw.as(ADMIN);
    const reads: [string, string][] = [
      ["/users", "users:read"],
      ["/roles", "roles:read"],
      ["/permissions", "permissions:read"],
      ["/row_level_policies", "row_level_policies:read"],
      ["/row_level_policies/coverage", "row_level_policies:read"],
      ["/report_units", "report_units:read"],
      ["/organizations", "organizations:read"],
      ["/departments", "departments:read"],
      ["/notifications", "notifications:read"],
    ];
    const matrix: string[] = [];
    for (const [name, acc] of Object.entries(EXISTING)) {
      const api = await Raw.as(acc);
      const perms = await api.send("get", `/auth/permissions`);
      const codes: string[] = perms.json?.permissions ?? perms.json?.authorities ?? [];
      const has = (c: string) => codes.includes(c) || codes.includes("*");
      const cells: string[] = [];
      for (const [path, perm] of reads) {
        const r = await api.send("get", `${path}${path.includes("?") ? "&" : "?"}_start=0&_end=1`);
        const exp = has(perm) ? [200] : [403];
        record(G, `${name} GET ${path} (${has(perm) ? "có" : "không"} ${perm})`, r, exp);
        cells.push(`${path}=${r.status}`);
      }
      // ghi: tạo vai trò / user / đơn vị với dữ liệu hợp lệ — có quyền thì tạo được rồi dọn
      const tag = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
      const wr = await api.send("post", `/roles`, { code: `E2E_E_MX_${tag}`, name: `E2E-E mx ${name}`, permissions: [] });
      record(G, `${name} POST /roles`, wr, has("roles:write") ? [200, 201] : [403]);
      if (wr.json?.id) await admin.send("delete", `/roles/${wr.json.id}`);
      const wu = await api.send("post", `/users`, userBody(`e2e-e-mx-${tag.toLowerCase()}`, [ids.role!]));
      record(G, `${name} POST /users`, wu, has("users:write") ? [200, 201] : [403]);
      if (wu.json?.id) await admin.send("delete", `/users/${wu.json.id}`);
      const wn = await api.send("post", `/report_units`, { budgetCode: `E2E-E-MX-${tag}`, name: `E2E-E mx ${name}`, unitType: "khac" });
      record(G, `${name} POST /report_units`, wn, has("report_units:write") ? [200, 201] : [403]);
      if (wn.json?.id) await admin.send("delete", `/report_units/${wn.json.id}`);
      const wp = await api.send("put", `/users/${ids.users["e2e-e-a"]}`, { fullName: `E2E-E sửa bởi ${name}` });
      record(G, `${name} PUT /users/{e2e-e-a}`, wp, has("users:write") ? [200] : [403]);
      matrix.push(`${name.padEnd(14)} perms=${codes.length} ${cells.join(" ")} | roles:${wr.status} users:${wu.status} units:${wn.status} putUser:${wp.status}`);
      await api.dispose();
    }
    console.log("\n==== MA TRẬN ====\n" + matrix.join("\n"));
    await admin.dispose();
  });

  // ------------------------------------------------------------------ UI
  function watch(page: Page) {
    const errs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 160)}`);
    });
    page.on("pageerror", (e) => errs.push(`pageerror @${page.url().replace(/^https?:\/\/[^/]+/, "")}: ${e.message.slice(0, 120)} ${String(e.stack ?? "").replace(/\s+/g, " ").slice(0, 200)}`));
    page.on("response", (r) => {
      if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
    });
    page.on("dialog", (d) => {
      errs.push(`dialog: ${d.message()}`);
      void d.dismiss();
    });
    return errs;
  }
  async function uiLogin(page: Page, acc: Acc) {
    await page.goto("/login");
    await page.getByPlaceholder("Nhập tên đăng nhập").fill(acc.username);
    await page.getByPlaceholder("Nhập mật khẩu").fill(acc.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  }
  const xssFired = (page: Page) => page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);

  test("UI: đăng nhập / đăng xuất / hết phiên", async ({ page }) => {
    const G = "UI-phien";
    const errs = watch(page);
    await page.goto("/login");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForTimeout(1000);
    check(G, "Bấm Đăng nhập khi để trống", "ở lại /login, có báo lỗi", page.url(), page.url().includes("/login"));
    await page.getByPlaceholder("Nhập tên đăng nhập").fill("e2e-e-a");
    await page.getByPlaceholder("Nhập mật khẩu").fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForTimeout(2000);
    const msg = await page.locator("body").innerText();
    check(G, "Sai mật khẩu: ở lại /login + câu báo tiếng Việt", "/login + 'không đúng'", `${page.url()} ${/không đúng/i.test(msg) ? "có câu báo" : "KHÔNG có câu báo"}`,
      page.url().includes("/login") && /không đúng/i.test(msg));
    await page.getByPlaceholder("Nhập tên đăng nhập").fill(`<img src=x onerror="window.__xss=1">`);
    await page.getByPlaceholder("Nhập mật khẩu").fill("x");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForTimeout(1500);
    check(G, "Tên đăng nhập chứa <img onerror> không chạy script", "không chạy", String(await xssFired(page)), !(await xssFired(page)));

    await uiLogin(page, { username: "e2e-e-a", password: PW });
    check(G, "Đăng nhập đúng vào /dashboard", "/dashboard", page.url(), /\/dashboard/.test(page.url()));
    const logoutBtn = page.getByText("Đăng xuất", { exact: true }).first();
    if (!(await logoutBtn.isVisible().catch(() => false))) {
      // menu tài khoản ở header
      await page.locator("header button").last().click();
    }
    await page.getByText("Đăng xuất", { exact: true }).first().click();
    await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => undefined);
    check(G, "Đăng xuất về /login", "/login", page.url(), page.url().includes("/login"));
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("dth-auth-access") || k.startsWith("dth-auth-refresh")));
    check(G, "Đăng xuất xoá token trong localStorage", "không còn token", JSON.stringify(left), left.length === 0);
    await page.goto("/users");
    await page.waitForTimeout(2000);
    check(G, "Sau đăng xuất gõ /users → về /login", "/login", page.url(), page.url().includes("/login"));

    // hết phiên: token hỏng cả hai
    await uiLogin(page, { username: "e2e-e-a", password: PW });
    await page.evaluate(() => {
      localStorage.setItem("dth-auth-access-token", "hong.hong.hong");
      localStorage.setItem("dth-auth-refresh-token", "hong");
    });
    await page.goto("/notifications");
    await page.waitForTimeout(8000);
    const sessTxt = (await page.locator("main").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
    const sessRows = await page.locator("tbody tr").count();
    const sessLs = await page.evaluate(() => localStorage.getItem("dth-auth-access-token"));
    check(G, "Token + refresh hỏng (hết phiên) → về /login", "/login", `${page.url()} rows=${sessRows} token=${String(sessLs).slice(0, 15)} | ${sessTxt}`, page.url().includes("/login"));
    // access hỏng nhưng refresh còn tốt → tự làm mới
    await uiLogin(page, { username: "e2e-e-a", password: PW });
    await page.evaluate(() => localStorage.setItem("dth-auth-access-token", "hong.hong.hong"));
    await page.goto("/notifications");
    await page.waitForTimeout(4000);
    check(G, "Access hỏng, refresh tốt → tự làm mới, ở lại trang", "/notifications", page.url(), page.url().includes("/notifications"));
    const e5 = errs.filter((e) => /HTTP 5|pageerror|dialog/.test(e));
    check(G, "Không có 5xx / pageerror / dialog", "0", e5.join(" ; ") || "0", e5.length === 0, errs.length ? `console: ${errs.length} dòng` : undefined);
  });

  test("UI: admin quản trị người dùng (tạo/sửa/xoá/lọc) + XSS trong bảng", async ({ page }) => {
    const G = "UI-users";
    const errs = watch(page);
    {
      // Worker mới chạy lại beforeAll (dọn sạch) nên tự dựng dữ liệu XSS cho test này.
      const adm = await Raw.as(ADMIN);
      const u = await adm.send("post", `/users`, { ...userBody("e2e-e-xss", [ids.role!]), fullName: XSS });
      if (u.json?.id) ids.users["e2e-e-xss"] = u.json.id;
      await adm.send("post", `/report_units`, { budgetCode: "E2E-E-XSS", name: XSS, unitType: "ubnd_xa", block: "xa" });
      await adm.dispose();
    }
    await uiLogin(page, ADMIN);
    await page.goto("/users");
    await page.getByPlaceholder("Tìm theo họ tên hoặc tên đăng nhập...").fill("e2e-e-");
    await page.waitForTimeout(2500);
    const rows = await page.locator("tbody tr").count();
    const tableText = await page.locator("tbody").innerText().catch(() => "");
    check(G, "Lọc 'e2e-e-' chỉ ra user e2e", "≥5 dòng, toàn e2e-e-", `rows=${rows}`, rows >= 5 && !/donvi\.|so\.duyet/.test(tableText));
    await page.getByPlaceholder("Tìm theo họ tên hoặc tên đăng nhập...").fill("e2e-e-xss");
    await page.waitForTimeout(2500);
    const xssCell = await page.locator("tbody").innerText().catch(() => "");
    check(G, "Họ tên chứa <img onerror> hiện dạng chữ, script không chạy", "hiện chữ '<img', không chạy",
      `${xssCell.includes("<img") ? "hiện chữ" : "không thấy chữ"}; chạy=${await xssFired(page)} | ${xssCell.replace(/\s+/g, " ").slice(0, 80)}`, xssCell.includes("<img") && !(await xssFired(page)));
    const imgs = await page.locator("tbody img[src='x']").count();
    check(G, "Không có thẻ <img src=x> thật trong bảng", "0", String(imgs), imgs === 0);

    // tạo qua UI
    await page.goto("/users/create");
    await page.getByPlaceholder("Ví dụ: Nguyễn Văn").fill("E2E-E UI");
    await page.getByPlaceholder("Ví dụ: An", { exact: true }).fill("Tạo");
    await page.getByPlaceholder("Ví dụ: an.nv@dongnai.gov.vn").fill("e2e-e-ui@e2e.local");
    await page.getByPlaceholder("Ví dụ: an.nv", { exact: true }).fill("e2e-e-ui");
    await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(PW);
    await page.getByPlaceholder("Nhập lại mật khẩu vừa đặt").fill("khac-mat-khau");
    await page.getByRole("button", { name: "Tạo người dùng" }).click();
    await page.waitForTimeout(1500);
    check(G, "Nhập lại mật khẩu không khớp / thiếu vai trò → không tạo", "ở lại /users/create", page.url(), page.url().includes("/users/create"));
    await page.getByPlaceholder("Nhập lại mật khẩu vừa đặt").fill(PW);
    await page.locator("label").filter({ hasText: "E2E-E vai trò cơ bản" }).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Tạo người dùng" }).click();
    await page.waitForTimeout(3000);
    const admin = await Raw.as(ADMIN);
    const created = ((await admin.send("get", `/users?q=e2e-e-ui`)).json as any[] | undefined)?.find((u) => u.username === "e2e-e-ui");
    check(G, "Tạo người dùng qua giao diện", "có user e2e-e-ui", created ? `id=${created.id} url=${page.url()}` : `không có; url=${page.url()}`, Boolean(created));
    if (created) {
      ids.users["e2e-e-ui"] = created.id;
      // tạo trùng qua UI
      await page.goto("/users/create");
      await page.getByPlaceholder("Ví dụ: Nguyễn Văn").fill("E2E-E UI");
      await page.getByPlaceholder("Ví dụ: An", { exact: true }).fill("Trùng");
      await page.getByPlaceholder("Ví dụ: an.nv@dongnai.gov.vn").fill("e2e-e-ui-dup@e2e.local");
      await page.getByPlaceholder("Ví dụ: an.nv", { exact: true }).fill("e2e-e-ui");
      await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(PW);
      await page.getByPlaceholder("Nhập lại mật khẩu vừa đặt").fill(PW);
      await page.locator("label").filter({ hasText: "E2E-E vai trò cơ bản" }).getByRole("checkbox").click();
      await page.getByRole("button", { name: "Tạo người dùng" }).click();
      await page.waitForTimeout(2500);
      const body = await page.locator("body").innerText();
      check(G, "Tạo trùng tên đăng nhập qua UI → báo lỗi tiếng Việt", "ở lại form + câu báo", `${page.url()} ${/đã (có|tồn tại|được dùng)|trùng/i.test(body) ? "có câu báo" : "không thấy câu báo"}`,
        page.url().includes("/users/create") && /đã (có|tồn tại|được dùng)|trùng/i.test(body));

      // sửa
      await page.goto(`/users/edit/${created.id}`);
      await page.getByPlaceholder("Ví dụ: Nguyễn Văn").fill("E2E-E UI Đã sửa");
      await page.getByRole("button", { name: "Lưu thay đổi" }).click();
      await page.waitForTimeout(2500);
      const after = (await admin.send("get", `/users/${created.id}`)).json;
      check(G, "Sửa họ tên qua giao diện", "chứa 'Đã sửa'", String(after?.fullName), String(after?.fullName).includes("Đã sửa"));

      // xoá qua menu ⋯
      await page.goto("/users");
      await page.getByPlaceholder("Tìm theo họ tên hoặc tên đăng nhập...").fill("e2e-e-ui");
      await page.waitForTimeout(2500);
      // Bảng không hiện email: tìm dòng theo họ tên vừa sửa.
      const row = page.locator("tbody tr").filter({ hasText: "UI Đã sửa" }).first();
      await row.getByRole("button").last().click();
      await page.getByRole("menuitem", { name: "Xoá người dùng" }).click();
      await page.getByRole("alertdialog").getByRole("button").last().click();
      await page.waitForTimeout(2500);
      const gone = (await admin.send("get", `/users/${created.id}`)).status;
      check(G, "Xoá người dùng qua menu ⋯", "GET → 404", String(gone), gone === 404);
      if (gone === 404) delete ids.users["e2e-e-ui"];
    }

    // các màn khác render
    for (const path of ["/roles", "/row-level-policies", "/report-units", "/notifications", "/profile"]) {
      await page.goto(path);
      await page.waitForTimeout(3000);
      const t = await page.locator("main").first().innerText().catch(() => "");
      check(G, `Admin mở ${path}`, "hiện nội dung, không lỗi", `${t.replace(/\s+/g, " ").slice(0, 70)}`, t.length > 20 && !/Bạn chưa có quyền|Something went wrong|Đã có lỗi/i.test(t));
    }
    await page.goto("/report-units");
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/Tìm/).first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill("E2E-E-XSS");
      await page.waitForTimeout(2500);
    }
    const unitTxt = await page.locator("main").innerText().catch(() => "");
    check(G, "Tên đơn vị chứa <img onerror> trong bảng đơn vị: hiện chữ, không chạy", "không chạy",
      `${unitTxt.includes("E2E-E-XSS") ? "thấy dòng" : "không thấy dòng"}; chạy=${await xssFired(page)}`, !(await xssFired(page)));
    await page.goto("/notifications");
    await page.waitForTimeout(2000);
    check(G, "Không có script XSS nào chạy trên các màn quản trị", "không chạy", String(await xssFired(page)), !(await xssFired(page)));
    const e5 = errs.filter((e) => /HTTP 5|pageerror|dialog/.test(e));
    check(G, "Không có 5xx / pageerror / dialog", "0", e5.join(" ; ") || "0", e5.length === 0, errs.length ? errs.filter((e) => !e.startsWith("console: WebSocket")).slice(0, 4).join(" ; ") : undefined);
    await admin.dispose();
  });

  test("UI: thông báo XSS + đổi mật khẩu ở /profile", async ({ page }) => {
    const G = "UI-profile";
    const errs = watch(page);
    const admin = await Raw.as(ADMIN);
    const uid = ids.users["e2e-e-ui-pw"];
    await admin.send("post", `/notifications`, { recipientId: uid, level: "WARNING", title: XSS, body: XSS, link: "javascript:window.__xss=1" });
    await uiLogin(page, { username: "e2e-e-ui-pw", password: PW });
    await page.goto("/notifications");
    await page.waitForTimeout(3000);
    const txt = await page.locator("main").innerText().catch(() => "");
    check(G, "Thông báo tiêu đề <img onerror> hiện dạng chữ", "thấy chữ, không chạy", `${txt.includes("E2E-E-XSS") ? "thấy" : "không thấy"}; chạy=${await xssFired(page)}`, !(await xssFired(page)));
    const jsLinks = await page.locator("a[href^='javascript:']").count();
    check(G, "Không render link href=javascript: từ thông báo", "0", String(jsLinks), jsLinks === 0);

    await page.goto("/profile");
    await page.locator("#current-password").fill("sai-mat-khau");
    await page.locator("#new-password").fill("UiMoi#2026x");
    await page.locator("#confirm-password").fill("UiMoi#2026x");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await page.waitForTimeout(2000);
    const stillOld = (await rawLogin({ username: "e2e-e-ui-pw", password: PW })).status;
    const b1 = await page.locator("body").innerText();
    check(G, "Đổi MK với MK hiện tại sai → báo lỗi, MK không đổi", "MK cũ còn đăng nhập được + câu báo",
      `login cũ=${stillOld} ${/chưa đúng/i.test(b1) ? "có câu báo" : "không thấy câu báo"}`, stillOld === 200 && /chưa đúng/i.test(b1));
    await page.locator("#current-password").fill(PW);
    await page.locator("#new-password").fill("123");
    await page.locator("#confirm-password").fill("123");
    const disabledShort = await page.getByRole("button", { name: "Đổi mật khẩu" }).isDisabled();
    check(G, "MK mới 3 ký tự → nút Đổi bị khoá", "disabled", String(disabledShort), disabledShort);
    await page.locator("#new-password").fill("UiMoi#2026x");
    await page.locator("#confirm-password").fill("UiMoi#2026y");
    const disabledMismatch = await page.getByRole("button", { name: "Đổi mật khẩu" }).isDisabled();
    check(G, "Nhập lại không khớp → nút Đổi bị khoá", "disabled", String(disabledMismatch), disabledMismatch);
    await page.locator("#confirm-password").fill("UiMoi#2026x");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await page.waitForTimeout(2500);
    const newOk = (await rawLogin({ username: "e2e-e-ui-pw", password: "UiMoi#2026x" })).status;
    check(G, "Đổi MK hợp lệ qua /profile", "MK mới đăng nhập được", `login mới=${newOk}`, newOk === 200);
    await page.goto("/notifications");
    await page.waitForTimeout(2500);
    check(G, "Sau đổi MK phiên hiện tại vẫn dùng được", "ở lại trang", page.url(), !page.url().includes("/login"));
    const e5 = errs.filter((e) => /HTTP 5|pageerror|dialog/.test(e));
    check(G, "Không có 5xx / pageerror / dialog", "0", e5.join(" ; ") || "0", e5.length === 0);
    await admin.dispose();
  });

  test("UI: menu theo vai trò, đơn vị gõ thẳng URL quản trị", async ({ page }) => {
    const G = "UI-menu";
    const errs = watch(page);
    await uiLogin(page, EXISTING["donvi.bienhoa"]);
    await page.waitForTimeout(2000);
    const menuHas = async (name: string) =>
      (await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name, exact: true }).count()) > 0;
    const quick = await page.locator("main").getByRole("link", { name: /^(Người dùng|Danh sách đơn vị|Thiết lập & điều hành|Bộ biểu mẫu|Duyệt phiếu nhập)$/ }).allInnerTexts();
    check(G, "Trang chủ của đơn vị: 'Truy cập nhanh' không hiện lối tắt màn quản trị/Sở", "không có", quick.join(", ") || "không có", quick.length === 0,
      "QUICK_LINKS ở dashboard/by-sheet-view.tsx không lọc theo quyền");
    // "Danh sách đơn vị" được phép: cán bộ đơn vị có report_units:read (màn chỉ xem, không nút Thêm).
    check(G, `Đơn vị thấy mục "Danh sách đơn vị" (có report_units:read)`, "ghi nhận", (await menuHas("Danh sách đơn vị")) ? "CÓ" : "không có", true);
    for (const item of ["Người dùng", "Vai trò", "Phạm vi dữ liệu"]) {
      const has = await menuHas(item);
      check(G, `Đơn vị không thấy mục "${item}" ở menu`, "không có", has ? "CÓ" : "không có", !has);
    }
    for (const path of ["/users", "/users/create", "/roles", "/roles/create", "/row-level-policies", "/report-units", `/users/edit/1`]) {
      await page.goto(path);
      await page.waitForTimeout(2500);
      const t = await page.locator("main, body").first().innerText();
      const rows = await page.locator("tbody tr").count();
      const blocked = /Bạn chưa có quyền/i.test(t) || !page.url().endsWith(path);
      if (path === "/report-units") {
        // Cán bộ đơn vị CÓ report_units:read (script 1g cần danh mục đơn vị) — được xem danh mục là đúng quyền.
        check(G, `Đơn vị gõ thẳng ${path} (có report_units:read)`, "xem được danh mục, không có nút Thêm/Sửa/Xoá",
          `url=${page.url().replace(/^https?:\/\/[^/]+/, "")} rows=${rows} nútThêm=${await page.getByText("Thêm đơn vị", { exact: true }).count()}`, (await page.getByText("Thêm đơn vị", { exact: true }).count()) === 0);
        continue;
      }
      check(G, `Đơn vị gõ thẳng ${path}`, "trang 'chưa có quyền' / chuyển đi", `url=${page.url().replace(/^https?:\/\/[^/]+/, "")} rows=${rows} ${blocked ? "chặn" : "KHÔNG chặn"}`, blocked && rows === 0);
    }
    await page.goto("/notifications");
    await page.waitForTimeout(2000);
    check(G, "Đơn vị vẫn mở được /notifications", "không bị chặn", page.url(), page.url().includes("/notifications"));
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("dth-auth-")).forEach((k) => localStorage.removeItem(k)));
    await uiLogin(page, ADMIN);
    await page.waitForTimeout(2000);
    const seen: string[] = [];
    for (const x of ["Người dùng", "Vai trò", "Phạm vi dữ liệu", "Danh sách đơn vị"]) if (await menuHas(x)) seen.push(x);
    check(G, "Admin thấy đủ mục quản trị", "4 mục", seen.join(", "), seen.length === 4);
    const e5 = errs.filter((e) => /HTTP 5|pageerror|dialog/.test(e));
    check(G, "Không có 5xx / pageerror / dialog", "0", e5.join(" ; ") || "0", e5.length === 0);
  });
});
