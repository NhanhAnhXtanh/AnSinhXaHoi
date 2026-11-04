import { useEffect, useState } from "react";
import { LoaderCircle, Save, TriangleAlert } from "lucide-react";

import { LoadingState, formatNumber } from "@/shared/components/asxh";
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
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import { deptSheetUrl, errorMessage, useApiArray, type PendingChange } from "./api";

/**
 * Phần đổi của một dòng: số lượng và / hoặc kinh phí — chỉ phần nào khác mới hiện (trước đây chỉ hiện
 * kinh phí, đổi số lượng mà kinh phí giữ nguyên thì dòng trông như không đổi).
 */
function changedParts(c: PendingChange): { label: string; from: number | null; to: number | null }[] {
  const parts: { label: string; from: number | null; to: number | null }[] = [];
  if (c.currentQuantity !== c.quantity) parts.push({ label: "Số lượng", from: c.currentQuantity, to: c.quantity });
  if (c.currentAmount !== c.amount) parts.push({ label: "Kinh phí", from: c.currentAmount, to: c.amount });
  return parts;
}

/** Hiện tối đa bấy nhiêu dòng đổi trong hộp; còn lại ghi "và N dòng khác". */
const PREVIEW_LIMIT = 8;

/**
 * "Lưu số liệu biểu …?" (Sở sửa → Lưu): đọc bảng đang sửa, cho biết có bao
 * nhiêu dòng khác số liệu hiện hành, ô lý do điều chỉnh không bắt buộc.
 */
export function CompleteDialog({
  open,
  onOpenChange,
  reportId,
  templateId,
  sheetLabel,
  periodName,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportId: number;
  templateId: number;
  sheetLabel: string;
  periodName: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const preview = useApiArray<PendingChange>(
    open ? deptSheetUrl(reportId, templateId, "/preview") : null,
    undefined
  );
  const changes = preview.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Lưu số liệu biểu {sheetLabel}?</DialogTitle>
          <DialogDescription>
            Số liệu biểu {sheetLabel} của {periodName} sẽ được lưu thành phiên bản mới. Lưu xong
            bạn vẫn sửa tiếp được.
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading ? (
          <LoadingState label="Đang kiểm tra số liệu…" />
        ) : preview.error ? (
          <div
            role="alert"
            className="bg-destructive-subtle text-destructive-text flex gap-2.5 rounded-lg px-3.5 py-3 text-sm"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{errorMessage(preview.error, "Chưa kiểm tra được số liệu của biểu. Bạn thử lại sau ít phút.")}</p>
          </div>
        ) : changes.length === 0 ? (
          <p className="bg-surface-subtle text-muted-foreground rounded-lg px-3.5 py-3 text-sm">
            Biểu không có số nào khác số liệu đã lưu, bấm Lưu sẽ không đổi gì.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm">
              Có <span className="font-semibold">{formatNumber(changes.length)}</span> dòng sẽ được
              lưu vào số liệu tổng hợp:
            </p>
            <ul className="w-full min-w-0 divide-y overflow-hidden rounded-lg border text-sm">
              {changes.slice(0, PREVIEW_LIMIT).map((c, i) => (
                <li
                  key={`${c.indicatorCode}-${c.unitName}-${i}`}
                  className="flex min-w-0 flex-col gap-0.5 px-3 py-2"
                >
                  <span className="truncate" title={`${c.indicatorName} · ${c.unitName}`}>
                    {c.indicatorName}
                    <span className="text-muted-foreground"> · {c.unitName}</span>
                  </span>
                  <span className="text-muted-foreground flex flex-wrap gap-x-4 text-xs tabular-nums">
                    {changedParts(c).map((part) => (
                      <span key={part.label}>
                        {part.label}: <span className="line-through">{formatNumber(part.from)}</span> →{" "}
                        <span className="text-foreground font-medium">{formatNumber(part.to)}</span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {changes.length > PREVIEW_LIMIT && (
              <p className="text-muted-foreground text-xs">
                và {formatNumber(changes.length - PREVIEW_LIMIT)} dòng khác.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="complete-reason">Lý do điều chỉnh (không bắt buộc)</Label>
          <Textarea
            id="complete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ví dụ: bổ sung đối tượng chuyển đến sau ngày chốt đợt"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Quay lại
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={busy || preview.isLoading || preview.error !== null}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save aria-hidden />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
