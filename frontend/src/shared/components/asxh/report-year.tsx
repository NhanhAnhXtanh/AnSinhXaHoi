import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Calendar, CalendarPlus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
  /**
   * Thêm năm vào danh sách chọn (vd. các năm đã có lịch báo cáo trong DB) — danh
   * sách mặc định chỉ có 2024–2027, nên năm mới tạo lịch phải được thêm vào đây.
   */
  addYears: (ys: Iterable<number>) => void;
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

/** Danh sách năm luôn chứa năm đang chọn và các năm thêm vào, xếp tăng dần. */
function withYear(years: number[], year: number, extra: number[] = []): number[] {
  return [...new Set([...years, ...extra, year])].sort((a, b) => a - b);
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
  const [extraYears, setExtraYears] = useState<number[]>([]);

  const setYear = useCallback((y: number) => {
    setYearState(y);
    writeStoredYear(y);
  }, []);

  const addYears = useCallback((ys: Iterable<number>) => {
    setExtraYears((prev) => {
      const next = new Set(prev);
      for (const y of ys) next.add(y);
      return next.size === prev.length ? prev : [...next];
    });
  }, []);

  const value = useMemo<ReportYearValue>(
    () => ({ year, setYear, years: withYear(years, year, extraYears), addYears }),
    [year, setYear, years, extraYears, addYears]
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
  const [fallbackExtra, setFallbackExtra] = useState<number[]>([]);

  const fallbackSet = useCallback((y: number) => {
    setFallbackYear(y);
    writeStoredYear(y);
  }, []);

  const fallbackAdd = useCallback((ys: Iterable<number>) => {
    setFallbackExtra((prev) => {
      const next = new Set(prev);
      for (const y of ys) next.add(y);
      return next.size === prev.length ? prev : [...next];
    });
  }, []);

  const fallback = useMemo<ReportYearValue>(
    () => ({
      year: fallbackYear,
      setYear: fallbackSet,
      years: withYear(DEFAULT_YEARS, fallbackYear, fallbackExtra),
      addYears: fallbackAdd,
    }),
    [fallbackYear, fallbackSet, fallbackExtra, fallbackAdd]
  );

  return ctx ?? fallback;
}

/** Giá trị của mục thao tác cuối danh sách — không phải một năm. */
const CREATE_VALUE = "__create__";

/**
 * Ô "Năm 2026" có icon lịch, đặt ở cụm phải đầu trang.
 *
 * `onCreateYear` (chỉ màn Lịch và kỳ báo cáo, người có quyền tạo lịch): thêm mục
 * "Tạo lịch năm mới" ở cuối danh sách.
 */
export function YearSelect({
  className,
  onCreateYear,
}: {
  className?: string;
  onCreateYear?: () => void;
}) {
  const { year, setYear, years } = useReportYear();
  // Đổi năm thay cả khung làm việc mà không đổi đường dẫn, nên hộp hỏi "Bỏ thay đổi chưa
  // lưu?" của UnsavedChangesGuard không tự bắt được — màn đang có số chưa lưu (ma trận
  // thiết lập, sửa số tổng hợp, lịch báo cáo…) phải hỏi trước, không thì mất im lặng.
  const confirmDiscard = useConfirmDiscard();

  return (
    <Select
      value={String(year)}
      onValueChange={(v) => {
        if (v === CREATE_VALUE) {
          if (onCreateYear) confirmDiscard(onCreateYear);
          return;
        }
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
        {onCreateYear ? (
          <>
            <SelectSeparator />
            <SelectItem value={CREATE_VALUE}>
              <CalendarPlus aria-hidden />
              Tạo lịch năm mới
            </SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}

YearSelect.displayName = "YearSelect";
