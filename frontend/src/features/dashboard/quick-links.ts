import type { LucideIcon } from "lucide-react";
import {
  BuildingComplex,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileText,
  ListChecks,
  SquareCheckBig,
  SquarePen,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import { useCanOpen } from "./use-can-open";

export type QuickLink = { label: string; to: string; icon: LucideIcon };

/** Nút Truy cập nhanh của trang chủ có số liệu phiếu — chỉ hiện khi tài khoản mở được màn đích. */
export const QUICK_LINKS: readonly QuickLink[] = [
  { label: "Nhập liệu báo cáo", to: "/input-reports", icon: SquarePen },
  { label: "Duyệt phiếu nhập", to: "/report-review", icon: ClipboardCheck },
  { label: "Tổng hợp báo cáo", to: "/summary", icon: ChartColumn },
  { label: "Thiết lập & điều hành", to: "/period-setup", icon: ListChecks },
  { label: "Bộ biểu mẫu", to: "/templates", icon: FileText },
  { label: "Lịch và kỳ báo cáo", to: "/report-calendar", icon: CalendarDays },
  { label: "Danh sách đơn vị", to: "/report-units", icon: BuildingComplex },
  { label: "Người dùng", to: "/users", icon: Users },
];

/**
 * Trang chủ của tài khoản không xem phiếu (lãnh đạo UBND, vai trò hệ thống): thêm lối tới "Duyệt
 * báo cáo năm" — việc chính của UBND, không nằm trong 8 nút của trang chủ có số liệu.
 */
export const NEUTRAL_QUICK_LINKS: readonly QuickLink[] = [
  { label: "Duyệt báo cáo năm", to: "/annual-review", icon: SquareCheckBig },
  ...QUICK_LINKS,
];

/**
 * Các nút tài khoản mở được (`useCanOpen`, cùng luật lọc menu bên trái). Chưa tải xong danh sách
 * quyền thì chưa hiện nút nào, để không nháy nút rồi mất.
 */
export function useQuickLinks(links: readonly QuickLink[] = QUICK_LINKS): QuickLink[] {
  const canOpen = useCanOpen();
  return useMemo(() => links.filter((link) => canOpen(link.to)), [links, canOpen]);
}
