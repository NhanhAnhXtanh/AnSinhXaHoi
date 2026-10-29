import { useEffect, useState, type ReactNode } from "react";
import { Lock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  LoadingState,
  YearSelect,
  formatDate,
  useReportYear,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { cn } from "@/shared/lib/utils";

import { BySheetView } from "./by-sheet-view";
import { ByUnitView } from "./by-unit-view";
import { useHomeDashboard } from "./use-home-dashboard";

type Mode = "sheet" | "unit";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "Thứ Năm, 15/10/2026" */
function todayLabel(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${formatDate(now)}`;
}

/**
 * Câu lỗi cho người dùng: máy chủ trả câu tiếng Việt thì dùng nguyên, còn lại
 * (lỗi mạng, lỗi tiếng Anh của tầng dưới) thay bằng câu chung.
 */
function errorText(message: string | undefined): string {
  const fallback = "Bạn kiểm tra kết nối mạng rồi bấm Thử lại.";
  if (!message) return fallback;
  return /[À-ỹ]/.test(message) ? message : fallback;
}

/**
 * Trang chủ.
 *
 * Hai cách nhìn cùng một năm báo cáo, đổi bằng nút phân đoạn ở đầu trang:
 * "Theo phiếu" đếm phiếu của năm và các kỳ đang nhận số liệu, "Theo đơn vị"
 * xem từng đơn vị đã nộp tới đâu (chỉ người có quyền màn Thiết lập & điều hành
 * mới thấy nút này). Màn không cuộn trang (`fill`): mỗi khối tự cuộn phần nội
 * dung của nó.
 *
 * Số liệu từ `GET /api/asxh_dashboard` (cần quyền xem phiếu nhập); mỗi chế độ
 * một lần nạp riêng. Trang chủ vẫn là màn không gắn quyền (nằm trong
 * `UNGUARDED_RESOURCES`), nên tài khoản không có quyền xem phiếu thấy câu báo
 * thay vì bị chặn khỏi trang.
 */
export const Dashboard = () => {
  const { year } = useReportYear();
  const [mode, setMode] = useState<Mode>("sheet");
  const { data, isLoading, isFetching, error, refetch } = useHomeDashboard(year, mode === "unit");

  // Nhớ quyền xem "Theo đơn vị" qua các lần nạp: lúc chuyển chế độ, truy vấn
  // mới chưa về thì nút chuyển không được nhấp nháy.
  const [canViewUnits, setCanViewUnits] = useState(false);
  const knownViewUnits = data?.capabilities.viewUnits;
  useEffect(() => {
    if (knownViewUnits === undefined) return;
    setCanViewUnits(knownViewUnits);
    if (!knownViewUnits) setMode("sheet");
  }, [knownViewUnits]);

  const refresh = () => {
    void refetch().then((r) => {
      if (r.isError) toast.error("Chưa cập nhật được số liệu, bạn thử lại sau.");
      else toast.success("Đã cập nhật số liệu mới nhất.");
    });
  };

  let content: ReactNode;
  if (isLoading) {
    content = <LoadingState label="Đang tải số liệu…" hint="Mạng chậm, bạn chờ thêm một chút." />;
  } else if (error && error.statusCode === 403) {
    content = (
      <EmptyState
        icon={Lock}
        variant="page"
        title="Bạn chưa được xem số liệu phiếu"
        description="Tài khoản của bạn chưa được cấp quyền xem phiếu báo cáo. Bạn liên hệ quản trị hệ thống để được cấp quyền."
      />
    );
  } else if (error || !data) {
    content = (
      <EmptyState
        icon={TriangleAlert}
        variant="page"
        title="Chưa tải được số liệu trang chủ"
        description={errorText(error?.message)}
        action={
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            Thử lại
          </Button>
        }
      />
    );
  } else if (mode === "unit") {
    content = <ByUnitView data={data} onRefresh={refresh} refreshing={isFetching} />;
  } else {
    content = <BySheetView data={data} />;
  }

  return (
    <AsxhPage
      title="Trang chủ"
      description={
        mode === "sheet"
          ? `${todayLabel()} · Tổng quan phiếu báo cáo năm ${year}`
          : `Tiến độ nộp của từng đơn vị, năm ${year}`
      }
      actions={
        <>
          <YearSelect />
          {canViewUnits && (
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => {
                // Bấm lại nút đang chọn thì giữ nguyên, không bỏ chọn.
                if (v === "sheet" || v === "unit") setMode(v);
              }}
              aria-label="Cách xem"
              className="rounded-md bg-accent p-0.5"
            >
              {(
                [
                  ["sheet", "Theo phiếu"],
                  ["unit", "Theo đơn vị"],
                ] as const
              ).map(([value, label]) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className={cn(
                    "h-8 rounded-[calc(var(--radius)-2px)] px-3 first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)]",
                    "text-muted-foreground hover:bg-transparent hover:text-foreground",
                    "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-e1"
                  )}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </>
      }
      fill
      className="max-xl:h-auto"
    >
      {content}
    </AsxhPage>
  );
};
