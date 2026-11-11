import { useState } from "react";
import { ChevronLeft, ChevronRight, List, TriangleAlert } from "lucide-react";

import { formatNumber } from "@/shared/components/asxh";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";

import {
  fmt,
  fmtRange,
  todayIso,
  UNIT_GROUP_LABEL,
  type Period,
  type SupplementRoute,
  type Unit,
} from "./model";
import { SummaryBox } from "./summary-box";

export type PreviewRow = { unit: Unit; forms: number };

/* ------------------------------------------------------------------ */
/* Mở đợt báo cáo (UC-24)                                              */
/* ------------------------------------------------------------------ */

export function OpenPeriodDialog({
  open,
  onOpenChange,
  period,
  rows,
  pending,
  onShowPreview,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  rows: PreviewRow[];
  pending?: boolean;
  onShowPreview: () => void;
  onConfirm: () => void;
}) {
  const forms = rows.reduce((s, r) => s + r.forms, 0);
  // Hạn nộp đã qua: kỳ chuyển "quá hạn" lúc 0 giờ hôm sau và khoá nhập, nên đơn vị chỉ còn tới hết hôm nay.
  const pastDeadline = period.deadline != null && period.deadline < todayIso();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Mở đợt báo cáo {period.name}?</DialogTitle>
          <DialogDescription>
            Sau khi mở, đơn vị bắt đầu nhập số liệu và phiên bản biểu mẫu hiện
            hành được chốt vào từng phiếu. Mỗi kỳ chỉ mở lần đầu được một lần.
          </DialogDescription>
        </DialogHeader>
        <SummaryBox
          rows={[
            {
              label: "Kỳ báo cáo",
              value: `${period.name} (${fmtRange(period.from, period.to)})`,
            },
            {
              label: "Nhận nhập liệu",
              value: `${fmt(period.openFrom)} – ${fmt(period.deadline)}`,
            },
            { label: "Đơn vị nhận phiếu", value: `${formatNumber(rows.length)} đơn vị` },
            {
              label: "Phiếu sẽ tạo",
              value: `${formatNumber(rows.length)} phiếu · ${formatNumber(forms)} biểu`,
            },
            { label: "Phiếu đã có", value: "0 phiếu" },
          ]}
        />
        {pastDeadline && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-text"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Hạn nộp của kỳ này đã qua ({fmt(period.deadline)}). Mở đợt bây giờ thì đơn vị chỉ
              nhập và nộp được đến hết hôm nay; sang ngày mai kỳ tự khoá và phải gia hạn mới mở
              lại được.
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={onShowPreview}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
        >
          <List className="size-4" />
          Xem danh sách phiếu sẽ tạo
        </button>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            Mở đợt {period.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Ngăn xem trước phiếu sẽ tạo                                         */
/* ------------------------------------------------------------------ */

const PREVIEW_PAGE = 10;

export function OpenPreviewSheet({
  open,
  onOpenChange,
  period,
  rows,
  pending,
  onBack,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  rows: PreviewRow[];
  pending?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [page, setPage] = useState(0);
  const forms = rows.reduce((s, r) => s + r.forms, 0);
  const pages = Math.max(1, Math.ceil(rows.length / PREVIEW_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * PREVIEW_PAGE, (current + 1) * PREVIEW_PAGE);
  const first = rows.length === 0 ? 0 : current * PREVIEW_PAGE + 1;
  const last = current * PREVIEW_PAGE + slice.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[560px]">
        <SheetHeader className="gap-1.5 p-5 pr-12">
          <SheetTitle className="text-lg">
            Phiếu sẽ tạo khi mở đợt {period.name}
          </SheetTitle>
          <SheetDescription>
            Mỗi đơn vị nhận một phiếu cho cả kỳ, trong phiếu có các biểu đã được
            tích cho đơn vị đó.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
          <div className="rounded-lg border bg-surface-subtle px-3 py-2.5 text-sm font-medium">
            {formatNumber(rows.length)} đơn vị · {formatNumber(rows.length)} phiếu ·{" "}
            {formatNumber(forms)} biểu
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Đơn vị
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Số biểu
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.unit.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.unit.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.unit.group ? UNIT_GROUP_LABEL[r.unit.group] : "Đơn vị khác"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatNumber(r.forms)} biểu
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Hiển thị {first}–{last} trong {formatNumber(rows.length)} đơn vị
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang trước"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft />
                </Button>
                <span className="px-2 text-foreground">
                  Trang {current + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang sau"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </div>
        <SheetFooter className="flex-row justify-end border-t p-4">
          <Button variant="outline" onClick={onBack}>
            Quay lại
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            Mở đợt {period.name}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Mở đợt bổ sung (UC-26)                                              */
/* ------------------------------------------------------------------ */

export type SupplementLine = {
  unit: Unit;
  codes: string[];
  /** append: thêm vào phiếu đang nhập · separate: phiếu bổ sung riêng · fresh: tạo phiếu mới */
  route: SupplementRoute;
};

const ROUTE_LABEL: Record<SupplementRoute, string> = {
  append: "thêm vào phiếu đang nhập",
  separate: "phiếu bổ sung riêng (phiếu cũ đã nộp)",
  fresh: "tạo phiếu mới",
};

export function SupplementDialog({
  open,
  onOpenChange,
  period,
  lines,
  daysLeft,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  lines: SupplementLine[];
  /** Số ngày tới hạn nộp; `null` khi kỳ chưa đặt hạn. */
  daysLeft: number | null;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const warning =
    daysLeft === null
      ? null
      : daysLeft < 0
      ? "Kỳ đã quá hạn nộp. Hãy gia hạn trước khi mở đợt bổ sung, nếu không đơn vị sẽ không nhập được."
      : daysLeft < 5
        ? `Hạn nộp của kỳ chỉ còn ${daysLeft} ngày — đơn vị có thể không kịp nhập phần bổ sung. Cân nhắc gia hạn trước.`
        : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Mở đợt bổ sung {period.name}?</DialogTitle>
          <DialogDescription>
            Biểu vừa tích được phát thành một đợt bổ sung riêng. Đơn vị còn đang
            nhập sẽ có thêm biểu ngay trong phiếu hiện tại; đơn vị đã nộp nhận
            một phiếu bổ sung riêng. Biểu đã phát trước đó giữ nguyên.
          </DialogDescription>
        </DialogHeader>
        {warning && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-text">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {warning}
          </p>
        )}
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
          {lines.map((l) => (
            <li key={l.unit.id} className="px-3 py-2">
              <div className="font-medium">{l.unit.name}</div>
              <div className="text-xs text-muted-foreground">
                Biểu {l.codes.join(", ")} · {ROUTE_LABEL[l.route]}
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            Mở đợt bổ sung
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
