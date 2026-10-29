// Gọi thẳng REST của backend để dựng dữ liệu mà một spec CẦN nhưng không phải thứ nó
// kiểm (vd. luồng duyệt cần một phiếu đã nộp). Phần được kiểm luôn đi qua giao diện.
import { request, type APIRequestContext } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:8090/api";

/** Tài khoản dev seed ở 005-seed-security.sql (admin) và 167-seed-asxh-dev-accounts.sql. */
export const ACCOUNTS = {
  admin: { username: "admin", password: "Admin@123" },
  donviBienHoa: { username: "donvi.bienhoa", password: "User@123" }, // UBND phường Trấn Biên
  donviBuuLong: { username: "donvi.buulong", password: "User@123" }, // UBND phường Bửu Long
  soDuyet: { username: "so.duyet", password: "User@123" },
  soDieuHanh: { username: "so.dieuhanh", password: "User@123" },
  soTongHop: { username: "so.tonghop", password: "User@123" },
  ubndDuyet: { username: "ubnd.duyet", password: "User@123" },
} as const;
export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

/** Mã quan hệ ngân sách của hai đơn vị có tài khoản dev (seed 101 / 167). */
export const UNIT_TRAN_BIEN = "1051101";
export const UNIT_BUU_LONG = "1051102";
/** Biểu chi tiết 1a (BM-000001): dòng 6 = chỉ tiêu đầu tiên, cột 2 số người, cột 4 kinh phí. */
export const TEMPLATE_1A = "BM-000001";

export class Api {
  private constructor(
    private readonly ctx: APIRequestContext,
    readonly account: Account
  ) {}

  static async as(account: Account): Promise<Api> {
    const anon = await request.newContext();
    const res = await anon.post(`${API_URL}/auth/login`, { data: account });
    if (!res.ok()) throw new Error(`Đăng nhập ${account.username} lỗi ${res.status()}: ${await res.text()}`);
    const { accessToken } = (await res.json()) as { accessToken: string };
    await anon.dispose();
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });
    return new Api(ctx, account);
  }

  async dispose() {
    await this.ctx.dispose();
  }

  private async call<T>(method: "get" | "post" | "put" | "patch" | "delete", path: string, data?: unknown): Promise<T> {
    const res = await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data });
    const text = await res.text();
    if (!res.ok()) {
      throw new Error(`${method.toUpperCase()} ${path} (${this.account.username}) → ${res.status()}: ${text}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T>(path: string) {
    return this.call<T>("get", path);
  }
  post<T>(path: string, data: unknown = {}) {
    return this.call<T>("post", path, data);
  }
  put<T>(path: string, data: unknown) {
    return this.call<T>("put", path, data);
  }

  /** Tải file multipart (đính kèm xác nhận Kho bạc). */
  async upload<T>(path: string, field: string, file: { name: string; mimeType: string; buffer: Buffer }): Promise<T> {
    const res = await this.ctx.post(`${API_URL}${path}`, { multipart: { [field]: file } });
    const text = await res.text();
    if (!res.ok()) throw new Error(`UPLOAD ${path} → ${res.status()}: ${text}`);
    return JSON.parse(text) as T;
  }
}

export type Period = { id: number; code: string; name: string; status: string; year: number };
export type Unit = { id: number; budgetCode: string; name: string };
export type Template = { id: number; code: string; shortName: string };
export type InputReport = { id: number; status: string; unit: { id: number; name: string } };
export type Sheet = { id: number; completion: string; version: number; dataJson?: string | null };

export async function unitByCode(api: Api, budgetCode: string): Promise<Unit> {
  const rows = await api.get<Unit[]>(`/report_units?budgetCode=${budgetCode}`);
  const unit = rows.find((u) => u.budgetCode === budgetCode);
  if (!unit) throw new Error(`Không thấy đơn vị ${budgetCode}`);
  return unit;
}

export async function templateByCode(api: Api, code: string): Promise<Template> {
  const rows = await api.get<Template[]>(`/templates?_start=0&_end=100`);
  const template = rows.find((t) => t.code === code);
  if (!template) throw new Error(`Không thấy biểu ${code}`);
  return template;
}

/** Tạo lịch năm (sinh kỳ Tháng + Quý + 6 tháng mặc định) và trả kỳ theo mã (T1, Q1…). */
export async function createCalendar(api: Api, year: number) {
  await api.post(`/report_calendars`, { year });
}

export async function periodByCode(api: Api, year: number, code: string): Promise<Period> {
  const rows = await api.get<Period[]>(`/report_periods?year=${year}&code=${encodeURIComponent(code)}`);
  const period = rows.find((p) => p.code === code && p.year === year);
  if (!period) throw new Error(`Không thấy kỳ ${code}/${year}`);
  return period;
}

/** Gán (đơn vị × biểu) cho kỳ rồi mở đợt — kỳ sang Đang mở, mỗi đơn vị nhận một phiếu. */
export async function setupAndOpen(api: Api, periodId: number, cells: { unitId: number; templateId: number }[]) {
  await api.put(`/period_assignments/matrix`, { periodId, add: cells, remove: [] });
  await api.post(`/report_periods/${periodId}/publish`);
}

export async function reportOf(api: Api, periodId: number, unitId: number): Promise<InputReport> {
  const rows = await api.get<InputReport[]>(`/input_reports?period.id=${periodId}`);
  // Trả lại sinh phiên bản mới; phiếu "sống" là bản không bị SUPERSEDED.
  const report = rows.find((r) => r.unit.id === unitId && r.status !== "SUPERSEDED");
  if (!report) throw new Error(`Không thấy phiếu của đơn vị ${unitId} trong kỳ ${periodId}`);
  return report;
}

export async function sheetsOf(api: Api, reportId: number): Promise<Sheet[]> {
  return api.get<Sheet[]>(`/input_report_sheets?report.id=${reportId}`);
}

/** PDF tối thiểu hợp lệ (máy chủ kiểm chữ ký đầu file theo đuôi). */
export function tinyPdf(name = "xac-nhan-kho-bac.pdf") {
  const body = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
  return { name, mimeType: "application/pdf", buffer: Buffer.from(body, "latin1") };
}

/** Đính kèm xác nhận Kho bạc + tích xác nhận (điều kiện nộp phiếu, BR-38.1). */
export async function attachTreasury(api: Api, reportId: number) {
  await api.upload(`/input_reports/${reportId}/attachments`, "file", tinyPdf());
  await api.put(`/input_reports/${reportId}/treasury_confirmation`, { confirmed: true });
}

type WorkbookJson = {
  sheets: Record<string, { data?: { dataTable?: Record<string, Record<string, { value?: unknown }>> } }>;
};

/**
 * Nhập số qua API (chỉ để DỰNG dữ liệu cho spec khác): lấy khung mẫu đã ghim của tờ biểu,
 * ghi giá trị vào ô (giữ nguyên định dạng ô), lưu rồi "Kiểm tra & hoàn tất". Máy chủ chạy
 * hook validate + getInputData trên chính JSON này khi hoàn tất / duyệt — như bản lưu từ
 * giao diện.
 */
export async function fillAndCompleteSheet(
  api: Api,
  sheetId: number,
  sheetName: string,
  cells: { row: number; col: number; value: number }[]
) {
  const detail = await api.get<Sheet & { templateWorkbookJson: string }>(`/input_report_sheets/${sheetId}`);
  const workbook = JSON.parse(detail.dataJson || detail.templateWorkbookJson) as WorkbookJson;
  const sheet = workbook.sheets[sheetName];
  if (!sheet?.data?.dataTable) throw new Error(`Khung mẫu không có sheet ${sheetName}`);
  const table = sheet.data.dataTable;
  for (const { row, col, value } of cells) {
    table[row] ??= {};
    table[row][col] = { ...(table[row][col] ?? {}), value };
  }
  await api.put(`/input_report_sheets/${sheetId}`, { dataJson: JSON.stringify(workbook), version: detail.version });
  await api.post(`/input_report_sheets/${sheetId}/complete`);
}

/** Đơn vị làm trọn phần của mình qua API: nhập biểu 1a, hoàn tất, đính kèm Kho bạc, nộp. */
export async function unitSubmitsViaApi(unit: Api, reportId: number, quantity: number, amount: number) {
  for (const sheet of await sheetsOf(unit, reportId)) {
    await fillAndCompleteSheet(unit, sheet.id, "1a", [
      { row: 6, col: 2, value: quantity },
      { row: 6, col: 4, value: amount },
    ]);
  }
  await attachTreasury(unit, reportId);
  await unit.post(`/input_reports/${reportId}/submit`);
}
