import { useCallback, useMemo, useState } from "react";
import {
  CircleCheck,
  Download,
  FileDown,
  FileSearch,
  History,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  formatDate,
  formatDateTime,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { STATUS, type AnnualSubmission } from "./fixtures";
import { FullscreenButton, FullscreenFrame } from "./fullscreen-frame";
import { ReasonDialog } from "./decision-dialogs";
import {
  PERIOD_SHEETS,
  YEAR_SHEET,
  buildYearAppendixSheet,
  buildYearSummarySheet,
} from "./sheets";
import { decisions, isLatest, useSubmissions } from "./store";

const TABS = [YEAR_SHEET, ...PERIOD_SHEETS];

/** Dòng phụ dưới tiêu đề: ai nộp / ai quyết định, khi nào, văn bản nào. */
function statusLine(s: AnnualSubmission): string {
  const doc = `Văn bản ${s.docNo} ngày ${formatDate(s.docDate)}`;
  if (s.status === "da-duyet") {
    return `UBND đã duyệt ${formatDateTime(s.decidedAt ?? "")} · ${s.decidedBy ?? ""} · Sở nộp ${formatDate(s.submittedAt)} · ${doc}`;
  }
  if (s.status === "tra-lai") {
    return `UBND ${s.reopened ? "mở lại" : "trả lại"} ${formatDateTime(s.decidedAt ?? "")} · Lý do: ${s.reason ?? "—"}`;
  }
  return `Sở Tài chính nộp ${formatDateTime(s.submittedAt)} · ${s.submittedBy} · ${doc}`;
}

/**
 * Xem phiếu báo cáo năm (UBND duyệt): bảng biểu năm chỉ đọc, đúng phiên bản số
 * liệu đã ghim khi nộp. Chờ duyệt → [Trả lại] [Phê duyệt]; đã duyệt → chỉ ⋯
 * với "Mở lại báo cáo năm" (đỏ, cuối menu).
 */
export function AnnualReviewWork() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const submissions = useSubmissions();
  const [sheetKey, setSheetKey] = useState(YEAR_SHEET.key);
  const [dialog, setDialog] = useState<"approve" | "return" | "reopen" | null>(null);
  const [full, setFull] = useState(false);
  const exitFull = useCallback(() => setFull(false), []);

  const backTo = params.get("from") === "history" ? "/annual-review/history" : "/annual-review";
  const s = submissions.find((x) => x.id === id);

  const sheet = useMemo(() => {
    if (!s) return null;
    const def = TABS.find((t) => t.key === sheetKey) ?? YEAR_SHEET;
    return def.key === YEAR_SHEET.key
      ? buildYearSummarySheet(s.year)
      : buildYearAppendixSheet(def, s.year);
  }, [s, sheetKey]);

  if (!s || !sheet) {
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

  const latest = isLatest(submissions, s);
  const st = STATUS[s.status];

  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] | undefined;
  if (s.status === "cho-duyet" && latest) {
    secondary = [{ label: "Trả lại", icon: Undo2, onClick: () => setDialog("return") }];
    primary = { label: "Phê duyệt", icon: CircleCheck, onClick: () => setDialog("approve") };
  }

  const items: ActionItem[] = [
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      onSelect: () =>
        toast.success(`Đã xuất Excel báo cáo năm ${s.year} · Phiếu ${s.revisionNo}.`),
    },
    {
      key: "files",
      label: "Tải phiếu nộp",
      icon: FileDown,
      disabled: s.files.length === 0,
      reason: s.files.length === 0 ? "Lần nộp này không có file đính kèm." : undefined,
      onSelect: () => toast.success(`Đang tải ${s.files.map((f) => f.name).join(", ")}.`),
    },
    {
      key: "history",
      label: "Xem lịch sử nộp",
      icon: History,
      onSelect: () => navigate(`/annual-review/history?nam=${s.year}`),
    },
    ...(s.status === "da-duyet" && latest
      ? [
          {
            key: "reopen",
            label: "Mở lại báo cáo năm",
            icon: RotateCcw,
            destructive: true,
            onSelect: () => setDialog("reopen"),
          } satisfies ActionItem,
        ]
      : []),
  ];

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
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
              <SpreadsheetView sheet={sheet} readOnly />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2">
            <SheetTabs
              tabs={TABS.map((t) => ({ key: t.key, label: t.short }))}
              value={sheetKey}
              onChange={setSheetKey}
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
          decisions.approve(s.id);
          toast.success(`Đã phê duyệt báo cáo năm ${s.year}.`);
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
        onConfirm={(reason) => {
          decisions.returnReport(s.id, reason);
          toast.success(`Đã trả lại báo cáo năm ${s.year} cho Sở Tài chính.`);
        }}
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
        onConfirm={(reason) => {
          decisions.reopen(s.id, reason);
          toast.success(`Đã mở lại báo cáo năm ${s.year} — Sở sửa số liệu rồi gửi lại.`);
        }}
      />
    </AsxhPage>
  );
}
