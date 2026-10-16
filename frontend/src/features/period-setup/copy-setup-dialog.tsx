import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import {
  fmtRange,
  lockShortReason,
  periodView,
  type Period,
  type PeriodLock,
} from "./model";

/**
 * Áp dụng thiết lập cho kỳ khác (UC-23, `POST /api/period_assignments/copy`).
 * Ứng viên là các kỳ còn ở bước thiết lập. Trùng thời gian chỉ xét theo CẢ KỲ:
 * kỳ bị khoá vì trùng một kỳ đã mở đợt hiện lý do khoá và không tích được; kỳ
 * chỉ trùng thời gian với kỳ đang chọn (chưa mở đợt) vẫn áp dụng được.
 */
export function CopySetupDialog({
  open,
  onOpenChange,
  source,
  periods,
  locks,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Period;
  periods: Period[];
  /** Khoá cả kỳ theo id kỳ (máy chủ tính). */
  locks: ReadonlyMap<string, PeriodLock>;
  pending?: boolean;
  onConfirm: (targetIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const candidates = useMemo(
    () =>
      periods.filter(
        (p) => p.id !== source.id && (p.status === "draft" || p.status === "ready")
      ),
    [periods, source.id]
  );

  const reasonOf = (p: Period): string | null => {
    const lock = locks.get(p.id);
    return lock ? lockShortReason(lock) : null;
  };

  const toggle = (id: string, on: boolean) =>
    setPicked((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Áp dụng thiết lập {source.name} cho kỳ khác</DialogTitle>
          <DialogDescription>
            Chọn các kỳ muốn gán cùng biểu và đơn vị với kỳ này. Thiết lập sẵn có
            của kỳ được chọn vẫn giữ nguyên, chỉ cộng thêm.
          </DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
            Không còn kỳ nào ở bước thiết lập để áp dụng.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
            {candidates.map((p) => {
              const reason = reasonOf(p);
              const view = periodView(p, locks.get(p.id) ?? null);
              const checked = picked.includes(p.id);
              const inputId = `copy-${p.id}`;
              return (
                <li
                  key={p.id}
                  className={cn("flex items-center gap-3 px-3 py-2.5", reason && "opacity-70")}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={!!reason}
                    onCheckedChange={(v) => toggle(p.id, v === true)}
                  />
                  <label htmlFor={inputId} className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        reason ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {p.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtRange(p.from, p.to)}
                    </div>
                    {reason && (
                      <div className="text-xs text-destructive-text">{reason}</div>
                    )}
                  </label>
                  <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">Đã chọn {picked.length} kỳ</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button
            disabled={picked.length === 0 || pending}
            onClick={() => onConfirm(picked)}
          >
            {picked.length > 0 ? `Áp dụng cho ${picked.length} kỳ` : "Áp dụng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
