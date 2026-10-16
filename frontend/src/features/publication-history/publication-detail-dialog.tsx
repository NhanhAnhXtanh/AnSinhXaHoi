import { Fragment, useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { ChevronUp, FileX2, RotateCcwClock, TriangleAlert } from "lucide-react";

import {
  EmptyState,
  formatDate,
  formatNumber,
  LoadingState,
  StatusBadge,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import {
  hhmm,
  KIND_LABEL,
  REPORT_STATUS_VIEW,
  toItems,
  UNIT_GROUP_LABEL,
  type ApiInputReport,
  type ApiPublication,
  type ApiUnitLite,
  type HistoryEvent,
} from "./model";

/**
 * Chi tiết một đợt mở (UC-30): từng đơn vị nhận phiếu của đợt, số biểu trong phiếu, tình trạng
 * hiện tại và diễn biến của phiếu về sau. Đọc phiếu qua `/api/input_reports?publication.id=` —
 * máy chủ chưa có bảng dòng chi tiết của đợt như bản cũ.
 */
export function PublicationDetailDialog({
  publication,
  periodRangeText,
  onOpenChange,
}: {
  publication: ApiPublication | null;
  /** "01/10 – 31/12/2026" của kỳ, viết sẵn. */
  periodRangeText?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const publicationId = publication?.id ?? null;

  useEffect(() => {
    setExpanded(null);
  }, [publicationId]);

  const reportsList = useList<ApiInputReport>({
    resource: "input_reports",
    pagination: { currentPage: 1, pageSize: 1000 },
    filters: publicationId ? [{ field: "publication.id", operator: "eq", value: publicationId }] : [],
    queryOptions: { enabled: publicationId !== null },
  });

  const unitsList = useList<ApiUnitLite>({
    resource: "report_units",
    pagination: { currentPage: 1, pageSize: 1000 },
    queryOptions: { enabled: publicationId !== null },
  });

  const groupOf = useMemo(() => {
    const blocks = new Map((unitsList.result?.data ?? []).map((u) => [u.id, u.block]));
    return (unitId: number) => {
      const block = blocks.get(unitId);
      return block ? UNIT_GROUP_LABEL[block] : "";
    };
  }, [unitsList.result?.data]);

  const p = publication;
  const items = useMemo(
    () =>
      p && publicationId !== null
        ? toItems(reportsList.result?.data ?? [], groupOf, p.createdBy || "Hệ thống")
        : [],
    [p, publicationId, reportsList.result?.data, groupOf]
  );
  const opened = p ? new Date(p.createdAt) : null;
  // Đợt bổ sung thêm biểu vào phiếu đang nhập của đơn vị thì không sinh phiếu mới cho đợt này.
  const appendedUnits = p ? Math.max(0, p.unitCount - items.length) : 0;

  const table = () => {
    if (reportsList.query.isLoading) return <LoadingState label="Đang tải các phiếu của đợt…" />;
    if (reportsList.query.isError)
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Không tải được các phiếu của đợt"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button variant="outline" size="sm" onClick={() => void reportsList.query.refetch()}>
              Tải lại
            </Button>
          }
        />
      );
    if (items.length === 0)
      return (
        <EmptyState
          icon={FileX2}
          title={p?.status === "CANCELLED" ? "Phiếu của đợt đã bị xoá khi thu hồi kỳ" : "Đợt này không tạo phiếu mới"}
          description={
            p?.status === "CANCELLED"
              ? "Khi thu hồi kỳ để thiết lập lại, mọi phiếu của kỳ bị xoá; đợt vẫn được giữ lại để tra cứu."
              : "Các biểu của đợt đã được thêm vào phiếu đang nhập của đơn vị."
          }
        />
      );
    return (
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-subtle">
            <tr className="border-b">
              <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">Đơn vị</th>
              <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">
                Số biểu đã phát
              </th>
              <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">Kết quả</th>
              <th className="h-10 px-3 text-right text-xs font-medium text-muted-foreground">
                Diễn biến
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const view = REPORT_STATUS_VIEW[item.status];
              const open = expanded === item.unitId;
              return (
                <Fragment key={item.unitId}>
                  <tr className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.unitName}</div>
                      {item.unitGroup && (
                        <div className="text-xs text-muted-foreground">{item.unitGroup}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(item.forms)} biểu</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone="success">Đã tạo</StatusBadge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Phiếu hiện: {view.label.toLowerCase()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : item.unitId)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
                      >
                        {open ? <ChevronUp className="size-4" /> : <RotateCcwClock className="size-4" />}
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
    );
  };

  return (
    <Dialog open={p !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-4rem)] flex-col sm:max-w-[960px]">
        {p && opened && (
          <>
            <DialogHeader>
              <DialogTitle>
                Chi tiết đợt mở {p.period.name} ({KIND_LABEL[p.kind].toLowerCase()})
              </DialogTitle>
              <DialogDescription>
                Mở lúc {hhmm(opened)} ngày {formatDate(opened)} bởi {p.createdBy || "Hệ thống"} ·{" "}
                {formatNumber(p.unitCount)} đơn vị · {formatNumber(p.reportCount)} phiếu ·{" "}
                {formatNumber(p.sheetCount)} biểu
                {periodRangeText ? ` · Kỳ ${periodRangeText}` : ""}
              </DialogDescription>
            </DialogHeader>

            {table()}

            {appendedUnits > 0 && items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(appendedUnits)} đơn vị khác nhận thêm biểu ngay trong phiếu đang nhập
                nên không có dòng riêng ở đây.
              </p>
            )}

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
    return <p className="text-sm text-muted-foreground">Chưa có diễn biến nào của phiếu.</p>;
  const hasInferred = events.some((e) => e.inferred);
  return (
    <div className="flex flex-col gap-2">
      <ol className="relative ms-1.5 flex flex-col gap-3 border-s ps-4">
        {events.map((e, i) => (
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
              {formatDate(e.at)} {hhmm(e.at)} · {e.by}
            </div>
          </li>
        ))}
      </ol>
      {hasInferred && (
        <p className="text-xs text-muted-foreground">
          Dấu * là mốc suy ra, không có thời điểm ghi nhận gốc.
        </p>
      )}
    </div>
  );
}
