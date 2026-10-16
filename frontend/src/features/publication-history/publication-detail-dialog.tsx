import { Fragment, useEffect, useState } from "react";
import { ChevronUp, RotateCcwClock } from "lucide-react";

import { formatDate, formatNumber, StatusBadge } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { HistoryEvent, Publication } from "./fixtures";
import { KIND_LABEL, parseAt, RESULT_VIEW, totals } from "./model";

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Chi tiết một đợt mở: từng đơn vị với số biểu đã phát, kết quả và diễn biến (UC-30). */
export function PublicationDetailDialog({
  publication,
  onOpenChange,
}: {
  publication: Publication | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const publicationId = publication?.id;
  useEffect(() => {
    setExpanded(null);
  }, [publicationId]);

  const p = publication;
  const t = p ? totals(p) : null;
  const opened = p ? parseAt(p.openedAt) : null;

  return (
    <Dialog open={p !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-4rem)] flex-col sm:max-w-[960px]">
        {p && t && opened && (
          <>
            <DialogHeader>
              <DialogTitle>
                Chi tiết đợt mở {p.periodName} ({KIND_LABEL[p.kind].toLowerCase()})
              </DialogTitle>
              <DialogDescription>
                Mở lúc {hhmm(opened)} ngày {formatDate(opened)} bởi {p.openedBy} ·{" "}
                {formatNumber(t.units)} đơn vị · {formatNumber(t.tickets)} phiếu ·{" "}
                {formatNumber(t.forms)} biểu
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-subtle">
                  <tr className="border-b">
                    <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">
                      Đơn vị
                    </th>
                    <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">
                      Số biểu đã phát
                    </th>
                    <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">
                      Kết quả
                    </th>
                    <th className="h-10 px-3 text-right text-xs font-medium text-muted-foreground">
                      Diễn biến
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((item) => {
                    const view = RESULT_VIEW[item.result];
                    const open = expanded === item.unitId;
                    return (
                      <Fragment key={item.unitId}>
                        <tr className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.unitName}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.unitGroup}
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatNumber(item.forms)} biểu
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                            {item.message && (
                              <div className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                                {item.message}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() => setExpanded(open ? null : item.unitId)}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
                            >
                              {open ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <RotateCcwClock className="size-4" />
                              )}
                              {open ? "Thu gọn" : "Xem diễn biến"}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b bg-surface-subtle last:border-b-0">
                            <td colSpan={4} className="px-3 py-3">
                              <Timeline events={item.history} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Timeline({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có phiếu nên chưa có diễn biến nào.
      </p>
    );
  const hasInferred = events.some((e) => e.inferred);
  return (
    <div className="flex flex-col gap-2">
      <ol className="relative ms-1.5 flex flex-col gap-3 border-s ps-4">
        {events.map((e, i) => {
          const at = parseAt(e.at);
          return (
            <li key={i} className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -start-[21px] size-2 rounded-full bg-primary"
              />
              <div className="text-sm font-medium text-foreground">
                {e.label}
                {e.inferred && <span className="text-muted-foreground"> *</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(at)} {hhmm(at)} · {e.by}
              </div>
            </li>
          );
        })}
      </ol>
      {hasInferred && (
        <p className="text-xs text-muted-foreground">
          Dấu * là mốc suy ra, không có thời điểm ghi nhận gốc.
        </p>
      )}
    </div>
  );
}
