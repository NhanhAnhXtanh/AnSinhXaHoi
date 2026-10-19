import { useCustom } from "@refinedev/core";
import { Eye, TriangleAlert } from "lucide-react";

import { EmptyState, LoadingState, StatusBadge, formatDateTime, type StatusTone } from "@/shared/components/asxh";
import { customResult } from "@/shared/hooks/use-custom-result";
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

import { historyUrl, type InputReportHistory, type InputReportRecord } from "./api";

type Revision = InputReportHistory["revisions"][number];

/** Nhãn của một phiên bản trong hộp lịch sử. Bản cũ là bản đã bị Sở trả lại. */
function revisionBadge(r: Revision): { label: string; tone: StatusTone } {
  switch (r.status) {
    case "SUPERSEDED":
      return { label: "Bị trả lại", tone: "destructive" };
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
      return { label: "Đang nhập liệu", tone: "info" };
  }
}

function revisionMeta(r: Revision): string {
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
 * Hộp "Lịch sử phiên bản" (UC-44, Figma 309:22174): dòng thời gian mới → cũ,
 * chấm + vạch nối; bản đang xem gắn nhãn "Đang xem", bản khác có nút "Xem"
 * cùng cỡ; lý do trả lại trong ô nền nhạt; chân có nút Đóng.
 *
 * Mỗi lần Sở trả lại sinh một phiên bản phiếu mới (BR-42.1), mỗi phiên bản có id
 * riêng — "Xem" trả id đó để mở thẳng.
 */
export function RevisionHistoryDialog({
  report,
  open,
  onOpenChange,
  onView,
}: {
  report: InputReportRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id phiên bản người dùng muốn xem. */
  onView: (revisionId: number) => void;
}) {
  const { result, query } = useCustom<InputReportHistory>({
    url: historyUrl(report?.id ?? 0),
    method: "get",
    queryOptions: { enabled: open && report !== null },
    errorNotification: false,
  });
  const history = customResult(result?.data, "revisions");
  const revisions = history?.revisions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Lịch sử phiên bản</DialogTitle>
          <DialogDescription>
            {report
              ? `${report.period.name} · ${report.unit.name}${history ? ` · ${revisions.length} phiên bản` : ""}`
              : ""}
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
          <ol className="max-h-[60vh] overflow-y-auto px-6 pb-6">
            {revisions.map((entry, index) => {
              const isCurrent = entry.id === report?.id;
              const isLast = index === revisions.length - 1;
              const badge = revisionBadge(entry);
              return (
                <li key={entry.id} className={cn("relative flex gap-3", !isLast && "pb-5")}>
                  {/* Chấm + vạch nối sang phiên bản cũ hơn */}
                  <div className="relative flex w-2.5 shrink-0 justify-center">
                    <span
                      aria-hidden
                      className={cn("mt-3 size-2.5 rounded-full", isCurrent ? "bg-primary" : "bg-muted-foreground")}
                    />
                    {!isLast && <span aria-hidden className="absolute top-6 -bottom-2 w-px bg-border" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Phiên bản {entry.revisionNo}</span>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
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
                            onClick={() => onView(entry.id)}
                          >
                            <Eye />
                            Xem
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{revisionMeta(entry)}</p>
                    {/* Lý do nằm ở bản Sở đã chê; bản kế tiếp chỉ mang lại cùng lý do. */}
                    {entry.returnReason && entry.status === "SUPERSEDED" && (
                      <p className="mt-2 rounded-md border bg-surface-subtle px-3 py-2 text-sm">
                        Lý do: {entry.returnReason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
