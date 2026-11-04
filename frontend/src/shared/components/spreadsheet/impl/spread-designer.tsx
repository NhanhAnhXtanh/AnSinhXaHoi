// Phần NẶNG của <SpreadDesigner>: SpreadJS Designer (ribbon) + mọi add-on. Chỉ được
// nạp động từ `../lazy.tsx`.
//
// THỨ TỰ IMPORT LÀ CỐ Ý (bê từ bản Jmix designer-app/mount.tsx):
//  1. Các add-on side-effect PHẢI đứng trước designer: ribbon tham chiếu namespace
//     add-on (Slicers/Pivot/TableSheet/GanttSheet/ReportSheet/DataCharts/FormulaPanel)
//     khi dựng panel nhưng designer KHÔNG tự require chúng — thiếu là designer ném
//     `TypeError: Cannot read properties of undefined` lúc nạp. Tập hợp + thứ tự theo
//     sample React chính thức của MESCIUS.
//  2. `@mescius/spread-sheets-designer` (kèm gói chữ tiếng Anh) PHẢI nạp TRƯỚC khi gán
//     giấy phép: khoá Designer chỉ gán được khi namespace `GC.Spread.Sheets.Designer`
//     đã tồn tại. `applySpreadLicense()` gọi ở thân module, sau mọi import.
// Gói chữ: MESCIUS không có tiếng Việt cho Designer → dùng mặc định tiếng Anh.
import * as GC from "@mescius/spread-sheets";
import "@mescius/spread-sheets-print";
import "@mescius/spread-sheets-shapes";
import "@mescius/spread-sheets-datacharts-addon";
import "@mescius/spread-sheets-slicers";
import "@mescius/spread-sheets-pivot-addon";
import "@mescius/spread-sheets-tablesheet";
import "@mescius/spread-sheets-ganttsheet";
import "@mescius/spread-sheets-reportsheet-addon";
import "@mescius/spread-sheets-formula-panel";
import "@mescius/spread-sheets-io";
import "@mescius/spread-sheets-designer-resources-en";
import "@mescius/spread-sheets-designer";
import type * as GCDesigner from "@mescius/spread-sheets-designer";
import { Designer } from "@mescius/spread-sheets-designer-react";
import "@mescius/spread-sheets/styles/gc.spread.sheets.excel2013white.css";
import "@mescius/spread-sheets-designer/styles/gc.spread.sheets.designer.min.css";

import { useEffect, useMemo, useRef, useState } from "react";

import { LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import { registerScriptSession } from "../script/session";
import type { SpreadDesignerProps } from "../types";
import { applySpreadLicense } from "./license";
import { wrapSpreadWorkbook, type SpreadAdapter } from "./spread-adapter";
import { useContentVersion } from "./use-content-version";
import { createWorkbookApi } from "./workbook-api";

applySpreadLicense();

type DesignerInstance = GCDesigner.Spread.Sheets.Designer.Designer;
type DesignerConfig = GCDesigner.Spread.Sheets.Designer.IDesignerConfig;

const DESIGNER_STYLE = { width: "100%", height: "100%" };

// Mục thêm/xoá/di chuyển sheet trong menu chuột phải của tab (tên lệnh đọc từ bundle designer).
const BLOCKED_TAB_CONTEXT_COMMANDS = new Set<string>([
  "gc.spread.contextMenu.insertSheet",
  "gc.spread.contextMenu.deleteSheet",
  "sheetTabMoveOrCopy",
  "gc.spread.contextMenu.changeSheetTabPosition",
]);
// Mục Insert/Delete Sheet trong dropdown Home > Cells của ribbon.
const BLOCKED_RIBBON_SHEET_COMMANDS = new Set<string>(["insertSheet", "deleteSheet"]);

interface DesignerRuntimeNamespace {
  DefaultConfig?: DesignerConfig;
  getCommand?: (name?: string) => unknown;
}

function designerRuntime(): DesignerRuntimeNamespace | undefined {
  return (GC.Spread.Sheets as unknown as { Designer?: DesignerRuntimeNamespace }).Designer;
}

let ribbonSheetCommandsSanitized = false;

/**
 * Bỏ "Insert Sheet"/"Delete Sheet" khỏi dropdown ribbon. Lệnh dựng sẵn thắng
 * `config.commandMap` khi tra tên nên không ghi đè được — phải lọc tại chỗ.
 * Phòng thủ hoàn toàn: cấu trúc lệnh đổi thì thành no-op, không bao giờ làm sập Designer.
 */
function sanitizeRibbonSheetCommands(ns: DesignerRuntimeNamespace): void {
  if (ribbonSheetCommandsSanitized || typeof ns.getCommand !== "function") return;
  ribbonSheetCommandsSanitized = true;
  try {
    const all = ns.getCommand();
    if (!all || typeof all !== "object") return;
    for (const command of Object.values(all as Record<string, unknown>)) {
      if (!command || typeof command !== "object") continue;
      const record = command as Record<string, unknown>;
      for (const key of ["dropdownList", "listContent", "subCommands"] as const) {
        const list = record[key];
        if (!Array.isArray(list)) continue;
        const filtered = list.filter((item) => {
          if (typeof item === "string") return !BLOCKED_RIBBON_SHEET_COMMANDS.has(item);
          if (item && typeof item === "object") {
            const entry = item as Record<string, unknown>;
            const name = entry.commandName ?? entry.command ?? entry.value;
            return !(typeof name === "string" && BLOCKED_RIBBON_SHEET_COMMANDS.has(name));
          }
          return true;
        });
        if (filtered.length !== list.length) record[key] = filtered;
      }
    }
  } catch {
    // Cố gắng hết mức; không bao giờ làm hỏng Designer.
  }
}

function buildDesignerConfig(sheetStructureEditable: boolean): DesignerConfig | undefined {
  const ns = designerRuntime();
  const base = ns?.DefaultConfig;
  if (!ns || !base) return undefined;
  if (sheetStructureEditable) return base;
  sanitizeRibbonSheetCommands(ns);
  const contextMenu = Array.isArray(base.contextMenu)
    ? base.contextMenu.filter((name) => !BLOCKED_TAB_CONTEXT_COMMANDS.has(name))
    : base.contextMenu;
  return { ...base, contextMenu };
}

type LoadFn = (...args: unknown[]) => unknown;

/**
 * Gọi {@code onLoaded} sau mỗi lần workbook được nạp lại nguyên khối: {@code import} / {@code open}
 * (khi callback thành công chạy) và {@code fromJSON}. Trả hàm gỡ, trả lại hàm gốc.
 */
function watchWholeWorkbookLoads(
  workbook: GC.Spread.Sheets.Workbook,
  onLoaded: () => void
): () => void {
  const target = workbook as unknown as Record<string, LoadFn | undefined>;
  const restores: (() => void)[] = [];

  for (const name of ["import", "open"] as const) {
    const original = target[name];
    if (typeof original !== "function") continue;
    target[name] = function (this: unknown, file: unknown, success?: unknown, ...rest: unknown[]) {
      const done = (...args: unknown[]) => {
        if (typeof success === "function") (success as LoadFn)(...args);
        onLoaded();
      };
      return original.call(this, file, done, ...rest);
    };
    restores.push(() => {
      target[name] = original;
    });
  }

  const fromJSON = target.fromJSON;
  if (typeof fromJSON === "function") {
    target.fromJSON = function (this: unknown, ...args: unknown[]) {
      const result = fromJSON.apply(this, args);
      Promise.resolve(result).then(onLoaded, () => {});
      return result;
    };
    restores.push(() => {
      target.fromJSON = fromJSON;
    });
  }

  return () => restores.forEach((restore) => restore());
}

export default function SpreadDesignerImpl(props: SpreadDesignerProps) {
  const { className, sheetStructureEditable = true } = props;
  const latestRef = useRef(props);
  latestRef.current = props;
  const adapterRef = useRef<SpreadAdapter | null>(null);
  const workbookRef = useRef<GC.Spread.Sheets.Workbook | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Tăng mỗi lần Designer khởi tạo (0 = chưa sẵn sàng) — để nạp lại vào workbook mới.
  const [designerGen, setDesignerGen] = useState(0);
  const [loading, setLoading] = useState(true);
  const contentVersion = useContentVersion(props.workbook);
  const designerConfig = useMemo(
    () => buildDesignerConfig(sheetStructureEditable),
    [sheetStructureEditable]
  );
  const spreadOptions = useMemo(
    () => ({
      newTabVisible: sheetStructureEditable,
      tabEditable: sheetStructureEditable,
      allowSheetReorder: sheetStructureEditable,
    }),
    [sheetStructureEditable]
  );

  // Nạp (lại) workbook vào Designer khi Designer sẵn sàng hoặc NỘI DUNG prop đổi.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (designerGen === 0 || !adapter) return;
    let cancelled = false;
    setLoading(true);
    cleanupRef.current?.();
    cleanupRef.current = null;

    let dirtyFrame: number | undefined;
    let listening = false;
    const markDirty = () => {
      if (!listening || dirtyFrame !== undefined) return;
      dirtyFrame = window.requestAnimationFrame(() => {
        dirtyFrame = undefined;
        if (!cancelled) latestRef.current.onDirtyChange?.(true);
      });
    };

    const run = async () => {
      const json = latestRef.current.workbook;
      adapter.suspendPaint();
      try {
        if (json != null) await adapter.fromJSON(json);
      } finally {
        adapter.resumePaint();
      }
      if (cancelled) return;
      // fromJSON khôi phục option tab đã lưu → đặt lại theo quyền sửa cấu trúc.
      adapter.setTabOptions({ structureEditable: latestRef.current.sheetStructureEditable ?? true });
      const unsubscribe = adapter.subscribeWorkbookChanged(markDirty);
      // Import / Open trong menu FILE của Designer thay cả workbook mà không bắn sự kiện sửa
      // nào → bọc các hàm nạp của workbook để coi là đã sửa (nạp lần đầu ở trên đã xong).
      const workbook = workbookRef.current;
      const unwatchLoads = workbook
        ? watchWholeWorkbookLoads(workbook, () => {
            adapter.setTabOptions({
              structureEditable: latestRef.current.sheetStructureEditable ?? true,
            });
            markDirty();
          })
        : () => {};
      listening = true;
      cleanupRef.current = () => {
        listening = false;
        if (dirtyFrame !== undefined) window.cancelAnimationFrame(dirtyFrame);
        unsubscribe();
        unwatchLoads();
      };
      const api = createWorkbookApi(adapter, {
        afterImport: () => {
          adapter.setTabOptions({
            structureEditable: latestRef.current.sheetStructureEditable ?? true,
          });
          markDirty();
        },
      });
      registerScriptSession(api, {
        adapter,
        shared: {},
        mode: "designer",
        sheetCode: null,
        report: null,
      });
      latestRef.current.onDirtyChange?.(false);
      latestRef.current.onReady?.(api);
    };

    run()
      .catch((error: unknown) => {
        console.error("Không nạp được mẫu vào màn thiết kế:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [designerGen, contentVersion]);

  // Bật/tắt quyền sửa cấu trúc tab khi prop đổi.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (designerGen === 0 || !adapter) return;
    try {
      adapter.setTabOptions({ structureEditable: sheetStructureEditable });
    } catch {
      /* đã huỷ */
    }
  }, [designerGen, sheetStructureEditable]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    },
    []
  );

  return (
    <div
      className={cn(
        "bg-card relative h-full min-h-[480px] w-full overflow-hidden rounded-md border",
        className
      )}
    >
      <div className="absolute inset-0">
        <Designer
          styleInfo={DESIGNER_STYLE}
          config={designerConfig}
          spreadOptions={spreadOptions}
          designerInitialized={(designer: DesignerInstance) => {
            const workbook = designer.getWorkbook() as unknown as GC.Spread.Sheets.Workbook;
            workbookRef.current = workbook;
            adapterRef.current?.destroy();
            // Workbook thuộc về Designer — adapter không được huỷ nó.
            adapterRef.current = wrapSpreadWorkbook(workbook, { destroyWorkbook: false });
            setDesignerGen((gen) => gen + 1);
          }}
        />
      </div>
      {loading && (
        <div className="bg-card absolute inset-0 z-10 flex">
          <LoadingState label="Đang mở bảng tính…" />
        </div>
      )}
    </div>
  );
}
