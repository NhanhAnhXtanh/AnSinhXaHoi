import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  useCan,
  useCustom,
  useCustomMutation,
  useInvalidate,
  useOne,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import {
  CircleCheck,
  Download,
  FileDown,
  FileSearch,
  FileSpreadsheet,
  History,
  RotateCcw,
  RotateCw,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  SheetTabs,
  StatusBadge,
  formatDate,
  formatDateTime,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction } from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  exportWorkbooksToXlsx,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import { customResult } from "@/shared/hooks/use-custom-result";
import { Button } from "@/shared/ui/button";

import {
  ANNUAL_RESOURCE,
  ANNUAL_SCREEN,
  JSON_HEADERS,
  STATUS,
  SUBMITTER_ORG,
  annualSheetUrl,
  annualUrl,
  downloadAll,
  errorMessage,
  errorStatus,
  exportFileName,
  parseWorkbook,
  type AnnualReportRecord,
  type AnnualSheetRuntime,
} from "./api";
import { FullscreenButton, FullscreenFrame } from "./fullscreen-frame";
import { ReasonDialog } from "./decision-dialogs";

/** Dòng phụ dưới tiêu đề: ai nộp / ai quyết định, khi nào, văn bản nào. */
function statusLine(s: AnnualReportRecord): string {
  const doc = `Văn bản ${s.docNo} ngày ${formatDate(s.docDate)}`;
  if (s.status === "approved") {
    return `UBND đã duyệt ${formatDateTime(s.decidedAt ?? "")} · ${s.decidedBy ?? ""} · Sở nộp ${formatDate(s.submittedAt)} · ${doc}`;
  }
  if (s.status === "returned") {
    return `UBND ${s.reopened ? "mở lại" : "trả lại"} ${formatDateTime(s.decidedAt ?? "")} · Lý do: ${s.returnReason ?? "—"}`;
  }
  return `${SUBMITTER_ORG} nộp ${formatDateTime(s.submittedAt)} · ${s.submittedBy ?? ""} · ${doc}`;
}

/** Đường quay về: nơi đã mở phiếu (`?from=history|summary`), mặc định danh sách duyệt. */
function backPath(from: string | null): string {
  if (from === "history") return "/annual-review/history";
  if (from === "summary") return "/summary";
  return "/annual-review";
}

/**
 * Xem phiếu báo cáo năm (UC-62): bảng biểu năm chỉ đọc, đúng phiên bản số liệu
 * và phiên bản mẫu đã ghim khi nộp. Chờ duyệt → [Trả lại] [Phê duyệt]; đã duyệt
 * → chỉ ⋯ với "Mở lại báo cáo năm" (đỏ, cuối menu). Nút hiện theo quyền
 * `annual_reports:approve` và thao tác máy chủ cho phép.
 */
export function AnnualReviewWork() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const backTo = backPath(params.get("from"));
  const numericId = id && /^\d+$/.test(id) ? Number(id) : null;

  const { result: report, query } = useOne<AnnualReportRecord>({
    resource: ANNUAL_RESOURCE,
    id: numericId ?? 0,
    queryOptions: { enabled: numericId !== null },
    errorNotification: false,
  });

  if (numericId === null || (query.isError && errorStatus(query.error) === 404)) {
    return (
      <AsxhPage title="Không tìm thấy phiếu" backTo={backTo}>
        <EmptyState
          variant="page"
          icon={FileSearch}
          title="Không tìm thấy phiếu báo cáo năm"
          description="Phiếu có thể không còn hoặc đường dẫn không đúng."
          action={
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Về danh sách
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (query.isError) {
    return (
      <AsxhPage title="Chưa mở được phiếu" backTo={backTo}>
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa mở được phiếu báo cáo năm"
          description={errorMessage(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RotateCw aria-hidden />
              Thử lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (!report || report.id !== numericId) {
    return <LoadingState variant="page" label="Đang mở phiếu báo cáo năm…" />;
  }
  return <WorkScreen key={report.id} report={report} backTo={backTo} />;
}

function WorkScreen({ report: s, backTo }: { report: AnnualReportRecord; backTo: string }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { mutateAsync: postAction } = useCustomMutation<AnnualReportRecord>();
  const { data: canApproveData } = useCan({ resource: ANNUAL_SCREEN, action: "approve" });
  const canApprove = canApproveData?.can === true;

  const sheets = useMemo(() => s.sheets ?? [], [s.sheets]);
  const attachments = useMemo(() => s.attachments ?? [], [s.attachments]);
  const [sheetKey, setSheetKey] = useState("");
  const sheet = sheets.find((x) => String(x.templateId) === sheetKey) ?? sheets[0];
  const [dialog, setDialog] = useState<"approve" | "return" | "reopen" | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [full, setFull] = useState(false);
  const exitFull = useCallback(() => setFull(false), []);
  const apiRef = useRef<SpreadWorkbookApi | null>(null);

  const { result: runtimeResult, query: runtimeQuery } = useCustom<BaseRecord, HttpError>({
    url: sheet ? annualSheetUrl(s.id, sheet.templateId) : annualUrl(s.id),
    method: "get",
    errorNotification: false,
    queryOptions: { enabled: sheet !== undefined, refetchOnWindowFocus: false },
  });
  const runtime = sheet
    ? customResult(runtimeResult?.data as unknown as AnnualSheetRuntime | undefined, "workbookJson")
    : undefined;
  const current = runtime && sheet && runtime.templateId === sheet.templateId ? runtime : undefined;
  const workbook = useMemo(() => (current ? parseWorkbook(current.workbookJson) : null), [current]);
  const scriptContext = useMemo(() => {
    if (!current) return undefined;
    return {
      mode: "summary",
      rows: current.rows.map((row) => ({ ...row })),
      summaryRows: current.rows.map((row) => ({ ...row })),
      periodId: "",
      sheetCode: current.sheetCode,
      scopeKind: "ALL",
      sourceSheet: "",
      a: current.a,
      b: current.b,
      year: current.year,
      unitName: "Toàn tỉnh Đồng Nai",
      periodName: `Năm ${current.year}`,
      summaryDataUrl: current.summaryDataUrl,
    } satisfies Record<string, unknown>;
  }, [current]);

  const refresh = () =>
    invalidate({ resource: ANNUAL_RESOURCE, invalidates: ["list", "detail"], id: s.id });

  /** Gửi một quyết định; trả câu lỗi (để hộp lý do hiện) hoặc null khi xong. */
  const decide = async (action: "approve" | "return" | "reopen", reason?: string): Promise<string | null> => {
    setBusy(true);
    try {
      await postAction({
        url: annualUrl(s.id, `/${action}`),
        method: "post",
        values: reason === undefined ? {} : { reason },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      toast.success(
        action === "approve"
          ? `Đã phê duyệt báo cáo năm ${s.year}.`
          : action === "return"
            ? `Đã trả lại báo cáo năm ${s.year} cho Sở Tài chính.`
            : `Đã mở lại báo cáo năm ${s.year} — Sở sửa số liệu rồi gửi lại.`
      );
      await refresh();
      return null;
    } catch (error) {
      return errorMessage(error, "Chưa gửi được quyết định. Bạn thử lại sau ít phút.");
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    const api = apiRef.current;
    if (!api || !current) return;
    setExporting(true);
    try {
      await exportWorkbooksToXlsx(
        [{ sheetCode: current.shortName, sheetName: current.shortName, workbookJson: api.toJSON() }],
        exportFileName(s.year, s.revisionNo, current.shortName)
      );
      toast.success(`Đã xuất Excel biểu ${current.shortName} · Báo cáo năm ${s.year} · Phiếu ${s.revisionNo}.`);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa xuất được tệp Excel. Bạn thử lại sau ít phút."));
    } finally {
      setExporting(false);
    }
  };

  const doDownload = async () => {
    try {
      await downloadAll(attachments);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa tải được file phiếu nộp. Bạn thử lại sau ít phút."));
    }
  };

  const st = STATUS[s.status];
  const decidable = canApprove && s.latest;

  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] | undefined;
  if (s.status === "submitted" && decidable && s.actions.includes("approve")) {
    secondary = [{ label: "Trả lại", icon: Undo2, onClick: () => setDialog("return"), disabled: busy }];
    primary = { label: "Phê duyệt", icon: CircleCheck, onClick: () => setDialog("approve"), loading: busy };
  }

  const items: ActionItem[] = [
    {
      key: "export",
      label: exporting ? "Đang xuất Excel…" : "Xuất Excel",
      icon: Download,
      onSelect: () => void doExport(),
      disabled: !current || exporting,
      reason: !current ? "Bảng biểu chưa mở xong." : undefined,
    },
    {
      key: "files",
      label: "Tải phiếu nộp",
      icon: FileDown,
      disabled: attachments.length === 0,
      reason: attachments.length === 0 ? "Lần nộp này không có file đính kèm." : undefined,
      onSelect: () => void doDownload(),
    },
    {
      key: "history",
      label: "Xem lịch sử nộp",
      icon: History,
      onSelect: () => navigate(`/annual-review/history?nam=${s.year}`),
    },
    ...(s.status === "approved" && decidable && s.actions.includes("reopen")
      ? [
          {
            key: "reopen",
            label: "Mở lại báo cáo năm",
            icon: RotateCcw,
            destructive: true,
            separatorBefore: true,
            disabled: busy,
            onSelect: () => setDialog("reopen"),
          } satisfies ActionItem,
        ]
      : []),
  ];

  let body: ReactNode;
  if (sheets.length === 0) {
    body = (
      <EmptyState
        icon={FileSpreadsheet}
        title="Phiếu chưa có biểu nào"
        description="Lần nộp này không ghim được biểu tổng hợp năm nào."
      />
    );
  } else if (runtimeQuery.isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Chưa mở được biểu"
        description={errorMessage(runtimeQuery.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
        action={
          <Button type="button" variant="outline" onClick={() => void runtimeQuery.refetch()}>
            <RotateCw aria-hidden />
            Thử lại
          </Button>
        }
      />
    );
  } else if (!current) {
    body = <LoadingState label="Đang dựng bảng số liệu năm…" hint="Năm có nhiều kỳ nên có thể mất vài giây." />;
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
        <SpreadWorkbook
          key={`${s.id}-${current.templateId}`}
          workbook={workbook}
          readOnly
          hideTabs
          scriptText={current.scriptText}
          scriptContext={scriptContext}
          onReady={(api) => {
            apiRef.current = api;
          }}
          onScriptResult={(result) => {
            if (!result.ok) {
              console.warn("Script biểu năm báo lỗi:", result.messages);
              toast.warning(
                `Một số ô của biểu ${current.shortName} chưa đổ được số liệu. Vui lòng báo người quản trị mẫu biểu kiểm tra.`
              );
            }
          }}
          className="h-full min-h-[360px] flex-1"
        />
      </div>
    );
  }

  return (
    <AsxhPage
      title={`Báo cáo năm ${s.year} · Phiếu ${s.revisionNo}`}
      badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
      description={<span className="block truncate" title={statusLine(s)}>{statusLine(s)}</span>}
      backTo={backTo}
      actions={<HeaderActions primary={primary} secondary={secondary} items={items} />}
      fill
    >
      <FullscreenFrame full={full} onExit={exitFull}>
        <section className="bg-card text-card-foreground flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-e1">
          <div className="flex min-h-0 flex-1 flex-col p-4">{body}</div>
          <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2">
            <SheetTabs
              tabs={sheets.map((t) => ({ key: String(t.templateId), label: t.shortName }))}
              value={sheet ? String(sheet.templateId) : ""}
              onChange={(key) => {
                apiRef.current = null;
                setSheetKey(key);
              }}
              maxVisible={6}
              overflowLabel={(n) => `+${n} biểu khác`}
              trailing={<FullscreenButton full={full} onToggle={() => setFull((f) => !f)} />}
            />
          </div>
        </section>
      </FullscreenFrame>

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Phê duyệt báo cáo năm ${s.year}?`}
        description={`Sau khi duyệt, số liệu các kỳ và cả năm ${s.year} được chốt. Sở không sửa được nữa, trừ khi báo cáo được mở lại.`}
        confirmLabel={`Phê duyệt báo cáo năm ${s.year}`}
        onConfirm={() => {
          void decide("approve").then((failure) => {
            if (failure) toast.error(failure);
          });
        }}
      />
      <ReasonDialog
        open={dialog === "return"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Trả lại báo cáo năm ${s.year}`}
        description="Sở Tài chính sẽ nhận được lý do này, mở khoá số liệu năm để sửa và nộp lại."
        label="Lý do trả lại"
        placeholder="Ghi rõ biểu, dòng cần sửa để Sở điều chỉnh lại số liệu"
        confirmLabel={`Trả lại báo cáo năm ${s.year}`}
        emptyError="Hãy ghi lý do trả lại để Sở biết cần sửa gì."
        onConfirm={(reason) => decide("return", reason)}
      />
      <ReasonDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Mở lại báo cáo năm ${s.year} đã duyệt?`}
        description={`Số liệu năm ${s.year} được mở khoá để Sở sửa. Phiếu ${s.revisionNo} chuyển sang UBND trả lại, Sở cần nộp lại sau khi sửa xong.`}
        label="Lý do mở lại"
        placeholder="Ví dụ: phát hiện sai số ở biểu 1b của Quý II/2026"
        confirmLabel={`Mở lại báo cáo năm ${s.year}`}
        emptyError="Hãy ghi lý do mở lại để Sở biết cần sửa gì."
        onConfirm={(reason) => decide("reopen", reason)}
      />
    </AsxhPage>
  );
}
