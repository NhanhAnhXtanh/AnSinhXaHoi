import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CircleOff, Download, Maximize, Minimize, Pencil, RotateCcwClock, Save, SearchX } from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  WorkCard,
  formatDateTime,
  type ActionItem,
  type PrimaryAction,
  type SheetCell,
} from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  STATUS_META,
  displayStatus,
  doneCount,
  isEditable,
  isSheetDone,
  nowIso,
  type InputReport,
  type SheetState,
  type TreasuryFile,
} from "./model";
import {
  CURRENT_COL,
  REVISION_PARAM,
  buildSheetData,
  exportFileName,
  lineIndexOfRow,
  sheetCurrentTotal,
  statusLine,
  validateSheet,
  type SheetIssue,
} from "./report-text";
import { RevisionHistoryDialog } from "./revision-history-dialog";
import { updateInputReport, useInputReport } from "./store";
import { TreasurySubmitDialog } from "./treasury-submit-dialog";
import { CheckErrorsDialog, SubmitConfirmDialog } from "./work-dialogs";

const LIST_PATH = "/input-reports";

/**
 * Màn nhập số liệu một phiếu (UC-34..38, 43..45; Figma 310:31610 và các khung
 * trạng thái 310:44251 · 47614 · 48786 · 50333 · 53871 · 56441 · 58133).
 * Thao tác theo nguyên tắc §4 Ví dụ 3.
 */
export function InputReportWork() {
  const { id } = useParams<{ id: string }>();
  const report = useInputReport(id);
  const navigate = useNavigate();

  if (!report) {
    return (
      <AsxhPage title="Không tìm thấy phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={SearchX}
          title="Không tìm thấy phiếu này"
          description="Phiếu có thể đã được Sở thu hồi cùng kỳ báo cáo. Bạn quay lại danh sách để chọn phiếu khác."
          action={
            <Button type="button" onClick={() => navigate(LIST_PATH)}>
              Về danh sách phiếu
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  // key: đổi phiếu thì dựng lại toàn bộ trạng thái màn (biểu đang mở, thay đổi chưa lưu…).
  return <WorkScreen key={report.id} report={report} />;
}

function firstSheetToOpen(r: InputReport): string {
  const open = isEditable(r) ? r.sheets.find((s) => !isSheetDone(s)) : undefined;
  return (open ?? r.sheets[0]).code;
}

function WorkScreen({ report }: { report: InputReport }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Xem bản cũ qua Lịch sử phiên bản: ?phienBan=1 — luôn chỉ xem.
  const requested = Number(searchParams.get(REVISION_PARAM));
  const oldEntry =
    requested && requested !== report.revision ? report.history.find((h) => h.no === requested) : undefined;

  const [loading, setLoading] = useState(true);
  const [sheetCode, setSheetCode] = useState(() => firstSheetToOpen(report));
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [noDataOpen, setNoDataOpen] = useState(false);
  const [issues, setIssues] = useState<SheetIssue[]>([]);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const anyDialogOpen = historyOpen || noDataOpen || issues.length > 0 || treasuryOpen || confirmOpen;

  // Mở phiếu: giả lập thời gian tải bảng tính (Figma 310:56441).
  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, [oldEntry?.no]);

  const sheet = report.sheets.find((s) => s.code === sheetCode) ?? report.sheets[0];
  const status = displayStatus(report);
  const editable = !oldEntry && isEditable(report);
  const sheetEditable = editable && sheet.state === "in_progress";
  const done = doneCount(report);
  const remaining = report.sheets.filter((s) => !isSheetDone(s)).map((s) => s.code);
  const isDirty = dirty.has(sheet.code);

  const sheetData = useMemo(() => buildSheetData(report, sheet, sheetEditable), [report, sheet, sheetEditable]);

  // ------------------------------------------------------------ thao tác

  const clearDirty = (code: string) =>
    setDirty((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });

  const setSheetState = (code: string, state: SheetState) =>
    updateInputReport(report.id, (r) => ({
      ...r,
      updatedAt: nowIso(),
      sheets: r.sheets.map((s) => (s.code === code ? { ...s, state } : s)),
    }));

  const onCellChange = (rowIndex: number, colIndex: number, value: SheetCell) => {
    if (!sheetEditable || colIndex !== CURRENT_COL) return;
    const line = lineIndexOfRow(rowIndex, sheet.lines.length);
    if (line === null) return;
    let next: number | null;
    if (typeof value === "number") next = value;
    else if (value === null || value.trim() === "") next = null;
    else {
      toast.warning(`Ô D${rowIndex + 1} chỉ nhận số. Bạn gõ lại số liệu cho ô này.`);
      return;
    }
    const code = sheet.code;
    updateInputReport(report.id, (r) => ({
      ...r,
      sheets: r.sheets.map((s) =>
        s.code === code
          ? { ...s, lines: s.lines.map((l, i) => (i === line ? { ...l, current: next } : l)) }
          : s
      ),
    }));
    setDirty((prev) => new Set(prev).add(code));
  };

  // Lưu dữ liệu (nút viền + Ctrl+S): chỉ lưu bản nháp, không đổi trạng thái (UC-34).
  const saveRef = useRef<() => void>(() => {});
  const save = () => {
    if (!sheetEditable || saving) return;
    const code = sheet.code;
    setSaving(true);
    window.setTimeout(() => {
      updateInputReport(report.id, (r) => ({ ...r, updatedAt: nowIso() }));
      clearDirty(code);
      setSaving(false);
      toast.success(`Đã lưu số liệu biểu ${code}.`);
    }, 400);
  };
  saveRef.current = save;

  /**
   * Kiểm tra & hoàn tất biểu đang mở (UC-35). `thenSubmit`: phiếu bị trả lại
   * dùng một nút "Sửa & nộp lại" — hoàn tất biểu rồi, nếu mọi biểu đã xong,
   * mở luôn hộp nộp phiếu.
   */
  const complete = (thenSubmit: boolean) => {
    const found = validateSheet(sheet);
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    const code = sheet.code;
    setSheetState(code, "completed");
    clearDirty(code);
    const left = remaining.filter((c) => c !== code);
    if (thenSubmit && left.length === 0) {
      setTreasuryOpen(true);
      return;
    }
    toast.success(
      left.length === 0
        ? `Đã đánh dấu biểu ${code} là nhập xong. Mọi biểu đã xong — bạn bấm Nộp phiếu để gửi Sở.`
        : `Đã đánh dấu biểu ${code} là nhập xong. Biểu chuyển sang chỉ xem; bấm "Sửa lại" nếu cần nhập tiếp.`
    );
  };

  const markNoData = () => {
    const code = sheet.code;
    setSheetState(code, "no_data");
    clearDirty(code);
    setNoDataOpen(false);
    toast.success(`Đã ghi nhận: kỳ này biểu ${code} không phát sinh số liệu.`);
  };

  const reopen = () => {
    setSheetState(sheet.code, "in_progress");
    toast.success(`Đã mở lại biểu ${sheet.code} để nhập tiếp.`);
  };

  const exportExcel = () =>
    toast.success(`Đã xuất phiếu ${report.periodName} ra tệp ${exportFileName(report, oldEntry?.no)}.`);

  const setFiles = (files: TreasuryFile[]) => updateInputReport(report.id, (r) => ({ ...r, attachments: files }));
  const setConfirmed = (v: boolean) => updateInputReport(report.id, (r) => ({ ...r, treasuryConfirmed: v }));

  const submit = () => {
    const at = nowIso();
    updateInputReport(report.id, (r) => ({
      ...r,
      status: "submitted",
      submittedAt: at,
      updatedAt: at,
      returnReason: undefined, // BR-38.4
      history: r.history.map((h, i) =>
        i === 0
          ? {
              ...h,
              tone: STATUS_META.submitted.tone,
              statusLabel: STATUS_META.submitted.label,
              meta: `Nộp ngày ${formatDateTime(at)} · chờ Sở duyệt`,
              reason: undefined,
            }
          : h
      ),
    }));
    setDirty(new Set());
    setConfirmOpen(false);
    toast.success(`Đã nộp phiếu ${report.periodName}. Phiếu đang chờ Sở duyệt.`);
  };

  // ------------------------------------------------------------ phím tắt

  // Ctrl+S = Lưu, chặn hộp "Lưu trang" của trình duyệt (nguyên tắc §11).
  const editableRef = useRef(sheetEditable);
  editableRef.current = sheetEditable && !loading;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editableRef.current) saveRef.current();
        else toast.info("Biểu này đang ở chế độ chỉ xem nên không có gì để lưu.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc thoát toàn màn hình — nhường cho hộp thoại đang mở.
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !anyDialogOpen) exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, anyDialogOpen, exitFullscreen]);

  // Đóng tab khi còn số chưa lưu: trình duyệt bắt buộc dùng hộp của nó.
  useEffect(() => {
    if (dirty.size === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ------------------------------------------------------------ nút theo trạng thái

  const commonItems: ActionItem[] = [
    { key: "excel", label: "Xuất Excel", icon: Download, onSelect: exportExcel },
    { key: "history", label: "Lịch sử phiên bản", icon: RotateCcwClock, onSelect: () => setHistoryOpen(true) },
  ];

  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] = [];
  let items: ActionItem[] = commonItems;
  let blockedReason: string | undefined;

  if (editable && sheet.state === "in_progress") {
    // Biểu đang mở chưa xong: [Lưu dữ liệu] [Kiểm tra & hoàn tất | Sửa & nộp lại] ⋯
    secondary = [{ label: "Lưu dữ liệu", icon: Save, onClick: save, loading: saving }];
    primary =
      report.status === "returned"
        ? { label: "Sửa & nộp lại", onClick: () => complete(true) }
        : { label: "Kiểm tra & hoàn tất", onClick: () => complete(false) };
    items = [
      { key: "no-data", label: "Không phát sinh số liệu", icon: CircleOff, onSelect: () => setNoDataOpen(true) },
      ...commonItems,
    ];
  } else if (editable) {
    // Biểu đang mở đã xong: nút chính là Nộp phiếu (mờ + lý do nếu còn biểu chưa xong).
    blockedReason =
      remaining.length > 0
        ? `Chưa nhập xong tất cả các biểu: còn biểu ${remaining.join(", ")}.`
        : undefined;
    primary = {
      label: report.status === "returned" ? "Nộp lại phiếu" : "Nộp phiếu",
      onClick: () => setTreasuryOpen(true),
      disabled: remaining.length > 0,
      reason: blockedReason,
    };
    items = [
      { key: "reopen", label: `Sửa lại biểu ${sheet.code}`, icon: Pencil, onSelect: reopen },
      ...commonItems,
    ];
  }

  if (loading) {
    // Đang mở phiếu: các nút hiện nhưng mờ (Figma 310:56441).
    primary = primary && { ...primary, disabled: true, reason: undefined };
    secondary = secondary.map((a) => ({ ...a, disabled: true }));
    items = items.map((i) => ({ ...i, disabled: true }));
  }

  // ------------------------------------------------------------ đầu thẻ

  const badge = oldEntry ? (
    <StatusBadge tone={oldEntry.tone}>{oldEntry.statusLabel}</StatusBadge>
  ) : (
    <StatusBadge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</StatusBadge>
  );

  const metaParts: string[] = [report.periodName, `Phiên bản ${oldEntry?.no ?? report.revision}`];
  if (oldEntry) {
    metaParts.push(oldEntry.meta, "chỉ xem");
  } else {
    metaParts.push(`${done}/${report.sheets.length} biểu`);
    if (status !== "draft") metaParts.push(statusLine(report));
    if (blockedReason) metaParts.push(blockedReason);
  }
  if (sheet.state === "no_data") metaParts.push(`Biểu ${sheet.code}: không phát sinh số liệu`);

  const meta = (
    <span>
      {metaParts.join(" · ")}
      {isDirty && <span className="font-medium text-warning-text"> · Có thay đổi chưa lưu</span>}
    </span>
  );

  const fullscreenButton = fullscreen ? (
    <>
      <span className="hidden text-xs text-muted-foreground sm:inline">Nhấn Esc để thoát toàn màn hình</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label="Thoát toàn màn hình" onClick={exitFullscreen}>
            <Minimize />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Thoát toàn màn hình (Esc)</TooltipContent>
      </Tooltip>
    </>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Toàn màn hình" onClick={() => setFullscreen(true)}>
          <Maximize />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toàn màn hình</TooltipContent>
    </Tooltip>
  );

  const confirmSummary = {
    sheets: `Số biểu: ${report.sheets.length} biểu, đã nhập xong hết`,
    total: (() => {
      const main = report.sheets.find((s) => s.code === "1b");
      return main && main.state !== "no_data"
        ? `Tổng chi trả kỳ này (biểu 1b): ${sheetCurrentTotal(main)} ${main.unit}`
        : null;
    })(),
    files: `Xác nhận của Kho bạc: ${report.attachments.length} tệp đã đính kèm`,
  };

  const card = (
    <WorkCard
      title={`${report.periodName} — ${report.orgName}`}
      badge={badge}
      meta={meta}
      backTo={LIST_PATH}
      fill={!fullscreen}
      className={cn(fullscreen && "h-full rounded-none border-0 shadow-none")}
      actions={<HeaderActions primary={primary} secondary={secondary} items={items} />}
      footer={
        <SheetTabs
          tabs={report.sheets.map((s) => ({ key: s.code, label: s.code, done: isSheetDone(s) }))}
          value={sheet.code}
          onChange={setSheetCode}
          maxVisible={6}
          trailing={fullscreenButton}
        />
      }
    >
      {loading ? (
        <LoadingState label="Đang mở phiếu…" variant="panel" />
      ) : (
        <SpreadsheetView
          sheet={sheetData}
          readOnly={!sheetEditable}
          minRows={30}
          onCellChange={sheetEditable ? onCellChange : undefined}
        />
      )}
    </WorkCard>
  );

  return (
    <>
      {fullscreen ? <div className="fixed inset-0 z-40 flex flex-col bg-background">{card}</div> : card}

      <RevisionHistoryDialog
        report={report}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        viewingRevision={oldEntry?.no}
        onView={(no) => {
          setHistoryOpen(false);
          setSearchParams(no === report.revision ? {} : { [REVISION_PARAM]: String(no) });
        }}
      />

      <ConfirmDialog
        open={noDataOpen}
        onOpenChange={setNoDataOpen}
        title={`Khai biểu ${sheet.code} không phát sinh số liệu?`}
        description={`Biểu ${sheet.code} sẽ được tính là đã xong và chuyển sang chỉ xem. Số liệu bạn đã gõ dở vẫn được giữ lại nhưng sẽ không được kiểm tra khi nộp. Bạn có thể bấm Sửa lại để nhập tiếp.`}
        confirmLabel="Không phát sinh số liệu"
        cancelLabel="Quay lại"
        onConfirm={markNoData}
      />

      <CheckErrorsDialog
        sheetCode={sheet.code}
        issues={issues}
        open={issues.length > 0}
        onOpenChange={(o) => !o && setIssues([])}
      />

      <TreasurySubmitDialog
        open={treasuryOpen}
        onOpenChange={setTreasuryOpen}
        files={report.attachments}
        onFilesChange={setFiles}
        confirmed={report.treasuryConfirmed}
        onConfirmedChange={setConfirmed}
        onSubmit={() => {
          setTreasuryOpen(false);
          setConfirmOpen(true);
        }}
      />

      <SubmitConfirmDialog
        periodName={report.periodName}
        summary={confirmSummary}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={submit}
      />
    </>
  );
}
