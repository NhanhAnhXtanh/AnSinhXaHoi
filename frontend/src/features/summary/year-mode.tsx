import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Eye, FileSpreadsheet, History, Send } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  EmptyState,
  HeaderActions,
  MasterDetailLayout,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  WorkCard,
  formatDate,
  formatDateTime,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import {
  CURRENT_USER,
  PERIOD_SHEETS,
  YEAR_SHEET,
  YEAR_STATUS,
  type SummaryPeriod,
  type YearReport,
  type YearStatus,
} from "./fixtures";
import { FullscreenButton, FullscreenFrame } from "./fullscreen-frame";
import { buildYearAppendixSheet, buildYearSummarySheet } from "./sheet-builder";
import { SubmitYearDialog, type SubmitYearInput } from "./submit-year-dialog";
import { joinVi, nowIso } from "./utils";
import { SubmissionHistoryDialog, SubmitBlockedDialog } from "./year-dialogs";

export function yearStatusOf(report: YearReport | undefined): YearStatus {
  const latest = report?.submissions[report.submissions.length - 1];
  return latest?.status ?? "dang-soan";
}

const YEAR_TABS = [YEAR_SHEET, ...PERIOD_SHEETS];

/**
 * Chế độ "Theo năm": danh sách năm bên trái, biểu tổng hợp năm (01 và các phụ
 * lục) bên phải, chỉ xem. Một nút đổi vai theo trạng thái báo cáo năm:
 * Nộp báo cáo năm → Xem phiếu → (UBND trả lại) Gửi lại.
 */
export function YearMode({
  year,
  onYearChange,
  reports,
  onReportsChange,
  periods,
}: {
  year: number;
  onYearChange: (y: number) => void;
  reports: YearReport[];
  onReportsChange: (updater: (prev: YearReport[]) => YearReport[]) => void;
  /** Kỳ của năm đang có dữ liệu mẫu (để đếm kỳ đã lưu và kiểm biểu đang sửa dở). */
  periods: SummaryPeriod[];
}) {
  const navigate = useNavigate();
  const [sheetKey, setSheetKey] = useState(YEAR_SHEET.key);
  const [dialog, setDialog] = useState<"submit" | "blocked" | "history" | null>(null);
  const [full, setFull] = useState(false);
  const exitFull = useCallback(() => setFull(false), []);

  const report = reports.find((r) => r.year === year);
  const status = yearStatusOf(report);
  const latest = report?.submissions[report.submissions.length - 1];

  const sheet = useMemo(() => {
    const def = YEAR_TABS.find((s) => s.key === sheetKey) ?? YEAR_SHEET;
    return def.key === YEAR_SHEET.key
      ? buildYearSummarySheet(year)
      : buildYearAppendixSheet(def, year);
  }, [sheetKey, year]);

  const list = (
    <section className="bg-card text-card-foreground flex h-full min-h-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <div className="flex items-center justify-between gap-2 border-b px-5 pt-5 pb-3.5">
        <h2 className="text-base leading-6 font-semibold">Năm báo cáo</h2>
        <span className="text-muted-foreground text-[13px] leading-5">{reports.length} năm</span>
      </div>
      <div role="listbox" aria-label="Năm báo cáo" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {reports.map((r) => {
          const selected = r.year === year;
          const st = YEAR_STATUS[yearStatusOf(r)];
          return (
            <button
              key={r.year}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onYearChange(r.year)}
              className={cn(
                "relative flex min-h-14 w-full shrink-0 items-center justify-between gap-2 rounded-md py-2 ps-3.5 pe-2.5 text-left",
                "transition-colors duration-150 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                selected ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              {selected && (
                <span
                  aria-hidden
                  className="bg-primary absolute top-1/2 left-0 h-7 w-0.75 -translate-y-1/2 rounded-sm"
                />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-foreground truncate text-sm leading-5 font-medium">
                  Năm {r.year}
                </span>
                <span className="text-muted-foreground truncate text-xs leading-4">
                  01/01 – 31/12/{r.year}
                </span>
              </span>
              <StatusBadge tone={st.tone} className="shrink-0">
                {st.label}
              </StatusBadge>
            </button>
          );
        })}
      </div>
    </section>
  );

  if (!report) {
    return (
      <MasterDetailLayout aside={list}>
        <WorkCard title={`Báo cáo năm ${year}`}>
          <EmptyState
            icon={FileSpreadsheet}
            title={`Năm ${year} chưa có biểu tổng hợp năm nào được ban hành`}
            description="Chọn một năm ở danh sách bên trái để xem báo cáo năm."
          />
        </WorkCard>
      </MasterDetailLayout>
    );
  }

  // Năm hiện tại đếm từ danh sách kỳ; năm đã qua dùng số đã ghi.
  const closed = periods.filter((p) => p.status === "da-chot");
  const savedCount = periods.length > 0 ? closed.filter((p) => p.versions.length > 0).length : report.savedPeriods;
  const closedCount = periods.length > 0 ? closed.length : report.closedPeriods;

  // Biểu kỳ còn đang sửa dở → chưa nộp được.
  const drafts = periods.filter((p) => p.draft !== null);
  const blockedMessage =
    drafts.length > 0
      ? `Còn ${joinVi(
          drafts.map((p) =>
            p.draft && p.draft.length > 0 ? `biểu ${joinVi(p.draft)} của ${p.name}` : `số liệu ${p.name}`
          )
        )} đang sửa dở. Hoàn tất các biểu này rồi bấm ${status === "tra-lai" ? "Gửi lại" : "Nộp báo cáo năm"}.`
      : "";

  const startSubmit = () => setDialog(drafts.length > 0 ? "blocked" : "submit");

  const doSubmit = (input: SubmitYearInput) => {
    const revisionNo = (latest?.revisionNo ?? 0) + 1;
    onReportsChange((prev) =>
      prev.map((r): YearReport =>
        r.year !== year
          ? r
          : {
              ...r,
              submissions: [
                ...r.submissions,
                {
                  id: `nam-${year}-phieu-${revisionNo}`,
                  revisionNo,
                  docNo: input.docNo,
                  docDate: input.docDate,
                  submittedAt: nowIso(),
                  submittedBy: CURRENT_USER,
                  files: input.files,
                  versionNo: r.versionNo,
                  status: "cho-duyet",
                },
              ],
            }
      )
    );
    toast.success(`Đã nộp Phiếu ${revisionNo} báo cáo năm ${year} lên UBND.`);
  };

  // ------------------------------------------------------------ Đầu thẻ
  let primary: PrimaryAction | undefined;
  if (status === "dang-soan" || status === "tra-lai") {
    const noneSaved = savedCount === 0;
    primary = {
      label: status === "tra-lai" ? "Gửi lại" : "Nộp báo cáo năm",
      icon: Send,
      onClick: startSubmit,
      disabled: noneSaved,
      reason: noneSaved
        ? "Năm này chưa có kỳ nào lưu số liệu — chốt đợt báo cáo ở Theo kỳ trước khi nộp."
        : undefined,
    };
  } else if (latest) {
    primary = {
      label: "Xem phiếu",
      icon: Eye,
      onClick: () => navigate(`/annual-review/${latest.id}`),
    };
  }

  const items: ActionItem[] = [
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      onSelect: () =>
        toast.success(
          `Đã xuất Excel biểu ${YEAR_TABS.find((s) => s.key === sheetKey)?.short ?? sheetKey} · Năm ${year}.`
        ),
    },
    {
      key: "history",
      label: "Lịch sử nộp báo cáo năm",
      icon: History,
      onSelect: () => setDialog("history"),
      disabled: report.submissions.length === 0,
      reason: report.submissions.length === 0 ? "Năm này chưa nộp lần nào." : undefined,
    },
  ];

  let meta: ReactNode;
  if (status === "dang-soan") {
    meta = `Số liệu tổng hợp · Phiên bản ${report.versionNo} · ${savedCount}/${closedCount} kỳ đã lưu số liệu · Cập nhật ${formatDateTime(report.updatedAt)}`;
  } else if (status === "cho-duyet" && latest) {
    meta = `Đã nộp ${formatDateTime(latest.submittedAt)} · năm bị khoá, không sửa được số liệu`;
  } else if (status === "da-duyet" && latest) {
    meta = `UBND đã duyệt ${formatDate(latest.decidedAt ?? latest.submittedAt)} · số liệu năm đã chốt, không sửa được`;
  } else if (status === "tra-lai" && latest) {
    meta = `UBND ${latest.reopened ? "mở lại" : "trả lại"} ${formatDate(latest.decidedAt ?? latest.submittedAt)} · Lý do: ${latest.reason ?? "—"}`;
  }

  const st = YEAR_STATUS[status];

  return (
    <MasterDetailLayout aside={list}>
      <FullscreenFrame full={full} onExit={exitFull}>
        <WorkCard
          title={`Báo cáo năm ${year}`}
          badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
          meta={<span className="block truncate" title={typeof meta === "string" ? meta : undefined}>{meta}</span>}
          actions={<HeaderActions primary={primary} items={items} />}
          footer={
            <SheetTabs
              tabs={YEAR_TABS.map((s) => ({ key: s.key, label: s.short }))}
              value={sheetKey}
              onChange={setSheetKey}
              maxVisible={6}
              overflowLabel={(n) => `+${n} biểu khác`}
              trailing={<FullscreenButton full={full} onToggle={() => setFull((f) => !f)} />}
            />
          }
        >
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
              <SpreadsheetView sheet={sheet} readOnly />
            </div>
          </div>
        </WorkCard>
      </FullscreenFrame>

      <SubmitYearDialog
        open={dialog === "submit"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        resubmit={status === "tra-lai"}
        onSubmit={doSubmit}
      />
      <SubmitBlockedDialog
        open={dialog === "blocked"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        title="Số liệu chưa hoàn tất"
        message={blockedMessage}
      />
      <SubmissionHistoryDialog
        open={dialog === "history"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        submissions={report.submissions}
      />
    </MasterDetailLayout>
  );
}
