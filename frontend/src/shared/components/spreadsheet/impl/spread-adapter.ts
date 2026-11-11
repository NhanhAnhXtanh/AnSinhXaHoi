import * as GC from "@mescius/spread-sheets";

import type { ScriptWorkbookAdapter } from "../script/types";
import { CELL_BUTTON_ICON_SIZE, resolveCellButtonIcon } from "./cell-button-icons";

/**
 * Lớp bọc workbook SpreadJS — bê và rút gọn từ bản Jmix
 * (core/spread/SpreadJsWorkbookFactory.ts `wrapSpreadWorkbook`). Chỉ giữ những gì
 * bảng tính + script cần; thao tác "table" của SpreadJS không dùng nữa.
 */

export type CellEvent = { sheetName: string; row: number; col: number };
export type RangeEvent = CellEvent & { rowCount: number; colCount: number };
export type SheetVisibility = "visible" | "hidden" | "veryHidden";

export interface SpreadAdapter extends ScriptWorkbookAdapter {
  readonly workbook: GC.Spread.Sheets.Workbook;
  setAllCellsLocked(sheetIndex: number, locked: boolean): void;
  getSheetCount(): number;
  getSheetName(sheetIndex: number): string;
  getSheetVisibility(sheetIndex: number): SheetVisibility;
  setSheetVisibility(sheetIndex: number, visibility: SheetVisibility): void;
  setSheetProtected(sheetIndex: number, value: boolean): void;
  setActiveSheet(sheetIndex: number): void;
  resetView(sheetIndex: number): void;
  clearCellButtons(sheetIndex: number): void;
  /**
   * Chế độ chỉ xem: mọi ô khoá và không còn nút trong ô — kết quả từng ô như
   * `setAllCellsLocked(i, true)` + `clearCellButtons(i)`, nhưng chỉ ghi vào ô thật sự
   * cần đổi (xem chú thích trong thân hàm).
   */
  lockForViewing(sheetIndex: number): void;
  /**
   * Khoá cấu trúc tab (ẩn nút "+", chặn đổi tên/kéo tab) và đặt hiện/ẩn hàng tab.
   * Gọi lại sau mỗi fromJSON/import vì JSON có thể khôi phục option tab đã lưu.
   */
  setTabOptions(options: { structureEditable: boolean; tabStripVisible?: boolean }): void;
  fromJSON(json: unknown, options?: { incremental?: boolean }): Promise<void>;
  importFile(file: File): Promise<void>;
  exportBlob(): Promise<Blob>;
  suspendPaint(): void;
  resumePaint(): void;
  refresh(): void;
  onBeforeEdit(guard: (cell: CellEvent) => boolean | void): () => void;
  onBeforeCommit(guard: (cell: CellEvent, newValue: unknown) => boolean | void): () => void;
  /** Guard cho mọi thao tác ghi cả vùng: dán, kéo điền (núm góc ô), kéo thả khối ô. */
  onBeforePaste(guard: (range: RangeEvent) => boolean | void): () => void;
  /** Chặn mọi thao tác sửa (gõ, dán, kéo thả, kéo điền) — màn chỉ xem. */
  blockAllEdits(): () => void;
  /** Bắn khi người dùng sửa workbook (gõ ô, dán, thêm/xoá dòng, đổi định dạng…). */
  subscribeWorkbookChanged(listener: () => void): () => void;
  /** Tô đỏ các ô (thay lần tô trước), đưa con trỏ tới ô đầu tiên; không tính là người dùng sửa. */
  markCells(cells: { sheetIndex: number; row: number; col: number }[]): void;
  /** Gỡ mọi dấu tô của `markCells`. */
  clearMarks(): void;
  /** Chạy `fn` khi tạm gỡ dấu tô — để dấu tô không vào số liệu lưu / xuất. */
  withoutMarks<T>(fn: () => T): T;
  /** Huỷ workbook; `onDestroyed` chạy khi đã huỷ thật (có thể trễ nếu đang nạp dở). */
  destroy(onDestroyed?: () => void): void;
}

export type SpreadAdapterOptions = {
  /** Workbook do adapter sở hữu (huỷ khi destroy) — false với workbook của Designer. */
  destroyWorkbook: boolean;
  /** Gọi sau khi người dùng bấm nút trong ô (script thêm/xoá dòng) — để bật cờ đã sửa. */
  onCellCommand?: () => void;
};

/** Màu tô ô số liệu sai (vẽ trên canvas nên cần mã màu; cùng tông với màu báo lỗi của giao diện). */
const MARK_FILL = "#FDECEC";
const MARK_LINE = "#DC2626";

/** Bề ngang mỗi nút để CẢ CỤM phủ kín ô (chừa 4px) — SpreadJS không có căn giữa. */
function cellButtonWidth(sheet: GC.Spread.Sheets.Worksheet, col: number, count: number): number | null {
  if (count <= 0 || typeof sheet.getColumnWidth !== "function") return null;
  const cellWidth = Number(sheet.getColumnWidth(col));
  if (!Number.isFinite(cellWidth) || cellWidth <= 0) return null;
  const perButton = Math.floor((cellWidth - 4) / count);
  return perButton >= 16 ? perButton : null;
}

function visibilityValue(visibility: SheetVisibility): GC.Spread.Sheets.SheetTabVisible {
  if (visibility === "veryHidden") return GC.Spread.Sheets.SheetTabVisible.veryHidden;
  if (visibility === "hidden") return GC.Spread.Sheets.SheetTabVisible.hidden;
  return GC.Spread.Sheets.SheetTabVisible.visible;
}

function visibilityName(visibility: GC.Spread.Sheets.SheetTabVisible): SheetVisibility {
  if (visibility === GC.Spread.Sheets.SheetTabVisible.veryHidden) return "veryHidden";
  if (visibility === GC.Spread.Sheets.SheetTabVisible.hidden) return "hidden";
  return "visible";
}

/**
 * Văn bản clipboard (Excel / bảng tính khác: cột cách bằng tab, dòng cách bằng xuống dòng; ô có
 * xuống dòng hoặc tab được bọc nháy kép, nháy kép bên trong viết đôi) → lưới ô. Bỏ dòng trống cuối.
 */
export function parseClipboardText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function fileTypeOf(file: File): GC.Spread.Sheets.FileType | "json" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ssjson")) return GC.Spread.Sheets.FileType.ssjson;
  if (name.endsWith(".json")) return "json";
  return GC.Spread.Sheets.FileType.excel;
}

const PASTE_ALLOWED_COMMAND = "asxh.pasteAllowedCells";
const REDO_SHIFT_COMMAND = "asxh.redoCtrlShiftZ";

type PasteWrite = { sheetName: string; row: number; col: number; text?: string; value?: unknown };
type PasteAllowedOptions = { cmd: string; sheetName: string; writes: PasteWrite[] };

export function wrapSpreadWorkbook(
  workbook: GC.Spread.Sheets.Workbook,
  options: SpreadAdapterOptions
): SpreadAdapter {
  let destroyed = false;
  // Lần nạp incremental đang chạy: SpreadJS còn tác vụ hẹn giờ trên workbook, huỷ
  // giữa chừng làm tác vụ đó đọc vào workbook đã huỷ ("reading 'clear'"). Huỷ thật
  // được hoãn tới khi lần nạp xong (gặp khi React gắn lại component, đổi biểu nhanh).
  let pendingLoad: Promise<void> | null = null;

  // Dấu tô ô sai (markCells): style gốc của từng ô để trả lại. Trong lúc tô / gỡ, sự kiện
  // đổi ô không được tính là người dùng sửa (muted).
  let muted = 0;
  const marks = new Map<string, { sheetIndex: number; row: number; col: number; original: unknown }>();
  let unbindMarkWatch: (() => void) | null = null;
  const markKey = (sheetIndex: number, row: number, col: number) => `${sheetIndex}:${row}:${col}`;

  // Làm lại: Ctrl+Shift+Z (thói quen của nhiều phần mềm) cùng với Ctrl+Y sẵn có; Ctrl+Z là hoàn tác.
  // Lệnh riêng gắn phím: setShortcutKey("redo", …) sẽ THAY phím Ctrl+Y của lệnh redo gốc.
  workbook.commandManager().register(
    REDO_SHIFT_COMMAND,
    {
      canUndo: false,
      execute(context: GC.Spread.Sheets.Workbook) {
        context.undoManager().redo();
        return true;
      },
    },
    GC.Spread.Commands.Key.z,
    true,
    true,
    false,
    false
  );
  // Dán MỘT PHẦN (vùng dán lẫn ô khoá — xem onBeforePaste): một lệnh có hoàn tác, để Ctrl+Z trả mọi ô
  // vừa ghi về giá trị cũ trong một bước và Ctrl+Shift+Z / Ctrl+Y làm lại được.
  workbook.commandManager().register(PASTE_ALLOWED_COMMAND, {
    canUndo: true,
    execute(context: GC.Spread.Sheets.Workbook, opts: PasteAllowedOptions, isUndo: boolean) {
      const Commands = GC.Spread.Sheets.Commands;
      if (isUndo) {
        Commands.undoTransaction(context, opts);
        return true;
      }
      Commands.startTransaction(context, opts);
      context.suspendPaint();
      try {
        for (const write of opts.writes) {
          const sheet = context.getSheetFromName(write.sheetName);
          if (!sheet) continue;
          if (write.text !== undefined) sheet.setText(write.row, write.col, write.text);
          else sheet.setValue(write.row, write.col, write.value ?? null);
        }
      } finally {
        context.resumePaint();
      }
      Commands.endTransaction(context, opts);
      return true;
    },
  });

  function muteChanges(fn: () => void): void {
    muted += 1;
    try {
      fn();
    } finally {
      muted -= 1;
    }
  }

  function restoreMark(key: string): void {
    const mark = marks.get(key);
    if (!mark) return;
    marks.delete(key);
    const sheet = workbook.getSheet(mark.sheetIndex);
    if (sheet) sheet.setStyle(mark.row, mark.col, mark.original as GC.Spread.Sheets.Style);
  }

  function paintMark(mark: { sheetIndex: number; row: number; col: number }): void {
    const sheet = workbook.getSheet(mark.sheetIndex);
    if (!sheet) return;
    const original = sheet.getStyle(mark.row, mark.col);
    const style = original ? original.clone() : new GC.Spread.Sheets.Style();
    style.backColor = MARK_FILL;
    const line = new GC.Spread.Sheets.LineBorder(MARK_LINE, GC.Spread.Sheets.LineStyle.medium);
    style.borderLeft = line;
    style.borderRight = line;
    style.borderTop = line;
    style.borderBottom = line;
    sheet.setStyle(mark.row, mark.col, style);
    marks.set(markKey(mark.sheetIndex, mark.row, mark.col), { ...mark, original: original ?? null });
  }

  function assertNotDestroyed(): void {
    if (destroyed) throw new Error("Bảng tính đã đóng.");
  }

  function sheetAt(sheetIndex: number): GC.Spread.Sheets.Worksheet {
    assertNotDestroyed();
    const sheet = workbook.getSheet(sheetIndex);
    if (!sheet) throw new Error(`Không có sheet thứ ${sheetIndex + 1}.`);
    return sheet;
  }

  // Sheet nhập liệu bị PROTECTED → addRows/deleteRows/copyTo (thao tác CẤU TRÚC) bị
  // chặn, nút "＋/✕" của script "không ăn". Tạm bỏ protect quanh thao tác rồi bật lại.
  function withRowStructureAllowed(sheet: GC.Spread.Sheets.Worksheet, fn: () => void): void {
    const wasProtected = Boolean(sheet.options.isProtected);
    if (wasProtected) sheet.options.isProtected = false;
    try {
      fn();
    } finally {
      if (wasProtected) sheet.options.isProtected = true;
    }
  }

  // SpreadJS trả `null` (không phải -1) cho tên sheet không có; `null >= 0` là true
  // trong JS nên phải chuẩn hoá về -1 ở đúng một chỗ.
  function sheetIndexByName(sheetName: string): number {
    const index = workbook.getSheetIndex(sheetName);
    return index == null || index < 0 ? -1 : index;
  }

  function buildCellButtons(
    sheet: GC.Spread.Sheets.Worksheet,
    col: number,
    buttons: { caption: string; command: (clickedRow: number, clickedCol: number) => void }[]
  ): GC.Spread.Sheets.ICellButton[] {
    const width = cellButtonWidth(sheet, col, buttons.length);
    return buttons.map((button) => {
      const icon = resolveCellButtonIcon(button.caption);
      const config: GC.Spread.Sheets.ICellButton = {
        caption: icon.caption,
        useButtonStyle: true,
        position: GC.Spread.Sheets.ButtonPosition.left,
        visibility: GC.Spread.Sheets.ButtonVisibility.always,
        command: (_s: GC.Spread.Sheets.Worksheet, r: number, c: number) => {
          button.command(r, c);
          options.onCellCommand?.();
        },
      };
      if (icon.imageSrc) {
        config.imageType = GC.Spread.Sheets.ButtonImageType.custom;
        config.imageSrc = icon.imageSrc;
        config.imageSize = { width: CELL_BUTTON_ICON_SIZE, height: CELL_BUTTON_ICON_SIZE };
      }
      if (width != null) config.width = width;
      return config;
    });
  }

  return {
    workbook,
    getValue(sheetIndex, row, col) {
      return sheetAt(sheetIndex).getValue(row, col);
    },
    setValue(sheetIndex, row, col, value) {
      sheetAt(sheetIndex).setValue(row, col, value);
    },
    getFormula(sheetIndex, row, col) {
      const formula = sheetAt(sheetIndex).getFormula(row, col) ?? "";
      // SpreadJS trả công thức không có "=" đầu; hợp đồng script dùng cú pháp Excel.
      return formula && !formula.startsWith("=") ? `=${formula}` : formula;
    },
    getSheetCount() {
      assertNotDestroyed();
      return workbook.getSheetCount();
    },
    getSheetName(sheetIndex) {
      return sheetAt(sheetIndex).name();
    },
    getSheetIndex(sheetName) {
      assertNotDestroyed();
      return sheetIndexByName(sheetName);
    },
    getSheetVisibility(sheetIndex) {
      return visibilityName(sheetAt(sheetIndex).visible());
    },
    setSheetVisibility(sheetIndex, visibility) {
      sheetAt(sheetIndex).visible(visibilityValue(visibility));
    },
    setSheetProtected(sheetIndex, value) {
      sheetAt(sheetIndex).options.isProtected = value;
    },
    setActiveSheet(sheetIndex) {
      assertNotDestroyed();
      workbook.setActiveSheetIndex(sheetIndex);
    },
    resetView(sheetIndex) {
      const sheet = sheetAt(sheetIndex);
      // Ô đầu tiên NGOÀI vùng đóng băng — màn chỉ xem mở lên thấy đầu biểu.
      const firstRow = sheet.frozenRowCount();
      const firstCol = sheet.frozenColumnCount();
      sheet.setActiveCell(firstRow, firstCol);
      sheet.setSelection(firstRow, firstCol, 1, 1);
      sheet.showRow(firstRow, GC.Spread.Sheets.VerticalPosition.top);
      sheet.showColumn(firstCol, GC.Spread.Sheets.HorizontalPosition.left);
    },
    setTabOptions({ structureEditable, tabStripVisible }) {
      assertNotDestroyed();
      workbook.options.newTabVisible = structureEditable;
      workbook.options.tabEditable = structureEditable;
      workbook.options.allowSheetReorder = structureEditable;
      if (tabStripVisible !== undefined) workbook.options.tabStripVisible = tabStripVisible;
      workbook.refresh();
    },
    fromJSON(json, loadOptions) {
      assertNotDestroyed();
      const data = json as Parameters<typeof workbook.fromJSON>[0];
      // Workbook ẩn (xuất file) phải nạp ĐỒNG BỘ toàn bộ: incrementalLoading trên
      // workbook chưa vẽ có thể báo xong khi mới nạp sheet active → thiếu sheet.
      if (loadOptions?.incremental === false) {
        return Promise.resolve(workbook.fromJSON(data)).then(() => undefined);
      }
      // Workbook lớn nạp KHÔNG đồng bộ: chỉ resolve ở callback `loaded`.
      const load = new Promise<void>((resolve, reject) => {
        try {
          const pending = workbook.fromJSON(data, {
            incrementalLoading: { loaded: () => resolve() },
          });
          Promise.resolve(pending).catch(reject);
        } catch (error) {
          reject(error);
        }
      });
      pendingLoad = load;
      const settle = () => {
        if (pendingLoad === load) pendingLoad = null;
      };
      load.then(settle, settle);
      return load;
    },
    importFile(file) {
      assertNotDestroyed();
      const type = fileTypeOf(file);
      if (type === "json") {
        return file.text().then((text) => {
          const parsed = JSON.parse(text) as unknown;
          return Promise.resolve(
            workbook.fromJSON(parsed as Parameters<typeof workbook.fromJSON>[0])
          ).then(() => undefined);
        });
      }
      // Plugin IO (@mescius/spread-sheets-io): import THAY nội dung workbook tại chỗ.
      return new Promise<void>((resolve, reject) => {
        workbook.import(
          file,
          () => resolve(),
          (error: unknown) =>
            reject(error instanceof Error ? error : new Error(String(error))),
          { fileType: type }
        );
      });
    },
    exportBlob() {
      assertNotDestroyed();
      return new Promise<Blob>((resolve, reject) => {
        workbook.export(
          (blob: Blob) => resolve(blob),
          (error: unknown) =>
            reject(error instanceof Error ? error : new Error(String(error))),
          { fileType: GC.Spread.Sheets.FileType.excel }
        );
      });
    },
    suspendPaint() {
      assertNotDestroyed();
      workbook.suspendPaint();
    },
    resumePaint() {
      assertNotDestroyed();
      workbook.resumePaint();
    },
    refresh() {
      assertNotDestroyed();
      workbook.refresh();
    },
    deleteRow(sheetIndex, atRow) {
      const sheet = sheetAt(sheetIndex);
      withRowStructureAllowed(sheet, () => sheet.deleteRows(atRow, 1));
    },
    insertClonedRows(sheetIndex, templateRow, count) {
      if (count <= 0) return;
      const sheet = sheetAt(sheetIndex);
      // Chỉ style + công thức + ô gộp — KHÔNG value (không nhân bản số mẫu).
      const option = (GC.Spread.Sheets.CopyToOptions.style |
        GC.Spread.Sheets.CopyToOptions.formula |
        GC.Spread.Sheets.CopyToOptions.span) as GC.Spread.Sheets.CopyToOptions;
      const columnCount = sheet.getColumnCount();
      withRowStructureAllowed(sheet, () => {
        sheet.addRows(templateRow + 1, count);
        for (let i = 1; i <= count; i += 1) {
          sheet.copyTo(templateRow, 0, templateRow + i, 0, 1, columnCount, option);
        }
      });
    },
    setCellLocked(sheetIndex, row, col, locked) {
      sheetAt(sheetIndex).getCell(row, col).locked(locked);
    },
    setAllCellsLocked(sheetIndex, locked) {
      const sheet = sheetAt(sheetIndex);
      sheet.getRange(0, 0, sheet.getRowCount(), sheet.getColumnCount()).locked(locked);
    },
    onBeforeEdit(guard) {
      assertNotDestroyed();
      // Guard chạy ĐỒNG BỘ trong event handler: set args.cancel là cách duy nhất huỷ.
      const handler = (_: unknown, args: GC.Spread.Sheets.IEditStartingEventArgs) => {
        if (guard({ sheetName: args.sheetName, row: args.row, col: args.col }) === false) {
          args.cancel = true;
        }
      };
      workbook.bind(GC.Spread.Sheets.Events.EditStarting, handler);
      return () => workbook.unbind(GC.Spread.Sheets.Events.EditStarting, handler);
    },
    onBeforeCommit(guard) {
      assertNotDestroyed();
      const handler = (_: unknown, args: GC.Spread.Sheets.IEditEndingEventArgs) => {
        if (
          guard({ sheetName: args.sheetName, row: args.row, col: args.col }, args.editingText) ===
          false
        ) {
          args.cancel = true;
        }
      };
      workbook.bind(GC.Spread.Sheets.Events.EditEnding, handler);
      return () => workbook.unbind(GC.Spread.Sheets.Events.EditEnding, handler);
    },
    onBeforePaste(guard) {
      assertNotDestroyed();
      const cellAllowed = (sheetName: string, row: number, col: number) =>
        guard({ sheetName, row, col, rowCount: 1, colCount: 1 }) !== false;
      /**
       * Vùng dán lẫn ô không được sửa: KHÔNG huỷ cả lần dán — chỉ ghi GIÁ TRỊ vào từng ô được phép,
       * ô khoá giữ nguyên. Nguồn trong workbook đọc giá trị ô nguồn (giữ kiểu số); nguồn ngoài (Excel,
       * văn bản) đọc văn bản tab / xuống dòng. Vùng đích lớn hơn nguồn thì lặp lại nguồn như Excel.
       */
      const pasteAllowedCells = (args: GC.Spread.Sheets.IClipboardPastingEventArgs) => {
        const sheet = args.sheet;
        const range = args.cellRange;
        let rows: number;
        let cols: number;
        let read: (r: number, c: number) => { text?: string; value?: unknown };
        if (args.fromSheet && args.fromRange && args.fromRange.row >= 0 && args.fromRange.col >= 0) {
          const from = args.fromSheet;
          const fr = args.fromRange;
          rows = fr.rowCount;
          cols = fr.colCount;
          read = (r, c) => ({ value: from.getValue(fr.row + r, fr.col + c) });
        } else {
          const grid = parseClipboardText(args.pasteData?.text ?? "");
          rows = grid.length;
          cols = grid.reduce((max, line) => Math.max(max, line.length), 0);
          read = (r, c) => ({ text: grid[r]?.[c] ?? "" });
        }
        if (rows === 0 || cols === 0) return;
        const writes: PasteWrite[] = [];
        const written = new Set<string>();
        for (let r = 0; r < range.rowCount; r += 1) {
          for (let c = 0; c < range.colCount; c += 1) {
            const row = range.row + r;
            const col = range.col + c;
            if (!cellAllowed(args.sheetName, row, col)) continue;
            writes.push({ sheetName: args.sheetName, row, col, ...read(r % rows, c % cols) });
            written.add(row + ":" + col);
          }
        }
        // Cắt (Ctrl+X) trong cùng workbook: chỉ xoá ô nguồn được phép sửa, ô khoá ở nguồn giữ nguyên.
        if (args.isCutting && args.fromSheet && args.fromRange) {
          const fr = args.fromRange;
          const fromName = args.fromSheet.name();
          for (let r = 0; r < fr.rowCount; r += 1) {
            for (let c = 0; c < fr.colCount; c += 1) {
              const row = fr.row + r;
              const col = fr.col + c;
              const sameCell = args.fromSheet === sheet && written.has(row + ":" + col);
              if (!sameCell && cellAllowed(fromName, row, col)) {
                writes.push({ sheetName: fromName, row, col, value: null });
              }
            }
          }
        }
        if (writes.length === 0) return;
        // Chạy sau sự kiện dán (đã huỷ) để lệnh vào ngăn hoàn tác như một thao tác riêng của người dùng.
        setTimeout(() => {
          if (destroyed) return;
          workbook.commandManager().execute({ cmd: PASTE_ALLOWED_COMMAND, sheetName: sheet.name(), writes });
        }, 0);
      };
      const handler = (_: unknown, args: GC.Spread.Sheets.IClipboardPastingEventArgs) => {
        // Cắt (Ctrl+X) rồi dán trong cùng workbook: SpreadJS DI CHUYỂN ô — công thức đang trỏ vào ô
        // nguồn bị dời theo, công thức trỏ vào ô đích thành #REF! và được lưu luôn, phiếu không hoàn tất
        // được nữa. Luôn làm như "chép giá trị rồi xoá ô nguồn được phép sửa", không đụng công thức.
        if (args.isCutting && args.fromSheet && args.fromRange) {
          args.cancel = true;
          pasteAllowedCells(args);
          return;
        }
        const range = args.cellRange;
        const verdict = guard({
          sheetName: args.sheetName,
          row: range.row,
          col: range.col,
          rowCount: range.rowCount,
          colCount: range.colCount,
        });
        if (verdict !== false) return; // cả vùng được phép: dán bình thường (giữ định dạng như cũ)
        args.cancel = true;
        pasteAllowedCells(args);
      };
      // Kéo điền (núm góc ô) và kéo thả khối ô: để bảng tính kéo như Excel (chuỗi số, công thức, định
      // dạng) trên cả vùng, nhưng ô KHÔNG được sửa giữ nguyên — chụp lại trước khi kéo, trả về ngay sau
      // khi kéo xong. Kéo thả kiểu di chuyển còn xoá vùng nguồn nên ô khoá ở nguồn cũng được chụp lại.
      // Hoàn tác: Ctrl+Z trả cả vùng về trước khi kéo (ô khoá vẫn đúng giá trị cũ); làm lại chạy lại lệnh
      // kéo nên sự kiện "kéo xong" chạy lại và ô khoá lại được trả về.
      type Snapshot = { row: number; col: number; value: unknown; formula: string; style: GC.Spread.Sheets.Style | null };
      let pending: { sheet: GC.Spread.Sheets.Worksheet; cells: Snapshot[] } | null = null;
      const snapshotLocked = (
        sheet: GC.Spread.Sheets.Worksheet,
        areas: { row: number; col: number; rowCount: number; colCount: number }[]
      ): Snapshot[] => {
        const cells: Snapshot[] = [];
        const seen = new Set<string>();
        for (const area of areas) {
          for (let r = 0; r < area.rowCount; r += 1) {
            for (let c = 0; c < area.colCount; c += 1) {
              const row = area.row + r;
              const col = area.col + c;
              const key = row + ":" + col;
              if (seen.has(key) || cellAllowed(sheet.name(), row, col)) continue;
              seen.add(key);
              const style = sheet.getStyle(row, col);
              cells.push({
                row,
                col,
                value: sheet.getValue(row, col),
                formula: sheet.getFormula(row, col) || "",
                style: style ? style.clone() : null,
              });
            }
          }
        }
        return cells;
      };
      const restoreLocked = () => {
        const job = pending;
        pending = null;
        if (!job || job.cells.length === 0) return;
        job.sheet.suspendPaint();
        try {
          for (const cell of job.cells) {
            // null = ô không có style riêng (theo dòng / cột) — SpreadJS nhận null để gỡ style của ô.
            job.sheet.setStyle(cell.row, cell.col, cell.style as GC.Spread.Sheets.Style);
            if (cell.formula) job.sheet.setFormula(cell.row, cell.col, cell.formula);
            else job.sheet.setValue(cell.row, cell.col, cell.value ?? null);
          }
        } finally {
          job.sheet.resumePaint();
        }
      };
      const fillHandler = (_: unknown, args: GC.Spread.Sheets.IDragFillBlockEventArgs) => {
        const range = args.fillRange;
        pending = { sheet: args.sheet, cells: snapshotLocked(args.sheet, [range]) };
      };
      const dropHandler = (_: unknown, args: GC.Spread.Sheets.IDragDropBlockEventArgs) => {
        if (!args.copy) {
          // Kéo thả kiểu DI CHUYỂN dời công thức trỏ vào khối (như cắt–dán, ra #REF!): huỷ, chuyển
          // giá trị sang ô đích được phép sửa rồi xoá ô nguồn được phép sửa.
          args.cancel = true;
          moveAllowedValues(args);
          return;
        }
        const areas = [{ row: args.toRow, col: args.toCol, rowCount: args.rowCount, colCount: args.colCount }];
        pending = { sheet: args.sheet, cells: snapshotLocked(args.sheet, areas) };
      };
      const moveAllowedValues = (args: GC.Spread.Sheets.IDragDropBlockEventArgs) => {
        const sheet = args.sheet;
        const sheetName = sheet.name();
        const writes: PasteWrite[] = [];
        const written = new Set<string>();
        for (let r = 0; r < args.rowCount; r += 1) {
          for (let c = 0; c < args.colCount; c += 1) {
            const row = args.toRow + r;
            const col = args.toCol + c;
            if (!cellAllowed(sheetName, row, col)) continue;
            writes.push({ sheetName, row, col, value: sheet.getValue(args.fromRow + r, args.fromCol + c) });
            written.add(row + ":" + col);
          }
        }
        for (let r = 0; r < args.rowCount; r += 1) {
          for (let c = 0; c < args.colCount; c += 1) {
            const row = args.fromRow + r;
            const col = args.fromCol + c;
            if (!written.has(row + ":" + col) && cellAllowed(sheetName, row, col)) {
              writes.push({ sheetName, row, col, value: null });
            }
          }
        }
        if (writes.length === 0) return;
        setTimeout(() => {
          if (destroyed) return;
          workbook.commandManager().execute({ cmd: PASTE_ALLOWED_COMMAND, sheetName, writes });
        }, 0);
      };
      workbook.bind(GC.Spread.Sheets.Events.ClipboardPasting, handler);
      workbook.bind(GC.Spread.Sheets.Events.DragFillBlock, fillHandler);
      workbook.bind(GC.Spread.Sheets.Events.DragFillBlockCompleted, restoreLocked);
      workbook.bind(GC.Spread.Sheets.Events.DragDropBlock, dropHandler);
      workbook.bind(GC.Spread.Sheets.Events.DragDropBlockCompleted, restoreLocked);
      return () => {
        workbook.unbind(GC.Spread.Sheets.Events.ClipboardPasting, handler);
        workbook.unbind(GC.Spread.Sheets.Events.DragFillBlock, fillHandler);
        workbook.unbind(GC.Spread.Sheets.Events.DragFillBlockCompleted, restoreLocked);
        workbook.unbind(GC.Spread.Sheets.Events.DragDropBlock, dropHandler);
        workbook.unbind(GC.Spread.Sheets.Events.DragDropBlockCompleted, restoreLocked);
      };
    },
    blockAllEdits() {
      assertNotDestroyed();
      const events = [
        GC.Spread.Sheets.Events.EditStarting,
        GC.Spread.Sheets.Events.ClipboardPasting,
        GC.Spread.Sheets.Events.DragDropBlock,
        GC.Spread.Sheets.Events.DragFillBlock,
      ];
      const handler = (_: unknown, args: { cancel: boolean }) => {
        args.cancel = true;
      };
      events.forEach((name) => workbook.bind(name, handler));
      const previous = {
        allowUserDragDrop: workbook.options.allowUserDragDrop,
        allowUserDragFill: workbook.options.allowUserDragFill,
      };
      workbook.options.allowUserDragDrop = false;
      workbook.options.allowUserDragFill = false;
      return () => {
        if (destroyed) return;
        events.forEach((name) => workbook.unbind(name, handler));
        workbook.options.allowUserDragDrop = previous.allowUserDragDrop;
        workbook.options.allowUserDragFill = previous.allowUserDragFill;
      };
    },
    subscribeWorkbookChanged(listener) {
      assertNotDestroyed();
      const events = [
        GC.Spread.Sheets.Events.RowChanged,
        GC.Spread.Sheets.Events.ColumnChanged,
        GC.Spread.Sheets.Events.RangeChanged,
        GC.Spread.Sheets.Events.ClipboardPasted,
        GC.Spread.Sheets.Events.DragDropBlockCompleted,
        GC.Spread.Sheets.Events.DragFillBlockCompleted,
        GC.Spread.Sheets.Events.SheetChanged,
        GC.Spread.Sheets.Events.SheetNameChanged,
        GC.Spread.Sheets.Events.ValueChanged,
        // Đổi định dạng ô từ ribbon của Designer không bắn ValueChanged.
        GC.Spread.Sheets.Events.CellChanged,
      ];
      const handler = () => {
        if (muted === 0) listener();
      };
      events.forEach((name) => workbook.bind(name, handler));
      return () => {
        if (destroyed) return;
        events.forEach((name) => workbook.unbind(name, handler));
      };
    },
    markCells(cells) {
      assertNotDestroyed();
      workbook.suspendPaint();
      try {
        muteChanges(() => {
          for (const key of [...marks.keys()]) restoreMark(key);
          for (const cell of cells) paintMark(cell);
        });
        if (marks.size > 0 && !unbindMarkWatch) {
          // Người dùng sửa ô đã tô → gỡ dấu tô của riêng ô đó.
          const onValueChanged = (_: unknown, args: { sheet: GC.Spread.Sheets.Worksheet; row: number; col: number }) => {
            const key = markKey(workbook.getSheetIndex(args.sheet.name()), args.row, args.col);
            if (marks.has(key)) muteChanges(() => restoreMark(key));
          };
          workbook.bind(GC.Spread.Sheets.Events.ValueChanged, onValueChanged);
          unbindMarkWatch = () => workbook.unbind(GC.Spread.Sheets.Events.ValueChanged, onValueChanged);
        }
      } finally {
        workbook.resumePaint();
      }
      const first = cells[0];
      if (!first) return;
      const sheet = workbook.getSheet(first.sheetIndex);
      if (!sheet) return;
      workbook.setActiveSheetIndex(first.sheetIndex);
      sheet.setActiveCell(first.row, first.col);
      sheet.showCell(
        first.row,
        first.col,
        GC.Spread.Sheets.VerticalPosition.center,
        GC.Spread.Sheets.HorizontalPosition.center
      );
    },
    clearMarks() {
      if (destroyed || marks.size === 0) return;
      workbook.suspendPaint();
      try {
        muteChanges(() => {
          for (const key of [...marks.keys()]) restoreMark(key);
        });
      } finally {
        workbook.resumePaint();
      }
    },
    withoutMarks(fn) {
      if (destroyed || marks.size === 0) return fn();
      const saved = [...marks.values()].map(({ sheetIndex, row, col }) => ({ sheetIndex, row, col }));
      let result!: ReturnType<typeof fn>;
      workbook.suspendPaint();
      try {
        muteChanges(() => {
          for (const key of [...marks.keys()]) restoreMark(key);
        });
        result = fn();
        muteChanges(() => {
          for (const cell of saved) paintMark(cell);
        });
      } finally {
        workbook.resumePaint();
      }
      return result;
    },
    applyComboBox(sheetIndex, row, col, rowCount, items) {
      const sheet = sheetAt(sheetIndex);
      // ComboBox LƯU value (mã) nhưng HIỂN THỊ text (tên). Mỗi ô một instance.
      for (let r = 0; r < rowCount; r += 1) {
        const combo = new GC.Spread.Sheets.CellTypes.ComboBox();
        combo.items(items as { text: string; value: string }[]);
        combo.editorValueType(GC.Spread.Sheets.CellTypes.EditorValueType.value);
        sheet.getCell(row + r, col).cellType(combo);
      }
    },
    applyAddRowButton(sheetIndex, row, col, caption, command) {
      const sheet = sheetAt(sheetIndex);
      const style = new GC.Spread.Sheets.Style();
      style.locked = false; // ô nút phải mở khoá để bấm được trên sheet protected
      style.cellButtons = buildCellButtons(sheet, col, [{ caption, command }]);
      sheet.setStyle(row, col, style);
    },
    applyCellButtons(sheetIndex, row, col, buttons) {
      const sheet = sheetAt(sheetIndex);
      const style = new GC.Spread.Sheets.Style();
      style.locked = false;
      style.cellButtons = buildCellButtons(sheet, col, buttons);
      sheet.setStyle(row, col, style);
    },
    lockForViewing(sheetIndex) {
      const sheet = sheetAt(sheetIndex);
      // Đặt style cho CẢ vùng (getRange(0,0,hết dòng,hết cột).locked) làm SpreadJS nhân bản
      // style từng ô: biểu tổng hợp năm (20 sheet, ~330 nghìn ô) mất vài giây chỉ để khoá.
      // Ở đây: khoá style mặc định + style dòng + style cột (ô không có style riêng thừa
      // hưởng từ đó), rồi chỉ sửa những ô có style riêng mà vẫn đang mở khoá / có nút.
      const rowCount = sheet.getRowCount();
      const colCount = sheet.getColumnCount();
      const defaultStyle = sheet.getDefaultStyle();
      defaultStyle.locked = true;
      sheet.setDefaultStyle(defaultStyle);
      if (colCount > 0) sheet.getRange(-1, 0, -1, colCount).locked(true);
      if (rowCount > 0) sheet.getRange(0, -1, rowCount, -1).locked(true);

      const used = sheet.getUsedRange(GC.Spread.Sheets.UsedRangeType.style);
      if (!used) return;
      const hasButtons = (style: GC.Spread.Sheets.Style | null | undefined) =>
        (style?.cellButtons?.length ?? 0) > 0;
      // Nút gắn ở style dòng/cột (hiếm): giữ đúng cách cũ — xoá nút trên cả vùng có style.
      let inheritedButtons = false;
      for (let row = 0; row < rowCount && !inheritedButtons; row += 1) {
        inheritedButtons = hasButtons(sheet.getStyle(row, -1));
      }
      for (let col = 0; col < colCount && !inheritedButtons; col += 1) {
        inheritedButtons = hasButtons(sheet.getStyle(-1, col));
      }
      if (inheritedButtons) {
        sheet.getRange(used.row, used.col, used.rowCount, used.colCount).cellButtons([]);
      }
      for (let row = used.row; row < used.row + used.rowCount; row += 1) {
        for (let col = used.col; col < used.col + used.colCount; col += 1) {
          const style = sheet.getStyle(row, col);
          if (!style) continue;
          // locked chưa đặt nhưng kế thừa "mở khoá" từ style có tên → getActualStyle mới thấy.
          if (style.locked !== true && sheet.getActualStyle(row, col).locked === false) {
            sheet.getCell(row, col).locked(true);
          }
          if (!inheritedButtons && hasButtons(style)) sheet.getCell(row, col).cellButtons([]);
        }
      }
    },
    clearCellButtons(sheetIndex) {
      const sheet = sheetAt(sheetIndex);
      // Nút nằm trong style: chỉ quét vùng CÓ style; giữ nguyên viền/màu/ComboBox.
      const used = sheet.getUsedRange(GC.Spread.Sheets.UsedRangeType.style);
      if (!used) return;
      sheet.getRange(used.row, used.col, used.rowCount, used.colCount).cellButtons([]);
    },
    destroy(onDestroyed) {
      if (destroyed) return;
      destroyed = true;
      if (!options.destroyWorkbook) {
        onDestroyed?.();
        return;
      }
      const destroyNow = () => {
        workbook.destroy();
        onDestroyed?.();
      };
      if (pendingLoad) {
        pendingLoad.then(destroyNow, destroyNow);
      } else {
        destroyNow();
      }
    },
  };
}
