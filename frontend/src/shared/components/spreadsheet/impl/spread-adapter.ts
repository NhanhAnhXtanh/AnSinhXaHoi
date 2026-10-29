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
  onBeforePaste(guard: (range: RangeEvent) => boolean | void): () => void;
  /** Chặn mọi thao tác sửa (gõ, dán, kéo thả, kéo điền) — màn chỉ xem. */
  blockAllEdits(): () => void;
  /** Bắn khi người dùng sửa workbook (gõ ô, dán, thêm/xoá dòng, đổi định dạng…). */
  subscribeWorkbookChanged(listener: () => void): () => void;
  /** Huỷ workbook; `onDestroyed` chạy khi đã huỷ thật (có thể trễ nếu đang nạp dở). */
  destroy(onDestroyed?: () => void): void;
}

export type SpreadAdapterOptions = {
  /** Workbook do adapter sở hữu (huỷ khi destroy) — false với workbook của Designer. */
  destroyWorkbook: boolean;
  /** Gọi sau khi người dùng bấm nút trong ô (script thêm/xoá dòng) — để bật cờ đã sửa. */
  onCellCommand?: () => void;
};

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

function fileTypeOf(file: File): GC.Spread.Sheets.FileType | "json" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ssjson")) return GC.Spread.Sheets.FileType.ssjson;
  if (name.endsWith(".json")) return "json";
  return GC.Spread.Sheets.FileType.excel;
}

export function wrapSpreadWorkbook(
  workbook: GC.Spread.Sheets.Workbook,
  options: SpreadAdapterOptions
): SpreadAdapter {
  let destroyed = false;
  // Lần nạp incremental đang chạy: SpreadJS còn tác vụ hẹn giờ trên workbook, huỷ
  // giữa chừng làm tác vụ đó đọc vào workbook đã huỷ ("reading 'clear'"). Huỷ thật
  // được hoãn tới khi lần nạp xong (gặp khi React gắn lại component, đổi biểu nhanh).
  let pendingLoad: Promise<void> | null = null;

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
      const handler = (_: unknown, args: GC.Spread.Sheets.IClipboardPastingEventArgs) => {
        const range = args.cellRange;
        const verdict = guard({
          sheetName: args.sheetName,
          row: range.row,
          col: range.col,
          rowCount: range.rowCount,
          colCount: range.colCount,
        });
        if (verdict === false) args.cancel = true;
      };
      workbook.bind(GC.Spread.Sheets.Events.ClipboardPasting, handler);
      return () => workbook.unbind(GC.Spread.Sheets.Events.ClipboardPasting, handler);
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
      const handler = () => listener();
      events.forEach((name) => workbook.bind(name, handler));
      return () => {
        if (destroyed) return;
        events.forEach((name) => workbook.unbind(name, handler));
      };
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
