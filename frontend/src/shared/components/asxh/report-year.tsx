import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIsAuthenticated, useList } from "@refinedev/core";
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
 *
 * Danh sách năm = các năm đã có lịch báo cáo (`GET /api/report_calendars`) cộng
 * năm đang chọn (vd. năm đang tạo lịch). Chưa đọc được lịch (chưa đăng nhập, vai
 * trò không có quyền xem lịch, lỗi mạng) thì dùng danh sách mặc định.
 */
const STORAGE_KEY = "asxh.reportYear";
const DEFAULT_YEARS = [2024, 2025, 2026, 2027];
const CALENDAR_RESOURCE = "report_calendars";

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
  return [...new Set([...years, year])].sort((a, b) => a - b);
}

/** Năm đã có lịch báo cáo; `null` khi chưa đọc được (dùng danh sách mặc định). */
function useCalendarYears(): number[] | null {
  const { data: auth } = useIsAuthenticated();
  const { result, query } = useList<{ year: number }>({
    resource: CALENDAR_RESOURCE,
    pagination: { currentPage: 1, pageSize: 100 },
    errorNotification: false,
    queryOptions: { enabled: auth?.authenticated === true, retry: false },
  });
  return useMemo(
    () => (query.isSuccess ? (result.data ?? []).map((c) => c.year) : null),
    [query.isSuccess, result.data]
  );
}

export function ReportYearProvider({
  children,
  years = DEFAULT_YEARS,
}: {
  children: ReactNode;
  /** Các năm cho chọn khi chưa đọc được lịch báo cáo; mặc định 2024–2027. */
  years?: number[];
}) {
  const [year, setYearState] = useState<number>(initialYear);
  const calendarYears = useCalendarYears();

  const setYear = useCallback((y: number) => {
    setYearState(y);
    writeStoredYear(y);
  }, []);

  // Lần đầu đọc được lịch: năm nhớ trong trình duyệt mà chưa có lịch (vd. 2024) thì
  // chuyển sang năm nay, năm nay chưa có lịch thì năm có lịch muộn nhất. Chỉ làm một
  // lần — sau đó năm chưa có lịch là do người dùng chủ ý chọn (vd. đang tạo lịch mới).
  const snapped = useRef(false);
  useEffect(() => {
    if (snapped.current || calendarYears === null) return;
    snapped.current = true;
    if (calendarYears.length === 0 || calendarYears.includes(year)) return;
    const now = new Date().getFullYear();
    setYear(calendarYears.includes(now) ? now : Math.max(...calendarYears));
  }, [calendarYears, year, setYear]);

  const value = useMemo<ReportYearValue>(
    () => ({ year, setYear, years: withYear(calendarYears ?? years, year) }),
    [year, setYear, years, calendarYears]
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
      {/* Hiện khoảng 7 năm, nhiều hơn thì cuộn; mục tạo lịch nằm ngoài vùng cuộn nên luôn thấy. */}
      <SelectContent
        align="end"
        className={
          onCreateYear
            ? "max-h-[min(17rem,var(--radix-select-content-available-height))]"
            : "max-h-[min(15rem,var(--radix-select-content-available-height))]"
        }
        footer={
          onCreateYear ? (
            <>
              <SelectSeparator className="mt-0" />
              <SelectItem value={CREATE_VALUE}>
                <CalendarPlus aria-hidden />
                Tạo lịch năm mới
              </SelectItem>
            </>
          ) : undefined
        }
      >
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
