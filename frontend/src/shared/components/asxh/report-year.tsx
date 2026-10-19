import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Calendar } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { cn } from "@/shared/lib/utils";

/**
 * Năm báo cáo dùng chung cho mọi màn theo năm.
 *
 * Nhớ trong localStorage của trình duyệt — chỉ là tiện cho người đang dùng
 * máy đó, nên mọi lần đọc/ghi đều bọc try/catch (chế độ ẩn danh, bị chặn lưu
 * trữ) và màn vẫn chạy bình thường khi không lưu được.
 */
const STORAGE_KEY = "asxh.reportYear";
const DEFAULT_YEARS = [2024, 2025, 2026, 2027];

type ReportYearValue = {
  year: number;
  setYear: (y: number) => void;
  years: number[];
};

const ReportYearContext = createContext<ReportYearValue | null>(null);

function readStoredYear(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 1900 && n < 3000 ? n : null;
  } catch {
    return null;
  }
}

function writeStoredYear(y: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(y));
  } catch {
    // Không lưu được thì thôi — năm vẫn đổi trong phiên này.
  }
}

function initialYear(): number {
  return readStoredYear() ?? new Date().getFullYear();
}

/** Danh sách năm luôn chứa năm đang chọn, xếp tăng dần. */
function withYear(years: number[], year: number): number[] {
  return years.includes(year)
    ? years
    : [...years, year].sort((a, b) => a - b);
}

export function ReportYearProvider({
  children,
  years = DEFAULT_YEARS,
}: {
  children: ReactNode;
  /** Các năm cho chọn; mặc định 2024–2027. */
  years?: number[];
}) {
  const [year, setYearState] = useState<number>(initialYear);

  const setYear = useCallback((y: number) => {
    setYearState(y);
    writeStoredYear(y);
  }, []);

  const value = useMemo<ReportYearValue>(
    () => ({ year, setYear, years: withYear(years, year) }),
    [year, setYear, years]
  );

  return (
    <ReportYearContext.Provider value={value}>
      {children}
    </ReportYearContext.Provider>
  );
}

ReportYearProvider.displayName = "ReportYearProvider";

/**
 * Năm báo cáo đang chọn. Ngoài Provider (chưa gắn ở app) vẫn chạy, chỉ là năm
 * không dùng chung giữa các màn.
 */
export function useReportYear(): ReportYearValue {
  const ctx = useContext(ReportYearContext);
  const [fallbackYear, setFallbackYear] = useState<number>(initialYear);

  const fallbackSet = useCallback((y: number) => {
    setFallbackYear(y);
    writeStoredYear(y);
  }, []);

  const fallback = useMemo<ReportYearValue>(
    () => ({
      year: fallbackYear,
      setYear: fallbackSet,
      years: withYear(DEFAULT_YEARS, fallbackYear),
    }),
    [fallbackYear, fallbackSet]
  );

  return ctx ?? fallback;
}

/** Ô "Năm 2026" có icon lịch, đặt ở cụm phải đầu trang. */
export function YearSelect({ className }: { className?: string }) {
  const { year, setYear, years } = useReportYear();
  // Đổi năm thay cả khung làm việc mà không đổi đường dẫn, nên hộp hỏi "Bỏ thay đổi chưa
  // lưu?" của UnsavedChangesGuard không tự bắt được — màn đang có số chưa lưu (ma trận
  // thiết lập, sửa số tổng hợp, lịch báo cáo…) phải hỏi trước, không thì mất im lặng.
  const confirmDiscard = useConfirmDiscard();

  return (
    <Select
      value={String(year)}
      onValueChange={(v) => {
        const n = Number(v);
        if (Number.isInteger(n) && n !== year) confirmDiscard(() => setYear(n));
      }}
    >
      <SelectTrigger
        aria-label="Năm báo cáo"
        className={cn("min-w-38 justify-between", className)}
      >
        <span className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            Năm {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

YearSelect.displayName = "YearSelect";
