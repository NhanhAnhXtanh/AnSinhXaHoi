import { useCustom } from "@refinedev/core";
import { Eye, TriangleAlert } from "lucide-react";

import {
  EmptyState,
  LoadingState,
  StatusBadge,
  formatDateTime,
  type StatusTone,
} from "@/shared/components/asxh";
import { customResult } from "@/shared/hooks/use-custom-result";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

import { historyUrl, type InputReportHistory, type InputReportRecord } from "../api";

type Revision = InputReportHistory["revisions"][number];

function revisionBadge(r: Revision): { label: string; tone: StatusTone } {
  switch (r.status) {
    case "SUPERSEDED":
    case "RETURNED":
      return { label: "Bị trả lại", tone: "destructive" };
    case "SUBMITTED":
      return { label: "Chờ duyệt", tone: "warning" };
    case "APPROVED":
      return { label: "Đã phê duyệt", tone: "success" };
    case "LOCKED":
      // Khoá sau khi duyệt (còn ngày duyệt) vẫn là phiếu đã duyệt; không có ngày duyệt = chốt khi chưa nộp.
      return r.approvedAt
        ? { label: "Đã phê duyệt · đã khoá", tone: "success" }
        : { label: "Đã chốt", tone: "locked" };
    case "CANCELLED":
      return { label: "Đã huỷ", tone: "neutral" };
    case "DRAFT":
      return { label: "Chưa nộp", tone: "neutral" };
  }
}

function revisionDetail(r: Revision): string {
  const parts: string[] = [];
  if (r.submittedAt) parts.push(`Nộp ngày ${formatDateTime(r.submittedAt)}`);
  if (r.status === "SUPERSEDED" && r.returnedAt) parts.push(`Sở trả lại ngày ${formatDateTime(r.returnedAt)}`);
  if (r.approvedAt) parts.push(`Sở duyệt ngày ${formatDateTime(r.approvedAt)}`);
  if (parts.length === 0) {
    parts.push(r.status === "RETURNED" ? "Đơn vị đang sửa để nộp lại" : "Đơn vị đang nhập số liệu, chưa nộp");
  }
  return parts.join(" · ");
}

/**
 * Mọi phiên bản của phiếu, mới → cũ (UC-44). Mỗi lần Sở trả lại sinh một phiên
 * bản mới (BR-42.1); mỗi phiên bản có id riêng — "Xem" trả id đó để mở thẳng.
 */
export function VersionHistoryDialog({
  report,
  open,
  onOpenChange,
  viewingId,
  onView,
}: {
  report: InputReportRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phiên bản đang mở trên màn; bỏ trống khi mở từ danh sách. */
  viewingId?: number;
  onView: (revisionId: number) => void;
}) {
  const { result, query } = useCustom<InputReportHistory>({
    url: historyUrl(report.id),
    method: "get",
    queryOptions: { enabled: open },
    errorNotification: false,
  });
  const history = customResult(result?.data, "revisions");
  const versions = history?.revisions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>Lịch sử phiên bản</DialogTitle>
          <DialogDescription>
            {report.period.name} · {report.unit.name}
            {history ? ` · ${versions.length} phiên bản` : ""}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <LoadingState label="Đang tải lịch sử…" />
        ) : query.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Chưa tải được lịch sử phiếu"
            description="Bạn đóng hộp này rồi mở lại sau ít giây."
          />
        ) : (
          <ol className="flex max-h-[60vh] flex-col overflow-y-auto px-6 pb-5">
            {versions.map((v, i) => {
              const isLast = i === versions.length - 1;
              const isViewing = v.id === viewingId;
              const badge = revisionBadge(v);
              return (
                <li key={v.id} className="flex gap-3">
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
                      <span className="text-sm font-medium">Phiên bản {v.revisionNo}</span>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
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
                          onClick={() => onView(v.id)}
                        >
                          <Eye />
                          Xem
                        </Button>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{revisionDetail(v)}</p>
                    {/* Lý do nằm ở bản Sở đã chê; bản kế tiếp chỉ mang lại cùng lý do. */}
                    {v.returnReason && v.status === "SUPERSEDED" && (
                      <p className="bg-surface-subtle rounded-md border px-3 py-2 text-sm">
                        Lý do: {v.returnReason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="bg-surface-subtle flex justify-end rounded-b-lg border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
