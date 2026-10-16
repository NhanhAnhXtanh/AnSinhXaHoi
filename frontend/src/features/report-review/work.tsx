import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  CircleCheck,
  Download,
  FileSearch,
  History,
  Maximize,
  Minimize,
  Paperclip,
  Reply,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  WorkCard,
  formatDate,
  formatDateTime,
  type ActionItem,
  type StatusTone,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { ApproveErrorDialog } from "./components/approve-error-dialog";
import { ReturnDialog } from "./components/return-dialog";
import { TreasuryDialog } from "./components/treasury-dialog";
import { VersionHistoryDialog } from "./components/version-history-dialog";
import { SHEET_DEFS, type ReviewReport } from "./fixtures";
import {
  NO_DATA_REASON,
  STATUS_META,
  TOTAL_SHEETS,
  buildSheet,
  exportFileName,
  hasNoData,
} from "./model";
import { approveReport, returnReport, useReviewReport } from "./store";

const LIST_PATH = "/report-review";
const APPROVE_DELAY_MS = 700;

type Header = { badge: { tone: StatusTone; label: string }; meta: string };

/** Badge + dòng phụ của phiếu đang xem (bản đang xử lý hoặc một bản đã bị trả lại). */
function headerOf(r: ReviewReport, viewingNo: number): Header {
  const currentNo = r.previousVersions.length + 1;
  const progress = `${r.doneSheets}/${TOTAL_SHEETS} biểu`;

  if (viewingNo < currentNo) {
    const v = r.previousVersions.find((x) => x.no === viewingNo);
    return {
      badge: { tone: "destructive", label: "Bị trả lại" },
      meta: v
        ? `Đã nộp ${formatDateTime(v.submittedAt)} · Phiên bản ${v.no} · Sở trả lại ${formatDate(v.returnedAt)} · Lý do: ${v.reason} · Chỉ xem`
        : `Phiên bản ${viewingNo} · Chỉ xem`,
    };
  }

  const submitted = r.submittedAt
    ? `Đã nộp ${formatDateTime(r.submittedAt)} · Phiên bản ${currentNo} · ${progress}`
    : "";

  switch (r.status) {
    case "pending":
      return { badge: { tone: "warning", label: "Chờ duyệt" }, meta: submitted };
    case "approved":
      return r.period.closed
        ? {
            badge: { tone: "locked", label: "Đã chốt" },
            meta: `${submitted} · Sở duyệt ${formatDate(r.approvedAt ?? "")} · Kỳ đã chốt số liệu, chỉ xem`,
          }
        : {
            badge: { tone: "success", label: "Đã phê duyệt" },
            meta: `${submitted} · Sở duyệt ${formatDate(r.approvedAt ?? "")} · số liệu đã ghi nhận`,
          };
    case "returned":
      return {
        badge: { tone: "destructive", label: STATUS_META.returned.label },
        meta: `${submitted} · Sở trả lại ${formatDate(r.returnedAt ?? "")} · Lý do: ${r.returnReason ?? ""}`,
      };
    case "notSubmitted":
      return {
        badge: { tone: "neutral", label: STATUS_META.notSubmitted.label },
        meta: `Chưa nộp · Hạn nộp ${formatDate(r.period.deadline)} · Đơn vị mới nhập ${progress} · Chỉ xem`,
      };
  }
}

/**
 * Xem phiếu (Sở): bảng tính chỉ đọc từng biểu, tab biểu ở chân thẻ. Phiếu Chờ
 * duyệt có hai nút Trả lại / Phê duyệt; các trạng thái khác chỉ còn menu ⋯.
 */
export function ReviewWork() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const report = useReviewReport(id);

  const [sheetCode, setSheetCode] = useState(SHEET_DEFS[0]?.code ?? "1a");
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const approveTimer = useRef<number | undefined>(undefined);

  const anyDialogOpen =
    approveOpen || returnOpen || errorOpen || treasuryOpen || historyOpen;

  useEffect(() => () => window.clearTimeout(approveTimer.current), []);

  // Esc thoát toàn màn hình (khi không có hộp thoại nào đang mở).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !anyDialogOpen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, anyDialogOpen]);

  if (!report) {
    return (
      <AsxhPage title="Không tìm thấy phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={FileSearch}
          title="Không tìm thấy phiếu để xử lý"
          description="Phiếu có thể đã bị xoá hoặc đường dẫn không đúng. Quay lại danh sách để chọn phiếu khác."
          action={
            <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>
              Về danh sách phiếu
            </Button>
          }
        />
      </AsxhPage>
    );
  }

  const currentNo = report.previousVersions.length + 1;
  const requested = Number(searchParams.get("phienban"));
  const viewingNo =
    Number.isInteger(requested) && requested >= 1 && requested <= currentNo
      ? requested
      : currentNo;
  const viewingOld = viewingNo < currentNo;
  const canReview = report.status === "pending" && !viewingOld;
  const { badge, meta } = headerOf(report, viewingNo);

  const runApprove = () => {
    setApproving(true);
    window.clearTimeout(approveTimer.current);
    approveTimer.current = window.setTimeout(() => {
      setApproving(false);
      if (approveReport(report.id)) {
        toast.success(`Đã phê duyệt phiếu ${report.period.name} của ${report.orgName}.`);
        navigate(LIST_PATH);
      } else {
        setErrorOpen(true);
      }
    }, APPROVE_DELAY_MS);
  };

  const items: ActionItem[] = [
    {
      key: "treasury",
      label: "Xem file xác nhận kho bạc",
      icon: Paperclip,
      disabled: report.treasuryFiles.length === 0,
      reason:
        report.treasuryFiles.length === 0 ? "Đơn vị chưa nộp phiếu nên chưa có file" : undefined,
      onSelect: () => setTreasuryOpen(true),
    },
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      disabled: hasNoData(report),
      reason: hasNoData(report) ? NO_DATA_REASON : undefined,
      onSelect: () => toast.success(`Đã tải về tệp ${exportFileName(report, viewingNo)}.`),
    },
    {
      key: "history",
      label: "Lịch sử phiên bản",
      icon: History,
      onSelect: () => setHistoryOpen(true),
    },
  ];

  const tabs = SHEET_DEFS.map((s, i) => ({
    key: s.code,
    label: s.code,
    done: i < report.doneSheets,
  }));

  const card = (
    <WorkCard
      backTo={LIST_PATH}
      className={fullscreen ? "h-full" : undefined}
      title={`${report.period.name} — ${report.orgName}`}
      badge={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
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
                disabled: approving,
                onClick: () => setReturnOpen(true),
              },
            ]}
            primary={{
              label: "Phê duyệt",
              icon: CircleCheck,
              loading: approving,
              onClick: () => setApproveOpen(true),
            }}
            items={items}
          />
        ) : (
          <HeaderActions items={items} />
        )
      }
      footer={
        <SheetTabs
          tabs={tabs}
          value={sheetCode}
          onChange={setSheetCode}
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
      }
    >
      <SpreadsheetView sheet={buildSheet(report, sheetCode)} readOnly minRows={40} />
    </WorkCard>
  );

  return (
    <>
      {fullscreen ? (
        <div className="bg-background fixed inset-0 z-40 flex flex-col p-4">{card}</div>
      ) : (
        card
      )}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Phê duyệt phiếu?"
        description={`Phiếu ${report.period.name} của ${report.orgName} sẽ được duyệt. Số liệu của phiếu sẽ được ghi nhận và dùng để tổng hợp.`}
        confirmLabel="Phê duyệt phiếu"
        onConfirm={runApprove}
      />

      <ApproveErrorDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        onRetry={() => {
          setErrorOpen(false);
          runApprove();
        }}
      />

      <ReturnDialog
        report={report}
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onConfirm={(reason) => {
          setReturnOpen(false);
          if (returnReport(report.id, reason)) {
            toast.success(`Đã trả lại phiếu cho ${report.orgName}.`);
            navigate(LIST_PATH);
          }
        }}
      />

      <TreasuryDialog report={report} open={treasuryOpen} onOpenChange={setTreasuryOpen} />

      <VersionHistoryDialog
        report={report}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        viewingNo={viewingNo}
        onView={(no) => {
          setHistoryOpen(false);
          setSearchParams(no === currentNo ? {} : { phienban: String(no) }, { replace: true });
        }}
      />
    </>
  );
}
