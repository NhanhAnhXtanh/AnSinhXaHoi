import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Circle,
  EllipsisVertical,
  LoaderCircle,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RotateCw,
  Square,
  Trash2,
  X,
} from "lucide-react";

import {
  ScriptEditor,
  runScriptInDesigner,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";

import {
  newScriptTemplate,
  nextDraftUid,
  type DraftScript,
} from "../script-drafts";

/** Số dòng nhật ký giữ lại (như bản Jmix). */
const LOG_LIMIT = 150;
const ALL_SHEETS = "__moi_bieu__";

/**
 * - `edit`: phiên bản Nháp / Đang thử nghiệm — thêm, xoá, sửa mọi kịch bản, lưu cùng nút Lưu.
 * - `read`: mọi trạng thái khác (đã ban hành, đang khoá, đã thu hồi) — chỉ xem, vẫn Chạy / Dừng
 *   để xem hiệu lực. Khác Jmix: bản đã ban hành KHÔNG còn sửa riêng kịch bản tổng hợp; muốn đổi
 *   thì tạo phiên bản kế tiếp rồi ban hành lại.
 */
export type ScriptPanelMode = "edit" | "read";

type LogLine = { text: string };

/**
 * Màn soạn kịch bản trong Thiết kế mẫu — dựng lại `ScriptEditorPanel.tsx` của bản Jmix bằng
 * thành phần giao diện của bản React:
 *
 * - danh sách kịch bản (tên, phạm vi, chấm "đang chạy", đang tắt), Thêm, menu ⋮ Xoá. Không có
 *   Chuyển lên / Chuyển xuống như Jmix: máy chỉ gọi hàm kịch bản nào có, thứ tự chỉ đổi kết quả
 *   khi hai kịch bản cùng một hàm — người dùng khó hiểu nên bỏ. Thứ tự vẫn lưu theo danh sách
 *   (kịch bản cũ giữ thứ tự Jmix, kịch bản mới thêm vào cuối);
 * - ô Tên, Phạm vi (Mọi biểu / Riêng biểu đang mở), Bật, Mô tả, nút Xoá;
 * - Chạy / Dừng TỪNG kịch bản trên bảng đang thiết kế (gắn bộ chặn sửa ô của riêng kịch bản đó,
 *   chạy kiểm tra, chạy thử lấy số tổng hợp); khi mở khung tự chạy lần lượt các kịch bản đang bật;
 * - ô soạn Monaco riêng cho từng kịch bản, thanh dòng / cột, phóng to ô soạn;
 * - nhật ký chạy nền tối tô màu theo loại dòng, Xoá nhật ký, kéo đổi chiều cao.
 *
 * Kịch bản đang chạy bị khoá sửa tới khi Dừng (như bản Jmix).
 */
export function ScriptEditorPanel({
  drafts,
  loadFailed,
  onReload,
  onChange,
  mode,
  sheetCode,
  sheetLabel,
  workbook,
  onClose,
  className,
}: {
  /** null = đang tải. */
  drafts: DraftScript[] | null;
  loadFailed: boolean;
  onReload: () => void;
  onChange: (next: DraftScript[]) => void;
  mode: ScriptPanelMode;
  /** Mã biểu đang mở (BM-xxxxxx) — giá trị của lựa chọn "Riêng biểu". */
  sheetCode: string;
  /** Tên ngắn của biểu (1a, 1b…) — chữ hiển thị và tên trang trong khung kịch bản mới. */
  sheetLabel: string;
  /** Bảng tính đang thiết kế; null khi chưa mở xong. */
  workbook: SpreadWorkbookApi | null;
  onClose: () => void;
  className?: string;
}) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [runningUids, setRunningUids] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [confirmRemove, setConfirmRemove] = useState<DraftScript | null>(null);
  const runningRef = useRef(new Map<string, () => void>());
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const nameId = useId();
  const scopeId = useId();
  const enabledId = useId();
  const descriptionId = useId();

  const list = drafts ?? [];
  const current = list.find((d) => d.uid === selectedUid) ?? list[0] ?? null;
  const currentRunning = current != null && runningUids.includes(current.uid);

  const appendLog = useCallback((lines: string[]) => {
    setLog((old) => [...old, ...lines.map((text) => ({ text }))].slice(-LOG_LIMIT));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  /* ---------------- chạy / dừng ---------------- */

  const stopScript = useCallback((uid: string) => {
    const stop = runningRef.current.get(uid);
    if (!stop) return false;
    stop();
    runningRef.current.delete(uid);
    setRunningUids([...runningRef.current.keys()]);
    return true;
  }, []);

  // Gỡ mọi bộ chặn khi đóng khung hoặc bảng tính đổi — không để bộ chặn mồ côi trên bảng.
  useEffect(() => {
    const running = runningRef.current;
    return () => {
      for (const stop of running.values()) stop();
      running.clear();
    };
  }, [workbook]);

  const runScript = useCallback(
    async (draft: DraftScript) => {
      if (!workbook) {
        appendLog(["✕ Bảng tính chưa mở xong để chạy kịch bản."]);
        return;
      }
      setBusy(true);
      stopScript(draft.uid);
      const result = await runScriptInDesigner(
        workbook,
        {
          id: draft.uid,
          name: draft.name,
          sheetCode: draft.sheetCode,
          code: draft.code,
          displayOrder: 0,
          enabled: true,
        },
        {
          sheetCode,
          // ctx.report giả của màn thiết kế — như bản Jmix.
          report: { reportId: "chay-thu", sheetCode, status: "DRAFT", organizationCode: "" },
          onMessage: (text) => appendLog([`[thông báo] ${text}`]),
        }
      );
      if (result.stop) {
        runningRef.current.set(draft.uid, result.stop);
        setRunningUids([...runningRef.current.keys()]);
      }
      appendLog(result.lines);
      setBusy(false);
    },
    [appendLog, sheetCode, stopScript, workbook]
  );

  // Mở khung lần đầu (đã có kịch bản và bảng tính): chạy lần lượt các kịch bản đang bật.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !drafts || !workbook) return;
    autoRan.current = true;
    const enabled = drafts.filter((d) => d.enabled);
    if (enabled.length === 0) return;
    void (async () => {
      for (const draft of enabled) await runScript(draft);
    })();
  }, [drafts, workbook, runScript]);

  /* ---------------- sửa danh sách ---------------- */

  const canEdit = mode === "edit";
  const locked = !canEdit || currentRunning;

  function update(uid: string, patch: Partial<DraftScript>) {
    onChange(list.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  }

  function addScript() {
    // Chốt "đã tự chạy" để kịch bản vừa thêm không bị chạy ngay; người soạn bấm Chạy để thử.
    autoRan.current = true;
    const draft: DraftScript = {
      uid: nextDraftUid(),
      id: null,
      name: `Kịch bản ${list.length + 1}`,
      description: "",
      sheetCode,
      code: newScriptTemplate(sheetLabel),
      enabled: true,
    };
    onChange([...list, draft]);
    setSelectedUid(draft.uid);
  }

  function remove(draft: DraftScript) {
    stopScript(draft.uid);
    const index = list.findIndex((d) => d.uid === draft.uid);
    const next = list.filter((d) => d.uid !== draft.uid);
    onChange(next);
    setSelectedUid(next[Math.min(index, next.length - 1)]?.uid ?? null);
  }

  function stopSelected() {
    if (current && stopScript(current.uid)) {
      appendLog([`■ Đã dừng kịch bản "${current.name}" — gỡ bộ chặn (nếu có) và mở khoá sửa.`]);
    }
  }

  /* ---------------- vẽ ---------------- */

  const removeHint = "Kịch bản chỉ mất hẳn khi bấm Lưu ở đầu trang.";

  const header = (
    <div className="flex items-center gap-2 border-b px-4 py-2.5">
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Kịch bản của biểu</h2>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng khung kịch bản" onClick={onClose}>
        <X aria-hidden />
      </Button>
    </div>
  );

  const banner =
    mode === "edit" ? null : (
      <div className="bg-warning-subtle text-warning-text flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs">
        <Lock aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          Phiên bản này chỉ xem được. Vẫn Chạy / Dừng để xem hiệu lực; muốn thêm, sửa, xoá kịch bản hãy
          tạo phiên bản kế tiếp.
        </span>
      </div>
    );

  if (drafts == null || loadFailed) {
    return (
      <aside aria-label="Kịch bản của biểu" className={cn("bg-card flex min-h-0 flex-col border-l", className)}>
        {header}
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm">
          {loadFailed ? (
            <>
              <p>Không tải được danh sách kịch bản của phiên bản này.</p>
              <Button type="button" variant="outline" size="sm" onClick={onReload}>
                <RotateCw aria-hidden />
                Tải lại
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Đang tải kịch bản…
            </p>
          )}
        </div>
      </aside>
    );
  }

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Kịch bản ({list.length})</span>
        {canEdit && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={addScript}>
            <Plus aria-hidden />
            Thêm
          </Button>
        )}
      </div>
      <ul aria-label="Danh sách kịch bản" className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {list.map((item) => {
          const running = runningUids.includes(item.uid);
          const selected = current?.uid === item.uid;
          return (
            <li
              key={item.uid}
              className={cn(
                "mb-0.5 flex items-center gap-1 rounded-md pr-1",
                selected ? "bg-accent ring-primary/30 ring-1" : "hover:bg-accent/60"
              )}
            >
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                onClick={() => setSelectedUid(item.uid)}
              >
                <Circle
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0",
                    running ? "fill-success text-success" : "fill-muted text-muted-foreground/40"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium",
                      !item.enabled && "text-muted-foreground line-through"
                    )}
                  >
                    {item.name || "(chưa đặt tên)"}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.sheetCode ? `Riêng biểu ${sheetLabel}` : "Mọi biểu"}
                    {running ? " · đang chạy" : ""}
                    {item.enabled ? "" : " · đang tắt"}
                  </span>
                </span>
              </button>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Thao tác với kịch bản ${item.name}`}
                    >
                      <EllipsisVertical aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={running}
                      onSelect={() => setConfirmRemove(item)}
                    >
                      <Trash2 aria-hidden />
                      Xoá kịch bản
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="text-muted-foreground px-2 py-3 text-sm">Chưa có kịch bản nào.</li>
        )}
      </ul>
      <div className="flex gap-2 border-t p-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !current || currentRunning || !current.enabled || !workbook}
          title={
            currentRunning
              ? "Kịch bản đang chạy — bấm Dừng trước nếu muốn chạy lại"
              : current && !current.enabled
                ? "Kịch bản đang tắt — bật lên mới chạy được"
                : "Chạy kịch bản đang chọn trên bảng đang thiết kế (kịch bản khác đang chạy giữ nguyên)"
          }
          onClick={() => current && void runScript(current)}
        >
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          Chạy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !currentRunning}
          title="Dừng riêng kịch bản đang chọn — gỡ bộ chặn của nó khỏi bảng, mở khoá sửa"
          onClick={stopSelected}
        >
          <Square aria-hidden />
          Dừng
        </Button>
      </div>
    </div>
  );

  const editorPane = current ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 grow basis-40 flex-col gap-1.5">
          <Label htmlFor={nameId} className="text-xs">
            Tên kịch bản
          </Label>
          <Input
            id={nameId}
            value={current.name}
            maxLength={255}
            disabled={locked}
            onChange={(e) => update(current.uid, { name: e.target.value })}
          />
        </div>
        <div className="flex min-w-0 grow basis-32 flex-col gap-1.5">
          <Label htmlFor={scopeId} className="text-xs">
            Phạm vi
          </Label>
          <Select
            value={current.sheetCode ?? ALL_SHEETS}
            disabled={locked}
            onValueChange={(value) => update(current.uid, { sheetCode: value === ALL_SHEETS ? null : value })}
          >
            <SelectTrigger id={scopeId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SHEETS}>Mọi biểu</SelectItem>
              <SelectItem value={sheetCode}>Riêng biểu {sheetLabel}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-2">
          {/* "Bật" vẫn đổi được khi kịch bản đang chạy: tắt thì dừng luôn. */}
          <Switch
            id={enabledId}
            checked={current.enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) => {
              if (!checked && currentRunning) stopSelected();
              update(current.uid, { enabled: checked });
            }}
          />
          <Label htmlFor={enabledId} className="text-sm">
            Bật
          </Label>
        </div>
        <div className="flex min-w-0 grow basis-full flex-col gap-1.5">
          <Label htmlFor={descriptionId} className="text-xs">
            Mô tả
          </Label>
          <div className="flex gap-2">
            <Input
              id={descriptionId}
              value={current.description}
              maxLength={500}
              placeholder="Kịch bản này làm gì…"
              disabled={locked}
              onChange={(e) => update(current.uid, { description: e.target.value })}
            />
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive-text shrink-0"
                disabled={currentRunning}
                title={currentRunning ? "Dừng kịch bản trước khi xoá" : removeHint}
                onClick={() => setConfirmRemove(current)}
              >
                <Trash2 aria-hidden />
                Xoá
              </Button>
            )}
          </div>
        </div>
      </div>
      {currentRunning && canEdit && (
        <div className="bg-success-subtle text-success-text shrink-0 border-b px-3 py-1 text-xs">
          Kịch bản đang chạy trên bảng — bị khoá để giữ nguyên trạng thái. Bấm <strong>Dừng</strong> để sửa.
        </div>
      )}
      <div className="bg-sidebar text-sidebar-foreground flex min-h-0 flex-1 flex-col">
        <ScriptEditor
          path={`asxh-kich-ban-${current.uid}.js`}
          value={current.code}
          readOnly={locked}
          readOnlyMessage={
            currentRunning
              ? "Kịch bản đang chạy — bấm Dừng để sửa."
              : "Phiên bản này chỉ xem được — muốn sửa hãy tạo phiên bản kế tiếp."
          }
          ariaLabel={`Mã kịch bản ${current.name}`}
          onChange={(code) => update(current.uid, { code })}
          onCursorChange={(pos) => setCursor({ line: pos.line, column: pos.column })}
          className="flex-1"
        />
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-4 border-t px-3 py-1 text-xs">
        <span className="flex-1" />
        <span className="tabular-nums">
          Dòng {cursor.line}, Cột {cursor.column}
        </span>
        <span>JavaScript</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={maximized ? "Thu nhỏ ô soạn" : "Phóng to ô soạn (ẩn danh sách và nhật ký)"}
          title={maximized ? "Thu nhỏ ô soạn" : "Phóng to ô soạn (ẩn danh sách và nhật ký)"}
          onClick={() => setMaximized((m) => !m)}
        >
          {maximized ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
      </div>
    </div>
  ) : (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Chọn hoặc thêm một kịch bản để soạn.
    </div>
  );

  const logPane = (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="text-overline text-slate-400">Nhật ký chạy</span>
        <span className="flex-1" />
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-40"
          disabled={log.length === 0}
          onClick={() => setLog([])}
        >
          Xoá nhật ký
        </button>
      </div>
      <div aria-live="polite" className="min-h-0 flex-1 overflow-auto px-3 pt-1 pb-2 font-mono text-xs leading-5">
        {log.length === 0 ? (
          <p className="text-slate-500">Chưa có nhật ký — bấm Chạy để chạy thử kịch bản trên bảng đang thiết kế.</p>
        ) : (
          log.map((line, i) => (
            <div key={i} className={cn("whitespace-pre-wrap", logTone(line.text))}>
              {line.text}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );

  return (
    <aside aria-label="Kịch bản của biểu" className={cn("bg-card flex min-h-0 flex-col border-l", className)}>
      {header}
      {banner}
      <div className="min-h-0 flex-1">
        {maximized ? (
          editorPane
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={32} minSize={15}>
              {listPane}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={68} minSize={30}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={72} minSize={20}>
                  {editorPane}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={28} minSize={8}>
                  {logPane}
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <AlertDialog open={confirmRemove != null} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá kịch bản “{confirmRemove?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>{removeHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không xoá</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemove) remove(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              Xoá kịch bản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

/** Tô màu dòng nhật ký theo loại — đọc lướt phân biệt được lỗi / chạy / dừng (như bản Jmix). */
function logTone(line: string): string {
  if (line.startsWith("✕") || line.includes("· lỗi]")) return "text-red-300";
  if (line.includes("· lưu ý]")) return "text-amber-200";
  if (line.startsWith("▶")) return "text-emerald-300";
  if (line.startsWith("■")) return "text-amber-300";
  return "";
}
