import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { cn } from "@/shared/lib/utils";
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
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Textarea } from "@/shared/ui/textarea";

import {
  KIND_RULES,
  KIND_VIEW,
  MEASURE_KINDS,
  ruleText,
  type ApiIndicatorMeasure,
  type MeasureKind,
} from "./model";

/**
 * Hộp "Khai bản chất": chọn một trong năm bản chất, kèm ghi chú.
 *
 * Một chỉ tiêu: ghi chú điền sẵn, gửi nguyên văn (để trống = xoá ghi chú).
 * Nhiều chỉ tiêu: ghi chú để trống thì giữ ghi chú riêng của từng chỉ tiêu
 * (gửi `null`), gõ vào thì ghi đè cho tất cả.
 *
 * Màn cha chỉ dựng hộp khi mở và đổi `key` mỗi lần mở.
 */
export function DeclareDialog({
  rows,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  rows: ApiIndicatorMeasure[];
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (kind: MeasureKind, note: string | null) => void;
}) {
  const single = rows.length === 1 ? rows[0] : null;
  // Giá trị đầu lấy lúc mở hộp — màn cha dựng lại hộp (key mới) mỗi lần mở, nên tải lại danh sách
  // phía sau không xoá lựa chọn đang làm dở.
  const [kind, setKind] = useState<MeasureKind | "">(() => single?.measureKind ?? "");
  const [note, setNote] = useState(() => single?.note ?? "");

  const submit = () => {
    if (!kind) return;
    const trimmed = note.trim();
    onConfirm(kind, single ? trimmed : trimmed === "" ? null : trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {single ? "Khai bản chất chỉ tiêu" : `Khai bản chất cho ${rows.length} chỉ tiêu`}
          </DialogTitle>
          <DialogDescription>
            {single
              ? single.indicatorName
              : "Các chỉ tiêu đã chọn sẽ cùng nhận bản chất này."}{" "}
            Bản chất quyết định cách cộng số khi tổng hợp nhiều kỳ, ví dụ cả quý hoặc cả năm.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v as MeasureKind)}
          aria-label="Bản chất chỉ tiêu"
          className="gap-2"
        >
          {MEASURE_KINDS.map((k) => {
            const view = KIND_VIEW[k];
            const rule = KIND_RULES[k];
            const id = `measure-kind-${k}`;
            return (
              <label
                key={k}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors hover:bg-accent/50",
                  kind === k && "border-primary bg-accent/40"
                )}
              >
                <RadioGroupItem id={id} value={k} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{view.label}</span>
                  <span className="text-muted-foreground text-xs">{view.hint}</span>
                  <span className="text-xs">{ruleText(rule.quantity, rule.amount)}</span>
                </span>
              </label>
            );
          })}
        </RadioGroup>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="measure-kind-note">Ghi chú (không bắt buộc)</Label>
          <Textarea
            id="measure-kind-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={
              single ? "Ví dụ: mức hỗ trợ theo nghị quyết của HĐND tỉnh" : "Để trống thì giữ ghi chú hiện có của từng chỉ tiêu"
            }
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Quay lại
            </Button>
          </DialogClose>
          <Button type="button" disabled={busy || !kind} onClick={submit}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />}
            Lưu bản chất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
