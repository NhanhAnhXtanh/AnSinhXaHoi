/**
 * Khai báo kiểu nạp vào Monaco (`addExtraLib`) để ô soạn quy tắc gợi ý được
 * `ctx.cell.get`, `ctx.rows.clone`… và báo sai tên hàm ngay khi gõ.
 *
 * Đây là BẢN CHIẾU của hợp đồng thật ở `../script/types.ts` (ScriptContext,
 * ScriptHooks) — đổi facade `ctx` thì sửa cả hai nơi. Chép theo bản Jmix
 * (`quyettoan/designer-app/script-editor/scriptApiDts.ts`), thêm các hàm bản
 * React có mà bản Jmix chưa có (`cell.lockAll`, `rows.setDropdown`…).
 *
 * Chỉ được import từ chunk nạp động của ô soạn (`./script-editor-impl.tsx`).
 */
export const SCRIPT_API_DTS = `
declare interface TempTableRow {
  /** Có thể để '' ở màn nhập liệu — máy chủ luôn gán đơn vị của phiếu khi ghi sổ. */
  organizationCode: string;
  /** Có thể để '' — như organizationCode. */
  organizationName: string;
  indicatorCode: string;
  indicatorName: string;
  quantity: number | null;
  amount: number | null;
  /** Cột 7 — ghi chú theo dòng chỉ tiêu (tuỳ chọn). */
  note?: string | null;
  orderNo?: number | null;
}

/** Dòng tổng hợp có thêm số cộng, số lớn nhất và số kỳ con; chỉ có ở ctx.shared.summaryRows. */
declare interface SummaryRow extends TempTableRow {
  quantitySum: number | null;
  quantityMax: number | null;
  measureKind: string;
  periodCount: number;
}

declare interface SummaryDataRow {
  /** Rỗng = dòng gộp các đơn vị. */
  organizationCode?: string;
  indicatorCode: string;
  indicatorName: string;
  /** Rỗng = cả kỳ; phiếu năm: 'HK1' | 'HK2' | 'YEAR'. */
  slot?: '' | 'ALL' | 'HK1' | 'HK2' | 'YEAR';
  quantity?: number | null;
  amount?: number | null;
  /** "Kinh phí đã bố trí trong dự toán NSĐP" — chỉ Sở nhập. */
  allocatedAmount?: number | null;
  note?: string | null;
  orderNo?: number | null;
}

declare interface ValidationIssue {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  businessKey?: string;
  tableRowIndex?: number;
  field?: 'quantity' | 'amount';
  source?: { sheetName: string; row: number; column: number };
}

declare interface CellRef { sheetName: string; row: number; col: number; }
declare interface RangeRef extends CellRef { rowCount: number; colCount: number; }

declare interface ScriptContext {
  /**
   * 'designer' (chạy thử ở màn thiết kế) | 'input' (nhập liệu, xem phiếu)
   * | 'summary' (tổng hợp, chỉ xem) | 'summary-edit' (Sở sửa số tổng hợp).
   */
  readonly mode: 'designer' | 'input' | 'summary' | 'summary-edit';
  /** Phiếu đang mở — null ở màn thiết kế và tổng hợp. */
  readonly report: {
    readonly reportId: string;
    readonly sheetCode: string;
    readonly status: string;
    readonly organizationCode: string;
  } | null;
  /**
   * Vùng nhớ CHUNG giữa mọi script của cùng một lần mở bảng tính.
   * Ở tổng hợp, màn đặt sẵn: shared.rows (TempTableRow[]), shared.summaryRows (SummaryRow[]),
   * shared.periodId, shared.sheetCode, shared.scopeKind, shared.summaryDataUrl…
   */
  readonly shared: Record<string, any>;
  readonly cell: {
    /** Dòng, cột đếm từ 0. */
    get(sheetName: string, row: number, col: number): unknown;
    /** Từ chối ghi đè ô có công thức — công thức thuộc về mẫu. */
    set(sheetName: string, row: number, col: number, value: unknown): void;
    getFormula(sheetName: string, row: number, col: number): string;
    lock(sheetName: string, row: number, col: number, locked: boolean): void;
    /** Khoá / mở khoá mọi ô của sheet. */
    lockAll(sheetName: string, locked: boolean): void;
  };
  /** Thao tác dòng — cho biểu tổng hợp theo từng đơn vị tự co giãn số dòng. */
  readonly rows: {
    /** Nhân bản count dòng từ templateRow (đếm từ 0) ngay dưới nó: chép định dạng + công thức, KHÔNG chép số. */
    clone(sheetName: string, templateRow: number, count: number): void;
    /** Ô chọn từ danh sách cho rowCount dòng của cột col, bắt đầu từ firstRow. */
    setDropdown(
      sheetName: string,
      col: number,
      firstRow: number,
      rowCount: number,
      items: { text: string; value: string }[]
    ): void;
    /** Nút "thêm dòng" trong ô. */
    addRowButton(
      sheetName: string,
      row: number,
      col: number,
      caption: string,
      onClick: (clickedRow: number, clickedCol: number) => void
    ): void;
    /** Nhiều nút trong một ô (ví dụ ＋ / ✕ thêm, xoá dòng). */
    setRowButtons(
      sheetName: string,
      row: number,
      col: number,
      buttons: { caption: string; onClick: (clickedRow: number, clickedCol: number) => void }[]
    ): void;
    deleteRow(sheetName: string, row: number): void;
  };
  /** Gọi máy chủ: đường dẫn '/api/…' (hoặc '/rest/qt/…' của script cũ). Chỉ GET/POST/PUT/PATCH. */
  readonly api: {
    fetch(path: string, init?: RequestInit): Promise<unknown>;
    get(path: string): Promise<unknown>;
    post(path: string, body?: unknown): Promise<unknown>;
    /** Như post — đẩy dữ liệu nghiệp vụ. */
    push(path: string, body?: unknown): Promise<unknown>;
    put(path: string, body?: unknown): Promise<unknown>;
    patch(path: string, body?: unknown): Promise<unknown>;
  };
  /** Hiện một dòng thông báo (ở màn thiết kế: vào Nhật ký chạy thử). */
  readonly ui: { message(text: string): void };
  /** Xuất dữ liệu ra tệp tải về (JSON/văn bản) để xem, đối soát. */
  readonly export: { download(filename: string, data: unknown): void };
  readonly issues: { add(issue: ValidationIssue): void };
}

declare interface ScriptHooks {
  /** Sau khi bảng tính nạp xong và số đã đổ. Được phép async. */
  onLoad?(ctx: ScriptContext): void | Promise<void>;
  /** return false = chặn sửa ô. PHẢI đồng bộ, phải nhanh. */
  beforeEdit?(ctx: ScriptContext, cell: CellRef): boolean | void;
  /** return false = huỷ giá trị vừa gõ (newValue là chữ đang nhập). Đồng bộ. */
  beforeCommit?(ctx: ScriptContext, cell: CellRef, newValue: unknown): boolean | void;
  /** return false = chặn dán vào vùng. Đồng bộ. */
  beforePaste?(ctx: ScriptContext, range: RangeRef): boolean | void;
  /** Sau khi số liệu tổng hợp được đổ vào bảng tính. Được phép async. */
  afterInject?(ctx: ScriptContext): void | Promise<void>;
  /** Biến đổi các dòng trước khi gửi máy chủ. */
  beforeExtract?(ctx: ScriptContext, rows: TempTableRow[]): TempTableRow[] | void | Promise<TempTableRow[] | void>;
  /** Quy tắc nghiệp vụ; lỗi mức ERROR chặn NỘP phiếu. */
  validate?(ctx: ScriptContext, rows: TempTableRow[]): ValidationIssue[] | void | Promise<ValidationIssue[] | void>;
  /**
   * Lấy số liệu để ghi SỔ CÁI khi Sở DUYỆT phiếu (chạy trên máy chủ). Chỉ đọc ô
   * (ctx.cell.get) và TRẢ VỀ mảng dòng 7 cột.
   */
  getInputData?(ctx: ScriptContext): TempTableRow[] | Promise<TempTableRow[]>;
  /** Lấy số Sở chốt trên tổng hợp để ghi sổ cái Sở (chạy trên máy chủ). Chỉ đọc ô. */
  getSummaryData?(ctx: ScriptContext): SummaryDataRow[] | Promise<SummaryDataRow[]>;
}

/** Script phải kết thúc bằng \`return defineScript({...})\`. */
declare function defineScript(hooks: ScriptHooks): ScriptHooks;
`;
