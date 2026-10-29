import { useCustom } from "@refinedev/core";
import { TriangleAlert } from "lucide-react";

import { EmptyState, LoadingState, formatDateTime } from "@/shared/components/asxh";
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

import { historyUrl, type HistoryAction, type InputReportHistory, type InputReportRecord } from "../api";

type HistoryEvent = InputReportHistory["events"][number];

const ACTION_TEXT: Record<HistoryAction, (e: HistoryEvent) => string> = {
  ISSUED: () => "Sở mở đợt, phát phiếu cho đơn vị",
  SUBMITTED: (e) => (e.revisionNo > 1 ? "Đơn vị nộp lại phiếu" : "Đơn vị nộp phiếu"),
  RETURNED: () => "Sở trả lại phiếu",
  APPROVED: () => "Sở phê duyệt phiếu, số liệu được ghi nhận",
  LOCKED: () => "Sở chốt số liệu của kỳ, phiếu khoá lại",
  CANCELLED: () => "Phiếu bị huỷ",
  SHEET_SAVED: (e) => `Lưu số liệu biểu ${e.sheet ?? ""}`,
  SHEET_COMPLETED: (e) => `Đánh dấu biểu ${e.sheet ?? ""} đã nhập xong`,
  SHEET_NO_DATA: (e) => `Khai biểu ${e.sheet ?? ""} không phát sinh số liệu`,
};

/**
 * Lịch sử thao tác của phiếu (UC-44 bước 2): mốc lập, nộp, trả lại (kèm lý do),
 * duyệt, khoá; lưu / hoàn tất / không phát sinh của từng biểu — mới trước.
 *
 * Dựng lại từ dữ liệu sẵn có (BR-44.1), nên mỗi biểu chỉ còn lần lưu và lần đánh
 * dấu gần nhất; mốc không có thời điểm gốc ghi "(thời điểm ước tính)".
 */
export function ActionHistoryDialog({
  report,
  open,
  onOpenChange,
}: {
  report: InputReportRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { result, query } = useCustom<InputReportHistory>({
    url: historyUrl(report.id),
    method: "get",
    queryOptions: { enabled: open },
    errorNotification: false,
  });
  const history = customResult(result?.data, "events");
  const events = history?.events ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>Lịch sử thao tác</DialogTitle>
          <DialogDescription>
            {report.period.name} · {report.unit.name}
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
        ) : events.length === 0 ? (
          <p className="text-muted-foreground px-6 pb-6 text-sm">Phiếu chưa có thao tác nào.</p>
        ) : (
          <ol className="flex max-h-[60vh] flex-col overflow-y-auto px-6 pb-5">
            {events.map((e, i) => {
              const isLast = i === events.length - 1;
              return (
                <li key={`${e.action}-${e.at ?? ""}-${e.sheet ?? ""}-${i}`} className="flex gap-3">
                  <div className="flex w-2 shrink-0 flex-col items-center pt-2">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/50")}
                    />
                    {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
                  </div>
                  <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !isLast && "pb-4")}>
                    <p className="text-sm font-medium">{ACTION_TEXT[e.action](e)}</p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        e.at ? formatDateTime(e.at) : null,
                        e.by,
                        `Phiên bản ${e.revisionNo}`,
                        e.derived ? "(thời điểm ước tính)" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {e.note && (
                      <p className="bg-surface-subtle rounded-md border px-3 py-2 text-sm">Lý do: {e.note}</p>
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
