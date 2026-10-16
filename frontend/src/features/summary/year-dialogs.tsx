import type { LucideIcon } from "lucide-react";
import { CircleCheck, CircleX, RotateCcw, Send, Undo2 } from "lucide-react";
import { Link } from "react-router";

import { formatDateTime } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

import type { YearSubmission } from "./fixtures";

/** "Chưa nộp được báo cáo năm N": nêu đúng biểu nào của kỳ nào còn đang sửa dở. */
export function SubmitBlockedDialog({
  open,
  onOpenChange,
  year,
  title,
  message,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  title: string;
  message: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chưa nộp được báo cáo năm {year}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-subtle text-destructive-text flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm"
        >
          <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="font-medium">{title}</p>
            <p>{message}</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Quay lại
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type HistoryEvent = {
  key: string;
  at: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  by: string;
  detail: string;
  submissionId: string;
};

function toEvents(submissions: YearSubmission[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const s of submissions) {
    events.push({
      key: `${s.id}-nop`,
      at: s.submittedAt,
      icon: Send,
      tone: "bg-accent text-accent-foreground",
      title: `Nộp phiếu ${s.revisionNo}`,
      by: s.submittedBy,
      detail: `Số văn bản ${s.docNo} · ${s.files.length > 0 ? `${s.files.length} file đính kèm` : "không có file đính kèm"}`,
      submissionId: s.id,
    });
    if (s.decidedAt && s.status === "da-duyet") {
      events.push({
        key: `${s.id}-duyet`,
        at: s.decidedAt,
        icon: CircleCheck,
        tone: "bg-success-subtle text-success-text",
        title: `UBND duyệt phiếu ${s.revisionNo}`,
        by: s.decidedBy ?? "",
        detail: "Số liệu năm đã chốt",
        submissionId: s.id,
      });
    }
    if (s.decidedAt && s.status === "tra-lai") {
      events.push({
        key: `${s.id}-tralai`,
        at: s.decidedAt,
        icon: s.reopened ? RotateCcw : Undo2,
        tone: "bg-destructive-subtle text-destructive-text",
        title: `UBND ${s.reopened ? "mở lại" : "trả lại"} phiếu ${s.revisionNo}`,
        by: s.decidedBy ?? "",
        detail: `Lý do: ${s.reason ?? "—"}`,
        submissionId: s.id,
      });
    }
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** "Lịch sử nộp báo cáo năm N": các lần Sở nộp và quyết định của UBND, mới nhất ở trên. */
export function SubmissionHistoryDialog({
  open,
  onOpenChange,
  year,
  submissions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  submissions: YearSubmission[];
}) {
  const events = toEvents(submissions);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lịch sử nộp báo cáo năm {year}</DialogTitle>
          <DialogDescription>
            Các lần Sở nộp báo cáo năm và quyết định của UBND, mới nhất ở trên.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex max-h-[60svh] flex-col gap-4 overflow-y-auto">
          {events.map((e) => {
            const Icon = e.icon;
            return (
              <li key={e.key} className="flex gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    e.tone
                  )}
                >
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(e.at)} · {e.by}
                  </span>
                  <span>{e.detail}</span>
                  <Link
                    to={`/annual-review/${e.submissionId}`}
                    className="text-primary w-fit text-sm font-medium underline underline-offset-4"
                  >
                    Xem phiếu
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
