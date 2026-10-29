import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useCustomMutation, useInvalidate, useList, useOne } from "@refinedev/core";
import {
  CircleCheck,
  Download,
  FileSearch,
  History,
  ListChecks,
  Maximize,
  Minimize,
  Paperclip,
  Reply,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  SheetTabs,
  StatusBadge,
  WorkCard,
  formatDate,
  formatDateTime,
  type ActionItem,
} from "@/shared/components/asxh";
import { SpreadWorkbook } from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";

import {
  JSON_HEADERS,
  REPORTS_RESOURCE,
  SHEETS_RESOURCE,
  errorMessage,
  errorStatus,
  parseWorkbook,
  reportActionUrl,
  type InputReportRecord,
  type InputReportSheetRecord,
} from "./api";
import { ActionHistoryDialog } from "./components/action-history-dialog";
import { ApproveErrorDialog } from "./components/approve-error-dialog";
import { OnBehalfStrip } from "./components/on-behalf-units";
import { useReportDataUnits } from "./components/use-report-data-units";
import { ReturnDialog } from "./components/return-dialog";
import { TreasuryDialog } from "./components/treasury-dialog";
import { VersionHistoryDialog } from "./components/version-history-dialog";
import { NO_DATA_REASON, badgeOf, hasNoData, reviewStatus } from "./model";
import { useReportExport } from "./use-report-export";

const LIST_PATH = "/report-review";
const MAX_SHEETS = 200;

/** Dòng phụ đầu thẻ của phiếu đang xem. */
function metaOf(r: InputReportRecord): string {
  const progress = `${r.progress.done}/${r.progress.total} biểu`;
  const submitted = r.submittedAt
    ? `Đã nộp ${formatDateTime(r.submittedAt)} · Phiên bản ${r.revisionNo} · ${progress}`
    : `Phiên bản ${r.revisionNo} · ${progress}`;

  switch (r.status) {
    case "SUBMITTED":
      return submitted;
    case "APPROVED":
      return r.period.status === "closed"
        ? `${submitted} · Sở duyệt ${r.approvedAt ? formatDate(r.approvedAt) : ""} · Kỳ đã chốt số liệu, chỉ xem`
        : `${submitted} · Sở duyệt ${r.approvedAt ? formatDate(r.approvedAt) : ""} · số liệu đã ghi nhận`;
    case "RETURNED":
      return `${submitted} · Sở trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · Lý do: ${r.returnReason ?? ""} · Đơn vị đang sửa`;
    case "SUPERSEDED":
      return `${submitted} · Sở trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · Lý do: ${r.returnReason ?? ""} · Bản cũ, chỉ xem`;
    case "DRAFT":
      return `Chưa nộp · Hạn nộp ${r.period.deadline ? formatDate(r.period.deadline) : "—"} · Đơn vị mới nhập ${progress} · Chỉ xem`;
    case "LOCKED":
      return r.approvedAt
        ? `${submitted} · Sở duyệt ${formatDate(r.approvedAt)} · Phiếu đã khoá, chỉ xem`
        : `${submitted} · Kỳ đã chốt, ${r.submittedAt ? "phiếu chưa được duyệt" : "đơn vị chưa nộp"} · chỉ xem`;
    case "CANCELLED":
      return `${submitted} · Phiếu đã huỷ, chỉ xem`;
  }
}

/**
 * Xem phiếu (Sở, UC-40): bảng tính chỉ đọc từng biểu, tab biểu ở chân thẻ. Phiếu
 * Chờ duyệt có hai nút Trả lại / Phê duyệt (UC-41, UC-42); các trạng thái khác
 * chỉ còn menu ⋯. Không có đường dẫn trang — theo Figma.
 */
export function ReviewWork() {
  const { id } = useParams();
  const navigate = useNavigate();
  const numericId = id && /^\d+$/.test(id) ? Number(id) : null;

  const { result: report, query } = useOne<InputReportRecord>({
    resource: REPORTS_RESOURCE,
    id: numericId ?? 0,
    queryOptions: { enabled: numericId !== null },
    errorNotification: false,
  });

  if (numericId === null || (query.isError && errorStatus(query.error) === 404)) {
    return (
      <AsxhPage title="Không tìm thấy phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={FileSearch}
          title="Không tìm thấy phiếu"
          description="Phiếu có thể đã bị thu hồi cùng kỳ báo cáo hoặc đường dẫn không đúng. Quay lại danh sách để chọn phiếu khác."
          action={
            <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>
              Về danh sách phiếu
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (query.isError) {
    return (
      <AsxhPage title="Chưa mở được phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa mở được phiếu"
          description={errorMessage(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (!report) {
    return <LoadingState variant="page" label="Đang mở phiếu…" />;
  }
  return <ReviewScreen key={report.id} report={report} />;
}

function ReviewScreen({ report }: { report: InputReportRecord }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { mutateAsync: postAction } = useCustomMutation<InputReportRecord>();
  const { exportReport, exporting } = useReportExport();
  const dataUnits = useReportDataUnits(report.id);

  const { result: sheetsResult, query: sheetsQuery } = useList<InputReportSheetRecord>({
    resource: SHEETS_RESOURCE,
    pagination: { currentPage: 1, pageSize: MAX_SHEETS, mode: "server" },
    filters: [{ field: "report.id", operator: "eq", value: report.id }],
    errorNotification: false,
  });
  const sheets = sheetsResult.data;

  const [sheetId, setSheetId] = useState<number | undefined>(undefined);
  if (sheetId === undefined && sheets.length > 0) setSheetId(sheets[0].id);
  const sheet = sheets.find((s) => s.id === sheetId);

  const { result: content, query: contentQuery } = useOne<InputReportSheetRecord>({
    resource: SHEETS_RESOURCE,
    id: sheetId ?? 0,
    queryOptions: { enabled: sheetId !== undefined },
    errorNotification: false,
  });
  const current = content !== undefined && content.id === sheetId ? content : undefined;
  const workbook = useMemo(
    () => (current ? (parseWorkbook(current.dataJson) ?? parseWorkbook(current.templateWorkbookJson)) : null),
    [current]
  );

  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [errorMessageText, setErrorMessageText] = useState<string | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState<"approve" | "return" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const anyDialogOpen = approveOpen || returnOpen || errorOpen || treasuryOpen || historyOpen || actionsOpen;

  // Esc thoát toàn màn hình (khi không có hộp thoại nào đang mở).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !anyDialogOpen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, anyDialogOpen]);

  // BR-40.2: nút sáng theo trạng thái; quyền thật máy chủ kiểm khi bấm.
  const canReview = reviewStatus(report) === "pending";
  const badge = badgeOf(report);
  const meta = metaOf(report);

  const scriptContext = useMemo(
    () => ({
      unitName: report.unit.name,
      periodName: report.period.name,
      year: report.period.year ?? Number(report.period.fromDate.slice(0, 4)),
      report: {
        reportId: String(report.id),
        sheetCode: sheet?.template.shortName ?? "",
        status: report.status,
        organizationCode: report.unit.budgetCode,
      },
    }),
    [report, sheet?.template.shortName]
  );

  const refreshQueues = () =>
    Promise.all([
      invalidate({ resource: REPORTS_RESOURCE, invalidates: ["list", "detail"], id: report.id }),
      invalidate({ resource: SHEETS_RESOURCE, invalidates: ["list"] }),
    ]);

  /** Phê duyệt (UC-41): máy chủ ghi nhận số liệu trong cùng giao dịch; lỗi thì phiếu giữ Chờ duyệt. */
  const runApprove = async () => {
    setApproveOpen(false);
    setBusy("approve");
    try {
      await postAction({
        url: reportActionUrl(report.id, "approve"),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      toast.success(`Đã phê duyệt phiếu ${report.period.name} của ${report.unit.name}.`);
      await refreshQueues();
      navigate(LIST_PATH);
    } catch (error) {
      setErrorMessageText(errorMessage(error, "") || null);
      setErrorOpen(true);
      void refreshQueues();
    } finally {
      setBusy(null);
    }
  };

  /**
   * Trả lại (UC-42): máy chủ giữ bản đang xem làm Bản cũ và sinh phiên bản mới
   * (số phiên bản + 1) ở trạng thái Bị trả lại cho đơn vị sửa.
   */
  const runReturn = async (reason: string): Promise<boolean> => {
    setBusy("return");
    try {
      const { data } = await postAction({
        url: reportActionUrl(report.id, "return"),
        method: "post",
        values: { reason },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setReturnOpen(false);
      toast.success(
        `Đã trả lại phiếu cho ${report.unit.name}. Đơn vị sẽ sửa trên phiên bản ${data.revisionNo} rồi nộp lại.`
      );
      await refreshQueues();
      navigate(LIST_PATH);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Chưa trả lại được phiếu. Bạn thử lại sau ít phút."));
      void refreshQueues();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const items: ActionItem[] = [
    {
      key: "treasury",
      label: "Xem file xác nhận kho bạc",
      icon: Paperclip,
      disabled: report.submittedAt === null,
      reason: report.submittedAt === null ? "Đơn vị chưa nộp phiếu nên chưa có file" : undefined,
      onSelect: () => setTreasuryOpen(true),
    },
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      disabled: hasNoData(report) || exporting,
      reason: hasNoData(report) ? NO_DATA_REASON : undefined,
      onSelect: () => void exportReport(report),
    },
    {
      key: "history",
      label: "Lịch sử phiên bản",
      icon: History,
      onSelect: () => setHistoryOpen(true),
    },
    {
      key: "actions",
      label: "Lịch sử thao tác",
      icon: ListChecks,
      onSelect: () => setActionsOpen(true),
    },
  ];

  const strip = <OnBehalfStrip data={dataUnits.data} submitterName={report.unit.name} />;

  const renderBody = () => {
    if (sheetsQuery.isError || contentQuery.isError) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa mở được biểu"
          description="Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void sheetsQuery.refetch();
                void contentQuery.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      );
    }
    if (!sheetsQuery.isLoading && sheets.length === 0) {
      return <EmptyState icon={FileSearch} title="Phiếu chưa có biểu nào" />;
    }
    if (!current || sheetId === undefined) {
      return <LoadingState label="Đang mở phiếu…" />;
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {strip}
        <SpreadWorkbook
          key={sheetId}
          workbook={workbook}
          readOnly
          hideTabs
          scriptText={current.scriptText ?? ""}
          scriptContext={scriptContext}
          className="h-full min-h-[360px] flex-1"
        />
      </div>
    );
  };

  const card = (
    <WorkCard
      backTo={LIST_PATH}
      className={fullscreen ? "h-full" : undefined}
      title={`${report.period.name} — ${report.unit.name}`}
      badge={
        <span className="flex items-center gap-1.5">
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          {dataUnits.onBehalf && (
            <StatusBadge tone="info" className="max-sm:hidden">
              Nhập hộ
            </StatusBadge>
          )}
        </span>
      }
      meta={
        <span className="block truncate" title={meta}>
          {meta}
        </span>
      }
      actions={
        canReview ? (
          <HeaderActions
            secondary={[
              {
                label: "Trả lại",
                icon: Reply,
                disabled: busy !== null,
                onClick: () => setReturnOpen(true),
              },
            ]}
            primary={{
              label: "Phê duyệt",
              icon: CircleCheck,
              loading: busy === "approve",
              disabled: busy !== null,
              onClick: () => setApproveOpen(true),
            }}
            items={items}
          />
        ) : (
          <HeaderActions items={items} />
        )
      }
      footer={
        sheets.length > 0 && sheetId !== undefined ? (
          <SheetTabs
            tabs={sheets.map((s) => ({
              key: String(s.id),
              label: s.template.shortName,
              done: s.completion === "COMPLETED" || s.completion === "NO_DATA",
            }))}
            value={String(sheetId)}
            onChange={(k) => setSheetId(Number(k))}
            maxVisible={8}
            trailing={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                title={fullscreen ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình"}
                onClick={() => setFullscreen((f) => !f)}
              >
                {fullscreen ? <Minimize /> : <Maximize />}
              </Button>
            }
          />
        ) : undefined
      }
    >
      {renderBody()}
    </WorkCard>
  );

  return (
    <>
      {fullscreen ? <div className="bg-background fixed inset-0 z-40 flex flex-col p-4">{card}</div> : card}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Phê duyệt phiếu?"
        description={[
          `Phiếu ${report.period.name} của ${report.unit.name} sẽ được duyệt. Số liệu của phiếu sẽ được ghi nhận và dùng để tổng hợp. Sau khi phê duyệt, phiếu không thể chỉnh sửa.`,
          dataUnits.approveNote,
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel="Phê duyệt phiếu"
        onConfirm={() => void runApprove()}
      />

      <ApproveErrorDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        message={errorMessageText}
        onRetry={() => {
          setErrorOpen(false);
          void runApprove();
        }}
      />

      <ReturnDialog
        periodName={report.period.name}
        unitName={report.unit.name}
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onConfirm={runReturn}
        pending={busy === "return"}
      />

      <TreasuryDialog
        reportId={report.id}
        periodName={report.period.name}
        unitName={report.unit.name}
        open={treasuryOpen}
        onOpenChange={setTreasuryOpen}
      />

      <VersionHistoryDialog
        report={report}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        viewingId={report.id}
        onView={(revisionId) => {
          setHistoryOpen(false);
          navigate(`/report-review/${revisionId}`);
        }}
      />

      <ActionHistoryDialog report={report} open={actionsOpen} onOpenChange={setActionsOpen} />
    </>
  );
}
