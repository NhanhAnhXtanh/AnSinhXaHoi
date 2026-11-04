import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { formatDate } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/** "dd/MM/yyyy" → yyyy-MM-dd; chữ không phải một ngày có thật → null. */
function parseVnDate(text: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** yyyy-MM-dd → Date theo giờ máy (không lệch ngày như new Date("yyyy-MM-dd")). */
function fromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Ô ngày dạng ngày/tháng/năm: gõ tay được, hoặc bấm biểu tượng lịch (hay bấm vào ô)
 * để mở bảng chọn ngày. Giá trị vẫn là chữ "dd/MM/yyyy" như ô cũ — nơi dùng tự
 * kiểm chữ đó (vd. parseVnDate của mẫu biểu, parseViDate của Tổng hợp). {@code min} (yyyy-MM-dd) làm mờ các ngày trước đó trên lịch.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  disabled,
  invalid,
  describedBy,
}: {
  id?: string;
  /** Chữ dd/MM/yyyy đang hiện trong ô. */
  value: string;
  onChange: (text: string) => void;
  /** yyyy-MM-dd — ngày sớm nhất chọn được trên lịch. */
  min?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const iso = parseVnDate(value);
  const selected = iso ? fromIso(iso) : undefined;
  const minDate = min ? fromIso(min) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={id}
            value={value}
            inputMode="numeric"
            placeholder="ngày/tháng/năm"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="pr-10"
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && e.altKey) setOpen(true);
            }}
            onChange={(e) => onChange(e.target.value)}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label="Chọn ngày trên lịch"
              className="text-muted-foreground absolute top-1/2 right-0.5 -translate-y-1/2"
            >
              <CalendarIcon aria-hidden />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        // Bấm vào ô để gõ thì giữ con trỏ trong ô, không nhảy sang lịch.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(day) => {
            if (!day) return;
            onChange(formatDate(day));
            setOpen(false);
          }}
          formatters={{
            formatCaption: (month) => `Tháng ${month.getMonth() + 1}/${month.getFullYear()}`,
            formatWeekdayName: (day) => WEEKDAYS[day.getDay()],
          }}
          labels={{
            labelPrevious: () => "Tháng trước",
            labelNext: () => "Tháng sau",
            labelWeekday: (day) => WEEKDAY_NAMES[day.getDay()],
          }}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
