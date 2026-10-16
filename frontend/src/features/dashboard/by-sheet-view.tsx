import type { LucideIcon } from "lucide-react";
import {
  BuildingComplex,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  Clock,
  ClockAlert,
  FileText,
  ListChecks,
  SquarePen,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { StatusBadge, formatNumber } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import { PERIODS, TODO_ITEMS, type SheetStatus, type TodoItem } from "./fixtures";
import {
  Donut,
  Panel,
  PanelEmpty,
  PanelHeader,
  StackedBar,
  StatCard,
  StatRow,
} from "./parts";
import { SHEET_STATUS, SHEET_STATUS_ORDER, percent } from "./status";

const QUICK_LINKS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "Nhập liệu báo cáo", to: "/input-reports", icon: SquarePen },
  { label: "Duyệt phiếu nhập", to: "/report-review", icon: ClipboardCheck },
  { label: "Tổng hợp báo cáo", to: "/summary", icon: ChartColumn },
  { label: "Thiết lập & điều hành", to: "/period-setup", icon: ListChecks },
  { label: "Bộ biểu mẫu", to: "/templates", icon: FileText },
  { label: "Lịch và kỳ báo cáo", to: "/report-calendar", icon: CalendarDays },
  { label: "Danh sách đơn vị", to: "/report-units", icon: BuildingComplex },
  { label: "Người dùng", to: "/users", icon: Users },
];

/** Việc chờ Sở duyệt thì mở màn duyệt; còn lại là việc của đơn vị nhập. */
const todoLink = (item: TodoItem) =>
  item.status === "pending" ? "/report-review" : "/input-reports";

/**
 * Trang chủ, chế độ "Theo phiếu": đếm phiếu của các kỳ đang nhận số liệu.
 * `hasData = false` khi năm đang chọn chưa có kỳ nào — các khối hiện câu trống.
 */
export function BySheetView({ year, hasData }: { year: number; hasData: boolean }) {
  const periods = hasData ? PERIODS : [];
  const todo = hasData ? TODO_ITEMS : [];

  const totals = SHEET_STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = periods.reduce((n, p) => n + p.counts[s], 0);
      return acc;
    },
    {} as Record<SheetStatus, number>
  );
  const total = SHEET_STATUS_ORDER.reduce((n, s) => n + totals[s], 0);
  const submitted = totals.approved + totals.pending;
  const notDone = totals.entering + totals.returned;
  const overdue = periods
    .filter((p) => p.overdue)
    .reduce((n, p) => n + p.counts.entering, 0);

  return (
    <>
      <StatRow>
        <StatCard icon={SquarePen} tone="primary" value={notDone} label="Phiếu cần xử lý" />
        <StatCard icon={Clock} tone="warning" value={totals.pending} label="Chờ duyệt" />
        <StatCard
          icon={CircleCheck}
          tone="success"
          value={totals.approved}
          label={`Đã duyệt (${percent(totals.approved, total)}% tổng số phiếu)`}
        />
        <StatCard icon={ClockAlert} tone="destructive" value={overdue} label="Quá hạn" />
      </StatRow>

      <div
        className={cn(
          "grid min-h-0 grid-cols-1 gap-4",
          "xl:flex-1 xl:grid-cols-[minmax(0,1.87fr)_minmax(0,1fr)]",
          "xl:grid-rows-[minmax(0,0.92fr)_minmax(0,1fr)]"
        )}
      >
        {/* Phân bố theo kỳ */}
        <Panel>
          <PanelHeader
            title="Phân bố theo kỳ"
            linkLabel="Thiết lập & điều hành"
            linkTo="/period-setup"
          />
          {periods.length === 0 ? (
            <PanelEmpty>Năm {year} không có kỳ nào đang nhận số liệu.</PanelEmpty>
          ) : (
            <ul className="scrollbar-fade -mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1">
              {periods.map((p) => {
                const pTotal = SHEET_STATUS_ORDER.reduce((n, s) => n + p.counts[s], 0);
                const pSubmitted = p.counts.approved + p.counts.pending;
                return (
                  <li key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <StatusBadge tone={p.overdue ? "overdue" : "info"}>
                        {p.deadlineLabel}
                      </StatusBadge>
                      <span className="ms-auto text-[13px] leading-5 font-medium tabular-nums">
                        {pSubmitted}/{pTotal} phiếu đã nộp · {percent(pSubmitted, pTotal)}%
                      </span>
                    </div>
                    <StackedBar
                      total={pTotal}
                      label={`${p.name}: ${SHEET_STATUS_ORDER.map(
                        (s) => `${SHEET_STATUS[s].label} ${p.counts[s]}`
                      ).join(", ")}`}
                      segments={(["approved", "pending", "returned"] as const).map((s) => ({
                        key: s,
                        value: p.counts[s],
                        fill: SHEET_STATUS[s].fill,
                      }))}
                    />
                    <span className="text-muted-foreground text-xs">
                      Nhận số liệu {p.range}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Tình trạng phiếu */}
        <Panel>
          <PanelHeader title="Tình trạng phiếu" />
          {total === 0 ? (
            <PanelEmpty>Năm {year} chưa có phiếu nào được nộp.</PanelEmpty>
          ) : (
            <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-8">
              <Donut
                total={total}
                label={`Đã nộp ${percent(submitted, total)}% số phiếu`}
                segments={SHEET_STATUS_ORDER.map((s) => ({
                  key: s,
                  value: totals[s],
                  stroke: SHEET_STATUS[s].stroke,
                }))}
              >
                <span className="text-3xl leading-9 font-bold tabular-nums">
                  {percent(submitted, total)}%
                </span>
                <span className="text-muted-foreground text-[13px] leading-5">đã nộp</span>
              </Donut>
              <ul className="flex min-w-48 flex-1 flex-col gap-3.5">
                {SHEET_STATUS_ORDER.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", SHEET_STATUS[s].fill)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{SHEET_STATUS[s].label}</span>
                    <span className="font-semibold tabular-nums">
                      {formatNumber(totals[s])}
                    </span>
                    <span className="text-muted-foreground w-9 text-right text-[13px] tabular-nums">
                      {percent(totals[s], total)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* Cần xử lý */}
        <Panel>
          <PanelHeader title="Cần xử lý" linkLabel="Xem tất cả" linkTo="/input-reports" />
          {todo.length === 0 ? (
            <PanelEmpty>Mọi đơn vị đã nộp đủ phiếu của các kỳ đang mở.</PanelEmpty>
          ) : (
            <ul className="scrollbar-fade -mx-1 min-h-0 overflow-y-auto px-1">
              {todo.map((item) => (
                <li key={item.id} className="border-b last:border-b-0">
                  <Link
                    to={todoLink(item)}
                    className={cn(
                      "flex items-center gap-3 rounded-sm py-2",
                      "hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{item.unit}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {item.detail}
                      </span>
                    </div>
                    {item.status === "overdue" ? (
                      <StatusBadge tone="overdue">Quá hạn</StatusBadge>
                    ) : (
                      <StatusBadge tone={SHEET_STATUS[item.status].tone}>
                        {SHEET_STATUS[item.status].label}
                      </StatusBadge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Truy cập nhanh */}
        <Panel>
          <PanelHeader title="Truy cập nhanh" />
          <div className="scrollbar-fade grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-md border bg-surface-subtle px-3",
                  "text-sm font-medium transition-colors hover:bg-accent",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
