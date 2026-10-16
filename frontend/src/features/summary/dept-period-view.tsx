import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCustomMutation, useWarnAboutChange } from "@refinedev/core";
import {
  CheckCheck,
  Download,
  GitCompare,
  Pencil,
  RotateCw,
  Save,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  HeaderActions,
  LoadingState,
  StatusBadge,
  formatDateTime,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction } from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  exportWorkbooksToXlsx,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";

import {
  JSON_HEADERS,
  deptReportUrl,
  deptSheetUrl,
  errorMessage,
  parseWorkbook,
  periodStatusMeta,
  useApiObject,
  type DeptReportDetail,
  type DeptSheetRuntime,
  type DraftResult,
  type PeriodOverview,
  type SaveResult,
} from "./api";
import { CompleteDialog } from "./complete-dialog";
import { HistoryCompareDialog } from "./history-compare-dialog";
import { ScopePicker } from "./scope-picker";
import { SheetBody, SheetError, SheetFrame } from "./sheet-frame";
import { joinVi, summaryExportName } from "./utils";

type DialogKind = "complete" | "discard" | "history" | null;
type Busy = "draft" | "complete" | "reopen" | "discard" | "export" | null;

/**
 * Kỳ ĐÃ lưu số liệu tổng hợp (UC-55, UC-56): bảng đọc số liệu Sở hiện hành.
 *
 * - "Sửa số liệu" → bảng mở cho sửa (ô script cho phép). Đổi tab biểu khi đang sửa
 *   thì bảng được cất lên máy chủ trước.
 * - "Lưu số liệu đã sửa" → cất bảng đang sửa (chưa vào số liệu).
 * - "Kiểm tra & hoàn tất" → máy chủ đọc số trên bảng, lưu các dòng đổi thành
 *   phiên bản mới của năm rồi khoá biểu; "Sửa lại" mở khoá.
 * - ⋯ → Xuất Excel, Lịch sử và so sánh, Bỏ các số đang sửa.
 */
export function DeptPeriodView({
  overview,
  reportId,
  onChanged,
}: {
  overview: PeriodOverview;
  reportId: number;
  onChanged: () => void;
}) {
  const period = overview.period;
  const detailState = useApiObject<DeptReportDetail>(deptReportUrl(reportId), undefined, "sheets");
  const detail = detailState.data;
  const sheets = useMemo(() => detail?.sheets ?? [], [detail]);

  const [sheetKey, setSheetKey] = useState<string>("");
  const sheet = sheets.find((s) => String(s.templateId) === sheetKey) ?? sheets[0];
  const runtimeState = useApiObject<DeptSheetRuntime>(
    sheet ? deptSheetUrl(reportId, sheet.templateId) : null,
    undefined,
    "rows"
  );
  const runtime = runtimeState.data;

  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState<Busy>(null);
  /** Tăng để dựng lại bảng (sau khi lưu / bỏ thay đổi). */
  const [reloadNo, setReloadNo] = useState(0);
  const apiRef = useRef<SpreadWorkbookApi | null>(null);
  const revisionRef = useRef<number | null>(null);
  const { setWarnWhen } = useWarnAboutChange();
  const { mutateAsync: send } = useCustomMutation();

  // Đang có bảng sửa dở trên máy chủ → mở thẳng chế độ sửa (như bản Jmix).
  useEffect(() => {
    if (detail && detail.sheets.some((s) => s.pendingDraft) && detail.yearLock === null) setEditing(true);
  }, [detail]);

  useEffect(() => {
    revisionRef.current = runtime ? runtime.revision : null;
  }, [runtime]);

  useEffect(() => {
    setWarnWhen(dirty);
    return () => setWarnWhen(false);
  }, [dirty, setWarnWhen]);

  const yearLock = detail?.yearLock ?? overview.yearLock;
  const canEdit = Boolean(detail?.canEdit) && yearLock === null;
  const sheetEditable = Boolean(runtime?.editable) && editing && canEdit;
  const fromDraft = runtime?.draftWorkbookJson != null;
  const pendingSheets = sheets.filter((s) => s.pendingDraft).map((s) => s.shortName);

  const workbook = useMemo(
    () => (runtime ? (parseWorkbook(runtime.draftWorkbookJson) ?? parseWorkbook(runtime.workbookJson)) : null),
    [runtime]
  );

  const scriptContext = useMemo(() => {
    if (!runtime) return undefined;
    // Bảng đã cất mang sẵn số Sở đang sửa: không đổ lại số liệu (bản Jmix chỉ chạy onLoad).
    const rows = fromDraft ? [] : runtime.rows.map((row) => ({ ...row }));
    return {
      mode: "summary-edit",
      fromDraft,
      rows,
      summaryRows: rows.map((row) => ({ ...row })),
      periodId: String(period.id),
      periodName: period.name,
      sheetCode: runtime.sheetCode,
      scopeKind: "ALL",
      sourceSheet: "",
      a: runtime.reportYear,
      b: runtime.reportYear,
      year: runtime.reportYear,
      unitName: "Toàn tỉnh Đồng Nai",
      summaryDataUrl: runtime.summaryDataUrl,
    } satisfies Record<string, unknown>;
  }, [runtime, fromDraft, period.id, period.name]);

  // ------------------------------------------------------------ thao tác

  const refreshAll = async () => {
    await Promise.all([detailState.refetch(), runtimeState.refetch()]);
    onChanged();
  };

  /** "Lưu số liệu đã sửa": cất bảng đang sửa (chưa vào số liệu). */
  const saveDraft = async (quiet: boolean): Promise<boolean> => {
    const api = apiRef.current;
    if (!api || !runtime || !sheet) return false;
    setBusy("draft");
    try {
      const { data } = await send({
        url: deptSheetUrl(reportId, sheet.templateId, "/draft"),
        method: "put",
        values: { workbookJson: JSON.stringify(api.toJSON()), revision: revisionRef.current ?? runtime.revision },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      revisionRef.current = (data as unknown as DraftResult).revision;
      setDirty(false);
      void detailState.refetch();
      if (!quiet) toast.success(`Đã lưu số liệu đang sửa của biểu ${sheet.shortName}.`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Chưa lưu được số liệu đang sửa. Bạn thử lại sau ít phút."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const switchSheet = async (key: string) => {
    if (sheet && key === String(sheet.templateId)) return;
    if (dirty && sheetEditable && !(await saveDraft(true))) return;
    setDirty(false);
    apiRef.current = null;
    setSheetKey(key);
  };

  const startComplete = async () => {
    if (dirty && !(await saveDraft(true))) return;
    setDialog("complete");
  };

  const doComplete = async (reason: string) => {
    if (!sheet) return;
    setBusy("complete");
    try {
      const { data } = await send({
        url: deptSheetUrl(reportId, sheet.templateId, "/complete"),
        method: "post",
        values: { reason: reason === "" ? null : reason },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      const result = data as unknown as SaveResult;
      setDialog(null);
      setDirty(false);
      setEditing(false);
      toast.success(
        result.rowCount > 0
          ? `Đã hoàn tất biểu ${sheet.shortName} — ${result.rowCount} dòng được lưu thành phiên bản ${result.ledgerVersion}.`
          : `Đã hoàn tất biểu ${sheet.shortName}, số liệu không đổi.`
      );
      await refreshAll();
      setReloadNo((n) => n + 1);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa hoàn tất được biểu. Bạn thử lại sau ít phút."));
    } finally {
      setBusy(null);
    }
  };

  const doReopen = async () => {
    if (!sheet) return;
    setBusy("reopen");
    try {
      await send({
        url: deptSheetUrl(reportId, sheet.templateId, "/reopen"),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setEditing(true);
      toast.success(`Đã mở lại biểu ${sheet.shortName} để sửa tiếp.`);
      await refreshAll();
    } catch (error) {
      toast.error(errorMessage(error, "Chưa mở lại được biểu. Bạn thử lại sau ít phút."));
    } finally {
      setBusy(null);
    }
  };

  const doDiscard = async () => {
    setBusy("discard");
    try {
      await send({
        url: deptReportUrl(reportId, "/discard"),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setDialog(null);
      setDirty(false);
      setEditing(false);
      toast.info(`Đã bỏ các số đang sửa, bảng trở về phiên bản ${detail?.ledgerVersion ?? ""}.`);
      await refreshAll();
      setReloadNo((n) => n + 1);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa bỏ được các số đang sửa. Bạn thử lại sau ít phút."));
    } finally {
      setBusy(null);
    }
  };

  const doExport = async () => {
    const api = apiRef.current;
    if (!api || !sheet) return;
    setBusy("export");
    try {
      const fileName = summaryExportName(sheet.shortName, period.name);
      await exportWorkbooksToXlsx(
        [{ sheetCode: sheet.shortName, sheetName: sheet.shortName, workbookJson: api.toJSON() }],
        fileName
      );
      toast.success(`Đã xuất Excel biểu ${sheet.shortName} · ${period.name}.`);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa xuất được tệp Excel. Bạn thử lại sau ít phút."));
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------ đầu thẻ

  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] | undefined;
  if (runtime && canEdit) {
    if (runtime.completion === "COMPLETED") {
      primary = { label: "Sửa lại", icon: Pencil, onClick: () => void doReopen(), loading: busy === "reopen" };
    } else if (!editing || !runtime.editable) {
      primary = {
        label: "Sửa số liệu",
        icon: Pencil,
        onClick: () => setEditing(true),
        disabled: !runtime.editable,
        reason: runtime.readOnlyReason ?? undefined,
      };
    } else {
      secondary = [
        {
          label: "Lưu số liệu đã sửa",
          icon: Save,
          onClick: () => void saveDraft(false),
          loading: busy === "draft",
          disabled: busy !== null,
        },
      ];
      primary = {
        label: "Kiểm tra & hoàn tất",
        icon: CheckCheck,
        onClick: () => void startComplete(),
        disabled: busy !== null,
        loading: busy === "complete",
      };
    }
  }

  const menu: ActionItem[] = [
    {
      key: "export",
      label: busy === "export" ? "Đang xuất Excel…" : "Xuất Excel",
      icon: Download,
      onSelect: () => void doExport(),
      disabled: !runtime || busy !== null,
      reason: !runtime ? "Bảng chưa mở xong." : undefined,
    },
    {
      key: "history",
      label: "Lịch sử và so sánh",
      icon: GitCompare,
      onSelect: () => setDialog("history"),
    },
    ...(canEdit && (pendingSheets.length > 0 || dirty)
      ? [
          {
            key: "discard",
            label: "Bỏ các số đang sửa",
            icon: Undo2,
            destructive: true,
            separatorBefore: true,
            onSelect: () => setDialog("discard"),
          } satisfies ActionItem,
        ]
      : []),
  ];

  const status = periodStatusMeta(period.status);
  let meta: ReactNode = detail
    ? `Số liệu tổng hợp · Phiên bản ${detail.ledgerVersion}${
        editing && canEdit
          ? dirty
            ? " · Đang sửa, chưa lưu"
            : pendingSheets.length > 0
              ? ` · Đã lưu số đang sửa của biểu ${joinVi(pendingSheets)}`
              : " · Đang sửa"
          : ` · Lưu ${formatDateTime(detail.createdAt)}${detail.createdBy ? ` · ${detail.createdBy}` : ""}`
      }${yearLock ? ` · ${yearLock}` : ""}`
    : "Số liệu tổng hợp";
  if (detail?.sourceStale) {
    meta = (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{meta}</span>
        <span className="text-warning-text inline-flex items-center gap-1.5">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          Có phiếu được duyệt hoặc trả lại sau lần lưu — số liệu đã lưu không tự cập nhật.
        </span>
      </span>
    );
  }

  const actions = (
    <>
      <ScopePicker
        value="tinh"
        onChange={() => undefined}
        units={overview.units}
        disabled
        disabledReason="Số liệu đã lưu tính chung toàn tỉnh nên không đổi được phạm vi."
      />
      <HeaderActions primary={primary} secondary={secondary} items={menu} />
    </>
  );

  // ------------------------------------------------------------ thân

  let body: ReactNode;
  const error = detailState.error ?? runtimeState.error;
  if (error) {
    body = (
      <SheetError
        message={errorMessage(error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
        action={
          <Button type="button" variant="outline" onClick={() => void refreshAll()}>
            <RotateCw aria-hidden />
            Thử lại
          </Button>
        }
      />
    );
  } else if (!detail || !runtime || !sheet || runtime.templateId !== sheet.templateId) {
    body = <LoadingState label="Đang tải số liệu tổng hợp…" />;
  } else {
    body = (
      <SheetBody>
        <SpreadWorkbook
          key={`${reportId}-${runtime.templateId}-${reloadNo}`}
          workbook={workbook}
          readOnly={!sheetEditable}
          hideTabs
          stampInputLocks={sheetEditable && !fromDraft}
          scriptText={runtime.scriptText}
          scriptContext={scriptContext}
          onDirtyChange={(d) => {
            if (d && sheetEditable) setDirty(true);
          }}
          onReady={(api) => {
            apiRef.current = api;
          }}
          onScriptResult={(result) => {
            if (!result.ok) {
              console.warn("Script số liệu tổng hợp báo lỗi:", result.messages);
              toast.warning(
                `Một số ô của biểu ${runtime.shortName} chưa đổ được số liệu. Vui lòng báo người quản trị mẫu biểu kiểm tra.`
              );
            }
          }}
          className="h-full min-h-[360px] flex-1"
        />
      </SheetBody>
    );
  }

  return (
    <>
      <SheetFrame
        title={period.name}
        badge={
          yearLock ? (
            <StatusBadge tone="locked">Đã khoá</StatusBadge>
          ) : (
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          )
        }
        meta={meta}
        actions={actions}
        tabs={sheets.map((s) => ({
          key: String(s.templateId),
          label: s.shortName,
          done: s.completion === "COMPLETED" ? true : undefined,
        }))}
        tab={sheet ? String(sheet.templateId) : ""}
        onTabChange={(key) => void switchSheet(key)}
      >
        {body}
      </SheetFrame>

      {sheet && (
        <CompleteDialog
          open={dialog === "complete"}
          onOpenChange={(o) => !o && setDialog(null)}
          reportId={reportId}
          templateId={sheet.templateId}
          sheetLabel={sheet.shortName}
          periodName={period.name}
          busy={busy === "complete"}
          onConfirm={(reason) => void doComplete(reason)}
        />
      )}
      <ConfirmDialog
        open={dialog === "discard"}
        onOpenChange={(o) => !o && busy === null && setDialog(null)}
        title="Bỏ các số đang sửa?"
        description={`Các số đã sửa nhưng chưa hoàn tất của ${period.name} sẽ bị bỏ, bảng trở về số liệu phiên bản ${
          detail?.ledgerVersion ?? ""
        }.`}
        confirmLabel="Bỏ số đang sửa"
        destructive
        onConfirm={() => void doDiscard()}
      />
      <HistoryCompareDialog
        open={dialog === "history"}
        onOpenChange={(o) => !o && setDialog(null)}
        reportId={reportId}
        periodName={period.name}
        scopeLabel="Toàn tỉnh"
        restoreDisabledReason={
          yearLock ??
          (!canEdit
            ? "Bạn chưa được giao quyền sửa số liệu tổng hợp."
            : dirty || pendingSheets.length > 0
              ? "Hoàn tất hoặc bỏ các số đang sửa trước đã."
              : null)
        }
        onRestored={() => {
          setEditing(false);
          setDirty(false);
          void refreshAll().then(() => setReloadNo((n) => n + 1));
        }}
      />
    </>
  );
}
