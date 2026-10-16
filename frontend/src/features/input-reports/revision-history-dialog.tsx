import { Eye } from "lucide-react";

import { StatusBadge } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { InputReport } from "./model";

/**
 * Hộp "Lịch sử phiên bản" (UC-44, Figma 309:22174): dòng thời gian mới → cũ,
 * chấm + vạch nối; bản đang xem gắn nhãn "Đang xem", bản khác có nút "Xem"
 * cùng cỡ; lý do trả lại trong ô nền nhạt; chân có nút Đóng.
 */
export function RevisionHistoryDialog({
  report,
  open,
  onOpenChange,
  viewingRevision,
  onView,
}: {
  report: InputReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phiên bản đang mở; bỏ trống = phiên bản mới nhất. */
  viewingRevision?: number;
  onView: (revision: number) => void;
}) {
  const current = viewingRevision ?? report?.revision;
  const history = report?.history ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Lịch sử phiên bản</DialogTitle>
          <DialogDescription>
            {report
              ? `${report.periodName} · ${report.orgName} · ${history.length} phiên bản`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-[60vh] overflow-y-auto px-6 pb-6">
          {history.map((entry, index) => {
            const isCurrent = entry.no === current;
            const isLast = index === history.length - 1;
            return (
              <li key={entry.no} className={cn("relative flex gap-3", !isLast && "pb-5")}>
                {/* Chấm + vạch nối sang phiên bản cũ hơn */}
                <div className="relative flex w-2.5 shrink-0 justify-center">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-3 size-2.5 rounded-full",
                      isCurrent ? "bg-primary" : "bg-muted-foreground"
                    )}
                  />
                  {!isLast && (
                    <span aria-hidden className="absolute top-6 -bottom-2 w-px bg-border" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Phiên bản {entry.no}</span>
                    <StatusBadge tone={entry.tone}>{entry.statusLabel}</StatusBadge>
                    <div className="ms-auto">
                      {isCurrent ? (
                        <span className="inline-flex h-8 w-24 items-center justify-center gap-1.5 rounded-md bg-info-subtle text-xs font-medium text-info-text">
                          <Eye className="size-4" />
                          Đang xem
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-24"
                          onClick={() => onView(entry.no)}
                        >
                          <Eye />
                          Xem
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.meta}</p>
                  {entry.reason && (
                    <p className="mt-2 rounded-md border bg-surface-subtle px-3 py-2 text-sm">
                      Lý do: {entry.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
