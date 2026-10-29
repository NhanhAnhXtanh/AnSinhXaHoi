import type { LucideIcon } from "lucide-react";
import { CircleCheck, CircleX, Pencil, RotateCcw, Save, Send, TriangleAlert, Undo2 } from "lucide-react";

import { LoadingState, formatDateTime } from "@/shared/components/asxh";
import { API_URL } from "@/shared/api/constants";
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

import { errorMessage, useApiArray, type DeptChangeAction, type DeptHistoryEntry } from "./api";

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

const ACTION_LOOK: Record<DeptChangeAction, { icon: LucideIcon; tone: string }> = {
  PERIOD_SAVED: { icon: Save, tone: "bg-accent text-accent-foreground" },
  SHEET_SAVED: { icon: Pencil, tone: "bg-info-subtle text-info-text" },
  RESTORED: { icon: RotateCcw, tone: "bg-warning-subtle text-warning-text" },
  YEAR_SUBMITTED: { icon: Send, tone: "bg-accent text-accent-foreground" },
  YEAR_APPROVED: { icon: CircleCheck, tone: "bg-success-subtle text-success-text" },
  YEAR_RETURNED: { icon: Undo2, tone: "bg-destructive-subtle text-destructive-text" },
  YEAR_REOPENED: { icon: RotateCcw, tone: "bg-destructive-subtle text-destructive-text" },
};

/**
 * "Lịch sử số liệu năm N" (UC-56 bước 3): mọi lần lưu số liệu kỳ, Sở sửa, khôi
 * phục, và các mốc của báo cáo năm, mới nhất ở trên.
 */
export function YearHistoryDialog({
  open,
  onOpenChange,
  year,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
}) {
  const state = useApiArray<DeptHistoryEntry>(open ? `${API_URL}/dept_years/${year}/history` : null, undefined);
  const events = state.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lịch sử số liệu năm {year}</DialogTitle>
          <DialogDescription>
            Các lần lưu, sửa số liệu tổng hợp của các kỳ và các lần nộp báo cáo năm, mới nhất ở trên.
          </DialogDescription>
        </DialogHeader>
        {state.isLoading ? (
          <LoadingState label="Đang tải lịch sử…" />
        ) : state.error ? (
          <div
            role="alert"
            className="bg-destructive-subtle text-destructive-text flex gap-2.5 rounded-lg px-3.5 py-3 text-sm"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{errorMessage(state.error, "Chưa tải được lịch sử. Bạn thử lại sau ít phút.")}</p>
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Năm {year} chưa có kỳ nào lưu số liệu.</p>
        ) : (
          <ol className="flex max-h-[60svh] flex-col gap-4 overflow-y-auto">
            {events.map((e, i) => {
              const look = ACTION_LOOK[e.action] ?? ACTION_LOOK.SHEET_SAVED;
              const Icon = look.icon;
              const detail = [
                e.sheetLabel ? `Biểu ${e.sheetLabel}` : null,
                e.versionNo !== null ? `Phiên bản ${e.versionNo}` : null,
                e.rowCount ? `${e.rowCount} ô đổi` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={`${e.occurredAt}-${i}`} className="flex gap-3">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", look.tone)}>
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                    <span className="font-semibold">
                      {e.actionLabel} · {e.scope}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(e.occurredAt)} · {e.actor}
                    </span>
                    {detail && <span>{detail}</span>}
                    {e.note && <span className="text-muted-foreground">{e.note}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
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
