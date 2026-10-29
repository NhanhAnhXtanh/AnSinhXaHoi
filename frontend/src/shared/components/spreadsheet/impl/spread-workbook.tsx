// Phần NẶNG của <SpreadWorkbook>: SpreadJS + plugin IO + theme. Chỉ được nạp động
// từ `../lazy.tsx` — import tĩnh file này ở bất cứ đâu là kéo cả SpreadJS vào bundle chính.
//
// Thứ tự import: SpreadJS core → plugin IO → CSS theme, rồi gán giấy phép ở cấp module
// (trước khi component nào tạo Workbook).
import * as GC from "@mescius/spread-sheets";
import "@mescius/spread-sheets-io";
import "@mescius/spread-sheets/styles/gc.spread.sheets.excel2013white.css";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { EmptyState, LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import { parseScriptText } from "../script/compile";
import { createScriptContext } from "../script/ctx-factory";
import { ScriptHookEngine } from "../script/hook-engine";
import {
  registerScriptSession,
  resolveReport,
  resolveRunMode,
  resolveSheetCode,
  toSharedData,
} from "../script/session";
import type { TempTableValidationIssue } from "../script/types";
import type { SpreadWorkbookApi, SpreadWorkbookProps } from "../types";
import { LEGACY_DATA_SHEET_NAME, isTechnicalSheetName } from "../workbook-json";
import { exposeWorkbookForE2E } from "./e2e-hook";
import { applySpreadLicense } from "./license";
import { wrapSpreadWorkbook, type SpreadAdapter } from "./spread-adapter";
import { useContentVersion } from "./use-content-version";
import { createWorkbookApi } from "./workbook-api";

applySpreadLicense();

/** Giới hạn quét khi đóng dấu khoá ô của khung mẫu (biểu thật chỉ vài trăm dòng). */
const MAX_SCAN_ROWS = 2000;
const MAX_SCAN_COLS = 256;
/** Bóp tần suất vẽ lại khi khung đổi kích thước (kéo split, thu sidebar…). */
const REFRESH_THROTTLE_MS = 120;

/**
 * Quy tắc nhập trên KHUNG MẪU (bản Jmix `stampInputCellLocks`): trong vùng đã dùng,
 * ô có chữ/công thức KHOÁ, ô trống MỞ. Đặt locked tường minh cả hai chiều để ghi
 * đè cờ khoá lệch chuẩn file Excel mang theo.
 */
function stampInputCellLocks(adapter: SpreadAdapter, sheetIndex: number): void {
  const sheet = adapter.workbook.getSheet(sheetIndex);
  const rowCount = Math.min(sheet.getRowCount(), MAX_SCAN_ROWS);
  const colCount = Math.min(sheet.getColumnCount(), MAX_SCAN_COLS);
  const content: boolean[][] = [];
  let lastRow = -1;
  let lastCol = -1;
  for (let row = 0; row < rowCount; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < colCount; col += 1) {
      const value = sheet.getValue(row, col);
      const has =
        (sheet.getFormula(row, col) ?? "") !== "" || (value != null && value !== "");
      line.push(has);
      if (has) {
        lastRow = row;
        if (col > lastCol) lastCol = col;
      }
    }
    content.push(line);
  }
  for (let row = 0; row <= lastRow; row += 1) {
    for (let col = 0; col <= lastCol; col += 1) {
      sheet.getCell(row, col).locked(content[row][col]);
    }
  }
}

function issueText(issue: TempTableValidationIssue): string {
  return issue.severity === "WARNING" ? `Lưu ý: ${issue.message}` : issue.message;
}

export default function SpreadWorkbookImpl(props: SpreadWorkbookProps) {
  const { readOnly = false, scriptText = null, hideTabs = false, activeSheet, className } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef(props);
  latestRef.current = props;
  const adapterRef = useRef<SpreadAdapter | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const contentVersion = useContentVersion(props.workbook);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let ready = false;
    const cleanups: (() => void)[] = [];
    setStatus("loading");

    // Bật cờ đã sửa: gộp các sự kiện của MỘT thao tác (dán 100 ô bắn 100 lần) vào một lần gọi.
    let dirtyFrame: number | undefined;
    const markDirty = () => {
      if (!ready || dirtyFrame !== undefined) return;
      dirtyFrame = window.requestAnimationFrame(() => {
        dirtyFrame = undefined;
        if (!cancelled) latestRef.current.onDirtyChange?.(true);
      });
    };

    const initial = latestRef.current;
    // Mỗi lần nạp dùng một thẻ con riêng: workbook cũ có thể bị huỷ TRỄ (đợi lần nạp
    // incremental của nó xong — xem spread-adapter destroy), khi đó chỉ gỡ thẻ của nó,
    // không đụng workbook mới đã dựng trên cùng khung.
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    host.appendChild(mount);
    const workbook = new GC.Spread.Sheets.Workbook(mount, {
      tabStripVisible: !initial.hideTabs,
      newTabVisible: false,
      tabEditable: false,
      allowSheetReorder: false,
    });
    const adapter = wrapSpreadWorkbook(workbook, {
      destroyWorkbook: true,
      onCellCommand: markDirty,
    });
    adapterRef.current = adapter;

    const applyTabs = () =>
      adapter.setTabOptions({
        structureEditable: false,
        tabStripVisible: !latestRef.current.hideTabs,
      });

    // SpreadJS chỉ tự vẽ lại khi CỬA SỔ đổi cỡ; khung ở đây còn co giãn vì split,
    // sidebar, toàn màn hình… Throttle leading+trailing để kéo split không giật.
    let refreshAt = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const doRefresh = () => {
      if (!ready) return;
      refreshAt = Date.now();
      try {
        adapter.refresh();
      } catch {
        /* workbook đã huỷ */
      }
    };
    const resizeObserver = new ResizeObserver(() => {
      if (!ready) return;
      const elapsed = Date.now() - refreshAt;
      if (elapsed >= REFRESH_THROTTLE_MS) doRefresh();
      else if (refreshTimer === undefined) {
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          doRefresh();
        }, REFRESH_THROTTLE_MS - elapsed);
      }
    });
    resizeObserver.observe(host);

    // Ngừng vẽ tới khi workbook ở trạng thái cuối — không lộ khung hình trung gian.
    adapter.suspendPaint();

    const load = async () => {
      const json = initial.workbook;
      if (json != null) await adapter.fromJSON(json);
      if (cancelled) return;

      applyTabs();
      // Sheet kỹ thuật _DATA_ của mẫu đời cũ: ẩn hẳn.
      const legacyIndex = adapter.getSheetIndex(LEGACY_DATA_SHEET_NAME);
      if (legacyIndex >= 0 && adapter.getSheetCount() > 1) {
        adapter.setSheetVisibility(legacyIndex, "veryHidden");
      }

      const sheetCount = adapter.getSheetCount();
      const editable = !initial.readOnly;
      const text = initial.scriptText?.trim() ?? "";
      const scriptContext = initial.scriptContext;
      const shared = toSharedData(scriptContext);
      const mode = resolveRunMode(scriptContext?.mode);
      const sheetCode = resolveSheetCode(scriptContext);
      const report = resolveReport(scriptContext?.report);
      const scriptMessages: string[] = [];

      // Script dựng SAU khi workbook ở trạng thái cuối — onLoad thấy đúng thứ người dùng sắp thấy.
      let engine: ScriptHookEngine | undefined;
      if (text !== "") {
        const handle = createScriptContext({
          adapter,
          mode,
          report,
          shared,
          onMessage: (message) => scriptMessages.push(message),
        });
        engine = new ScriptHookEngine(handle);
        engine.load(parseScriptText(text), sheetCode);
      }

      if (editable) {
        // Script có beforeEdit → hook đó quyết định ô nào được nhập: mở cờ khoá do
        // Excel mang theo, nếu không SpreadJS chặn trước khi hook kịp chạy.
        const scriptControlsEditing = engine?.hasHook("beforeEdit") === true;
        for (let index = 0; index < sheetCount; index += 1) {
          if (isTechnicalSheetName(adapter.getSheetName(index))) continue;
          if (scriptControlsEditing) adapter.setAllCellsLocked(index, false);
          else if (initial.stampInputLocks) stampInputCellLocks(adapter, index);
        }
      }

      // onLoad (và afterInject ở chế độ tổng hợp) chạy trước khi protect sheet.
      if (engine) {
        const issues: TempTableValidationIssue[] = [...engine.compileErrorIssues()];
        issues.push(...(await engine.runLifecycle("onLoad")).issues);
        if (cancelled) return;
        // Bản nháp Sở đang sửa (fromDraft) đã mang số của Sở: không chạy afterInject
        // để khỏi đổ số tổng hợp đè lên — giống bản Jmix.
        const fromDraft = scriptContext?.fromDraft === true;
        if ((mode === "summary" || mode === "summary-edit") && !fromDraft) {
          issues.push(...(await engine.runLifecycle("afterInject")).issues);
          if (cancelled) return;
        }
        const messages = [...issues.map(issueText), ...scriptMessages];
        if (issues.length > 0) console.warn("Script của mẫu báo:", issues);
        latestRef.current.onScriptResult?.({
          ok: !issues.some((issue) => issue.severity === "ERROR"),
          messages,
        });
      }

      // Chỉ xem: khoá MỌI ô (bản nháp mang sẵn ô mở khoá — chỉ protect là chưa đủ),
      // gỡ nút trong ô, và chặn hẳn mọi thao tác sửa. Chọn/copy vẫn được.
      if (!editable) {
        for (let index = 0; index < adapter.getSheetCount(); index += 1) {
          adapter.setAllCellsLocked(index, true);
          adapter.clearCellButtons(index);
        }
        cleanups.push(adapter.blockAllEdits());
      }
      for (let index = 0; index < adapter.getSheetCount(); index += 1) {
        adapter.setSheetProtected(index, true);
      }

      activateSheet(adapter, latestRef.current.activeSheet);
      if (!editable) {
        const active = workbook.getActiveSheetIndex();
        if (active >= 0) adapter.resetView(active);
      }

      if (engine && editable) {
        const scriptEngine = engine;
        cleanups.push(adapter.onBeforeEdit((cell) => scriptEngine.runBeforeEdit(cell)));
        cleanups.push(
          adapter.onBeforeCommit((cell, value) => scriptEngine.runBeforeCommit(cell, value))
        );
        cleanups.push(adapter.onBeforePaste((range) => scriptEngine.runBeforePaste(range)));
      }
      cleanups.push(adapter.subscribeWorkbookChanged(markDirty));

      const api: SpreadWorkbookApi = createWorkbookApi(adapter, {
        afterImport: () => {
          applyTabs();
          markDirty();
        },
      });
      registerScriptSession(api, { adapter, shared, mode, sheetCode, report });
      cleanups.push(exposeWorkbookForE2E(workbook));
      ready = true;
      latestRef.current.onDirtyChange?.(false);
      latestRef.current.onReady?.(api);
    };

    load()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Không mở được bảng tính:", error);
        setStatus("error");
      })
      // Luôn vẽ lại, kể cả nhánh lỗi — bỏ sót là canvas trắng vĩnh viễn.
      .finally(() => {
        if (!cancelled) {
          try {
            adapter.resumePaint();
          } catch {
            /* đã huỷ */
          }
        }
      });

    return () => {
      cancelled = true;
      ready = false;
      if (dirtyFrame !== undefined) window.cancelAnimationFrame(dirtyFrame);
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      resizeObserver.disconnect();
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          /* đã huỷ */
        }
      });
      adapterRef.current = null;
      // Ẩn ngay để khung không hiện hai bảng; gỡ hẳn khi workbook đã huỷ xong.
      mount.style.display = "none";
      adapter.destroy(() => mount.remove());
    };
    // Nạp lại khi NỘI DUNG workbook, chế độ chỉ xem hoặc script đổi. Các prop khác
    // (scriptContext, callback) đọc qua latestRef tại thời điểm nạp.
  }, [contentVersion, readOnly, scriptText]);

  // Ẩn/hiện hàng tab không cần nạp lại.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || status !== "ready") return;
    try {
      adapter.setTabOptions({ structureEditable: false, tabStripVisible: !hideTabs });
    } catch {
      /* đã huỷ */
    }
  }, [hideTabs, status]);

  // Đổi sheet đang mở (màn tự vẽ SheetTabs).
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || status !== "ready" || !activeSheet) return;
    try {
      const index = adapter.getSheetIndex(activeSheet);
      if (index >= 0 && index !== adapter.workbook.getActiveSheetIndex()) {
        adapter.setActiveSheet(index);
      }
    } catch {
      /* đã huỷ */
    }
  }, [activeSheet, status]);

  return (
    <div
      className={cn(
        "bg-card relative h-full min-h-[320px] w-full overflow-hidden rounded-md border",
        className
      )}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="bg-card absolute inset-0 z-10 flex">
          <LoadingState label="Đang mở bảng tính…" />
        </div>
      )}
      {status === "error" && (
        <div className="bg-card absolute inset-0 z-10 flex">
          <EmptyState
            icon={TriangleAlert}
            title="Không mở được bảng tính"
            description="Vui lòng tải lại trang. Nếu vẫn không được, hãy báo cho quản trị hệ thống."
          />
        </div>
      )}
    </div>
  );
}

/** Mở sheet theo tên; không có thì mở sheet nghiệp vụ HIỂN THỊ đầu tiên. */
function activateSheet(adapter: SpreadAdapter, name: string | undefined): void {
  if (name) {
    const index = adapter.getSheetIndex(name);
    if (index >= 0) {
      adapter.setActiveSheet(index);
      return;
    }
  }
  for (let index = 0; index < adapter.getSheetCount(); index += 1) {
    if (
      adapter.getSheetVisibility(index) === "visible" &&
      !isTechnicalSheetName(adapter.getSheetName(index))
    ) {
      adapter.setActiveSheet(index);
      return;
    }
  }
}
