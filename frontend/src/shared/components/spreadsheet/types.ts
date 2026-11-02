// Kiểu công khai của bộ bảng tính (SpreadJS). File này KHÔNG được import gì từ
// `@mescius/*` — nó nằm trong bundle chính, còn SpreadJS chỉ tải khi màn có bảng
// tính thật sự mở (xem `lazy.tsx`).

/** JSON SpreadJS của một workbook (`workbook.toJSON()`). */
export type WorkbookJson = Record<string, unknown>;

export type SpreadWorkbookApi = {
  /** JSON workbook hiện tại — đã bỏ sheet "Evaluation Version" của bản dùng thử. */
  toJSON(): WorkbookJson;
  /** Tên các sheet theo thứ tự tab (không gồm sheet kỹ thuật/bản dùng thử). */
  getSheetNames(): string[];
  setActiveSheet(name: string): void;
  /** Tải file .xlsx về máy (hàng tab luôn hiện trong file xuất). */
  exportXlsx(fileName: string): Promise<void>;
  /** Nạp .xlsx/.ssjson/.json vào workbook (thay toàn bộ nội dung). */
  importFile(file: File): Promise<void>;
  getCellValue(sheet: string, row: number, col: number): unknown;
  /**
   * Tô đỏ các ô số liệu sai (thay lần tô trước) và đưa con trỏ tới ô đầu tiên. Dấu tô
   * không vào số liệu lưu / xuất Excel và tự gỡ khỏi ô ngay khi người dùng sửa ô đó.
   */
  markInvalidCells(cells: WorkbookCellRef[]): void;
  /** Gỡ mọi dấu tô của `markInvalidCells`. */
  clearInvalidCells(): void;
  /** GC.Spread.Sheets.Workbook — chỉ dùng khi thật cần. */
  raw(): unknown;
};

/** Một ô của bảng tính, theo tên sheet (tab) và chỉ số dòng / cột tính từ 0. */
export type WorkbookCellRef = { sheetName: string; row: number; column: number };

/**
 * Kết quả chạy script phía trình duyệt. `ok` = không có lỗi mức ERROR.
 * `cells`: các ô mà lỗi mức ERROR chỉ ra (script ghi `source` cho lỗi) — để tô đỏ.
 */
export type ScriptRunResult = { ok: boolean; messages: string[]; cells?: WorkbookCellRef[] };

export type SpreadWorkbookProps = {
  /** null → workbook trống 1 sheet. Đổi NỘI DUNG (không chỉ tham chiếu) mới nạp lại. */
  workbook: WorkbookJson | null;
  /** Khoá cả workbook (xem phiếu, duyệt): không sửa được, vẫn chọn/copy được. */
  readOnly?: boolean;
  /** Ẩn hàng tab sheet của SpreadJS (màn tự vẽ SheetTabs). */
  hideTabs?: boolean;
  /** Tên sheet đang mở. */
  activeSheet?: string;
  /** Script phiên bản mẫu; chạy hook onLoad (và afterInject ở chế độ tổng hợp) như bản Jmix. */
  scriptText?: string | null;
  /**
   * Dữ liệu cho script, đặt vào `ctx.shared` (vd `{ unitName, periodName, year }`).
   * `unitName` được nhân thêm thành `orgName` cho script cũ. Khoá đặc biệt:
   * `mode` ("input" | "summary" | "summary-edit" | "designer", mặc định "input"):
   * chế độ tổng hợp sẽ chạy thêm `afterInject` sau `onLoad`.
   */
  scriptContext?: Record<string, unknown>;
  /** Bắn `true` mỗi lần người dùng sửa (gõ ô, dán, thêm/xoá dòng…); `false` sau mỗi lần nạp. */
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (api: SpreadWorkbookApi) => void;
  /** Khung tự giãn hết chiều cao cha (h-full). */
  className?: string;
  /**
   * (Mở rộng ngoài hợp đồng) true khi `workbook` là KHUNG MẪU chưa có nháp: ô có
   * chữ/công thức bị khoá, ô trống mở để nhập. Đừng bật với bản nháp — ô người
   * dùng đã gõ sẽ bị khoá lại. Bỏ qua khi script có hook `beforeEdit`.
   */
  stampInputLocks?: boolean;
  /** (Mở rộng ngoài hợp đồng) Kết quả onLoad/afterInject của script (lỗi script, ctx.ui.message). */
  onScriptResult?: (result: ScriptRunResult) => void;
  /**
   * (Mở rộng ngoài hợp đồng) Bảng tính chạy ngầm, không ai nhìn (vd chạy lại bước kiểm
   * tra trước khi nộp): nạp ĐỒNG BỘ toàn bộ workbook và KHÔNG BAO GIỜ vẽ lên canvas.
   * Script vẫn đọc được mọi ô như bình thường. Mặc định false.
   */
  offscreen?: boolean;
};

export type SpreadDesignerProps = {
  workbook: WorkbookJson | null;
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (api: SpreadWorkbookApi) => void;
  className?: string;
  /** (Mở rộng ngoài hợp đồng) Cho thêm/xoá/đổi tên/kéo tab sheet. Mặc định true. */
  sheetStructureEditable?: boolean;
};

/** Một biểu để gộp vào file Excel nhiều tab (xem `exportWorkbooksToXlsx`). */
export type ExportSheetSource = {
  /** Mã biểu — chỉ dùng làm tên tab dự phòng khi thiếu `sheetName`. */
  sheetCode: string;
  /** Tên biểu — làm tên tab trong file Excel. */
  sheetName?: string;
  workbookJson: unknown;
};
