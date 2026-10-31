import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { formatDate } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

import { addDays, fromIso, toIso } from "./model";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY_NAMES = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

/**
 * Ô hạn nộp của một kỳ: bấm vào mở lịch chọn ngày. Ngày sớm nhất chọn được là
 * ngày muộn hơn trong hai mốc: ngày sau khi hết kỳ (trước đó đơn vị chưa có số
 * liệu) và hôm nay (hạn đã qua thì kỳ thành Quá hạn ngay). Máy chủ kiểm lại
 * đúng quy tắc này (ReportPeriodService.requireDeadlineAllowed).
 */
export function DeadlinePicker({
  value,
  periodEnd,
  periodName,
  onChange,
  disabled,
  disabledReason,
}: {
  /** yyyy-MM-dd */
  value: string;
  /** yyyy-MM-dd — ngày cuối kỳ. */
  periodEnd: string;
  periodName: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const afterEnd = addDays(periodEnd, 1);
  const today = toIso(new Date());
  // Chuỗi yyyy-MM-dd so sánh được theo thứ tự chữ.
  const earliest = afterEnd > today ? afterEnd : today;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={disabled ? disabledReason : `Sửa hạn nộp ${periodName}`}
          aria-label={`Hạn nộp ${periodName}: ${formatDate(value)}`}
          className={cn(
            "w-36 justify-start text-sm font-normal tabular-nums",
            disabled && "disabled:opacity-60"
          )}
        >
          <CalendarIcon aria-hidden className="text-muted-foreground" />
          {formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          // Hạn hiện tại đã qua thì mở sẵn ở tháng của ngày sớm nhất còn chọn được.
          defaultMonth={value < earliest ? fromIso(earliest) : selected}
          disabled={{ before: fromIso(earliest) }}
          onSelect={(day) => {
            if (!day) return;
            onChange(toIso(day));
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
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
