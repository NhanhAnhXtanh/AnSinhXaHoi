import { Eye } from "lucide-react";

import { StatusBadge, formatDateTime, type StatusTone } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

import type { ReviewReport } from "../fixtures";
import { STATUS_META } from "../model";

export type VersionEntry = {
  no: number;
  label: string;
  tone: StatusTone;
  detail: string;
  reason?: string;
};

/** Mọi phiên bản của phiếu, mới → cũ. Bản cuối là bản đang xử lý. */
export function versionsOf(r: ReviewReport): VersionEntry[] {
  const old: VersionEntry[] = r.previousVersions.map((v) => ({
    no: v.no,
    label: "Bị trả lại",
    tone: "destructive",
    detail: `Nộp ngày ${formatDateTime(v.submittedAt)} · Sở trả lại ngày ${formatDateTime(v.returnedAt)}`,
    reason: v.reason,
  }));

  const currentNo = r.previousVersions.length + 1;
  const meta = STATUS_META[r.status];
  let detail = "Đơn vị đang nhập số liệu, chưa nộp";
  if (r.submittedAt) {
    detail = `Nộp ngày ${formatDateTime(r.submittedAt)}`;
    if (r.status === "approved" && r.approvedAt) {
      detail += ` · Sở duyệt ngày ${formatDateTime(r.approvedAt)}`;
    }
    if (r.status === "returned" && r.returnedAt) {
      detail += ` · Sở trả lại ngày ${formatDateTime(r.returnedAt)}`;
    }
  }
  const current: VersionEntry = {
    no: currentNo,
    label: r.status === "returned" ? "Bị trả lại" : meta.label,
    tone: meta.tone,
    detail,
    reason: r.status === "returned" ? r.returnReason : undefined,
  };

  return [current, ...old.reverse()];
}

export function VersionHistoryDialog({
  report,
  open,
  onOpenChange,
  viewingNo,
  onView,
}: {
  report: ReviewReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phiên bản đang mở trên màn; bỏ trống khi mở từ danh sách. */
  viewingNo?: number;
  onView: (no: number) => void;
}) {
  const versions = versionsOf(report);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>Lịch sử phiên bản</DialogTitle>
          <DialogDescription>
            {report.period.name} · {report.orgName} · {versions.length} phiên bản
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col px-6 pb-5">
          {versions.map((v, i) => {
            const isLast = i === versions.length - 1;
            const isViewing = v.no === viewingNo;
            return (
              <li key={v.no} className="flex gap-3">
                <div className="flex w-2 shrink-0 flex-col items-center pt-2.5">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      i === 0 ? "bg-primary" : "bg-muted-foreground/50"
                    )}
                  />
                  {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
                </div>
                <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", !isLast && "pb-4")}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Phiên bản {v.no}</span>
                    <StatusBadge tone={v.tone}>{v.label}</StatusBadge>
                    {isViewing ? (
                      <span
                        aria-current="true"
                        className="bg-accent text-accent-foreground ms-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"
                      >
                        <Eye className="size-4" />
                        Đang xem
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ms-auto"
                        onClick={() => onView(v.no)}
                      >
                        <Eye />
                        Xem
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{v.detail}</p>
                  {v.reason && (
                    <p className="bg-surface-subtle rounded-md border px-3 py-2 text-sm">
                      Lý do: {v.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="bg-surface-subtle flex justify-end rounded-b-lg border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
