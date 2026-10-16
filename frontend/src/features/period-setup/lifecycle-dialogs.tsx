import { useEffect, useId, useState } from "react";

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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import { addDays, fmt, parseVnDate, type Period, type PeriodProgress } from "./model";
import { SummaryBox } from "./summary-box";

const EMPTY_PROGRESS: PeriodProgress = { approved: 0, pendingReview: 0, notSubmitted: 0 };

/* ------------------------------------------------------------------ */
/* Chốt đợt báo cáo (UC-27)                                            */
/* ------------------------------------------------------------------ */

export function ClosePeriodDialog({
  open,
  onOpenChange,
  period,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  onConfirm: () => void;
}) {
  const p = period.progress ?? EMPTY_PROGRESS;
  const blocked = p.pendingReview > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Chốt đợt báo cáo {period.name}?</DialogTitle>
          <DialogDescription>
            Đơn vị sẽ không nhập thêm được số liệu cho kỳ này và kỳ không mở lại
            được. Số liệu đã duyệt sẽ được lưu làm số liệu chính thức của Sở.
          </DialogDescription>
        </DialogHeader>
        <SummaryBox
          rows={[
            { label: "Phiếu đã duyệt", value: `${formatNumber(p.approved)} phiếu` },
            {
              label: "Phiếu đơn vị chưa nộp (sẽ bị khoá)",
              value: `${formatNumber(p.notSubmitted)} phiếu`,
            },
            { label: "Phiếu chờ duyệt", value: `${formatNumber(p.pendingReview)} phiếu` },
          ]}
        />
        {blocked && (
          <p className="text-sm text-destructive-text">
            Còn {formatNumber(p.pendingReview)} đơn vị đã nộp nhưng chưa được
            duyệt hoặc trả lại. Bạn hãy duyệt hoặc trả lại hết trước khi chốt đợt.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button disabled={blocked} onClick={onConfirm}>
            Chốt đợt {period.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Gia hạn và mở lại (UC-28)                                           */
/* ------------------------------------------------------------------ */

export function ReopenDialog({
  open,
  onOpenChange,
  period,
  today,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  today: string;
  onConfirm: (newDeadline: string, reason: string) => void;
}) {
  const dateId = useId();
  const reasonId = useId();
  const [dateText, setDateText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDateText(fmt(addDays(today, 7)));
      setReason("");
      setError(null);
    }
  }, [open, today]);

  const submit = () => {
    const iso = parseVnDate(dateText);
    if (!dateText.trim()) {
      setError("Hạn nộp mới phải từ hôm nay trở đi.");
      return;
    }
    if (!iso) {
      setError("Ngày chưa đúng dạng ngày/tháng/năm, ví dụ 23/10/2026.");
      return;
    }
    if (iso < today) {
      setError("Hạn nộp mới phải từ hôm nay trở đi.");
      return;
    }
    onConfirm(iso, reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Gia hạn và mở lại {period.name}?</DialogTitle>
          <DialogDescription>
            Đơn vị sẽ nhập và nộp được số liệu trở lại cho đến hạn nộp mới. Nếu
            mở lại mà không dời hạn, hệ thống sẽ đóng lại ngay hôm sau.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={dateId}>
            Hạn nộp mới <span className="text-destructive-text">*</span>
          </Label>
          <Input
            id={dateId}
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            value={dateText}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setDateText(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p className="text-xs text-destructive-text">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Hạn cũ là {fmt(period.deadline)}. Bạn chọn từ hôm nay ({fmt(today)})
              trở đi.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={reasonId}>Lý do gia hạn</Label>
          <Textarea
            id={reasonId}
            maxLength={500}
            rows={3}
            placeholder="Ví dụ: Một số xã chưa nhập xong số liệu do mất kết nối mạng."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Không bắt buộc. Tối đa 500 ký tự.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button onClick={submit}>Gia hạn và mở lại</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Thu hồi và thiết lập lại (UC-29)                                    */
/* ------------------------------------------------------------------ */

export function WithdrawDialog({
  open,
  onOpenChange,
  period,
  ticketCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  /** Số phiếu đã phát của kỳ (sẽ bị xoá). */
  ticketCount: number;
  onConfirm: () => void;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matches = typed.trim() === period.name;
  const approved = period.progress?.approved ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Thu hồi kỳ {period.name} để thiết lập lại?</DialogTitle>
          <DialogDescription>
            Toàn bộ số liệu các đơn vị đã nhập ở kỳ này sẽ bị xoá và không lấy
            lại được, kể cả số liệu đã được phê duyệt. Kỳ quay về bước thiết lập.
          </DialogDescription>
        </DialogHeader>
        <SummaryBox
          rows={[
            { label: "Phiếu sẽ bị xoá", value: `${formatNumber(ticketCount)} phiếu` },
            {
              label: "Trong đó đã được phê duyệt",
              value: `${formatNumber(approved)} phiếu`,
            },
            { label: "Biểu và đơn vị đã gán cho kỳ", value: "Giữ nguyên" },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>
            Gõ tên kỳ để xác nhận <span className="text-destructive-text">*</span>
          </Label>
          <Input
            id={inputId}
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Bạn cần gõ đúng: {period.name}. Nút thu hồi chỉ dùng được khi tên kỳ
            khớp.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button variant="destructive" disabled={!matches} onClick={onConfirm}>
            Thu hồi kỳ {period.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
