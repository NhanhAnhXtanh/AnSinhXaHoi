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
import { useMemo } from "react";
import { Link } from "react-router";

import { StatusBadge, formatNumber } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import {
  Donut,
  Panel,
  PanelEmpty,
  PanelHeader,
  StackedBar,
  StatCard,
  StatRow,
} from "./parts";
import {
  SHEET_STATUS,
  deadlineLabel,
  percent,
  receivingRange,
  statusesOf,
  todoDetail,
  type SheetStatus,
} from "./status";
import type { Counts, HomeDashboard, TodoItem } from "./types";
import { useCanOpen } from "./use-can-open";

/** Nút chỉ hiện khi tài khoản mở được màn đích (`useCanOpen`). */
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

/**
 * Các nút Truy cập nhanh tài khoản mở được (`useCanOpen`, cùng luật lọc menu bên trái). Chưa tải
 * xong danh sách quyền thì chưa hiện nút nào, để không nháy nút rồi mất.
 */
function useQuickLinks() {
  const canOpen = useCanOpen();
  return useMemo(() => QUICK_LINKS.filter((link) => canOpen(link.to)), [canOpen]);
}

/** Số đếm của một tình trạng hiển thị. */
const countOf = (counts: Counts, s: SheetStatus): number => counts[s];

/**
 * Việc chờ Sở duyệt thì mở màn duyệt (khi người xem được duyệt); còn lại mở
 * chính phiếu ở màn nhập liệu.
 */
const todoLink = (item: TodoItem, canApprove: boolean) =>
  item.kind === "PENDING" && canApprove
    ? `/report-review/${item.reportId}`
    : `/input-reports/${item.reportId}`;

const todoBadge = (item: TodoItem) => {
  switch (item.kind) {
    case "OVERDUE":
      return <StatusBadge tone="overdue">Quá hạn</StatusBadge>;
    case "PENDING":
      return <StatusBadge tone={SHEET_STATUS.pending.tone}>{SHEET_STATUS.pending.label}</StatusBadge>;
    case "RETURNED":
      return <StatusBadge tone={SHEET_STATUS.returned.tone}>{SHEET_STATUS.returned.label}</StatusBadge>;
    case "ENTERING":
      return <StatusBadge tone={SHEET_STATUS.entering.tone}>{SHEET_STATUS.entering.label}</StatusBadge>;
  }
};

/**
 * Trang chủ, chế độ "Theo phiếu": thẻ chỉ số đếm mọi phiếu của năm; khối
 * "Phân bố theo kỳ" và "Cần xử lý" chỉ xét các kỳ đang nhận số liệu.
 */
export function BySheetView({ data }: { data: HomeDashboard }) {
  const { year, kpi, periods, todo, capabilities, hasPeriods } = data;
  const totals = kpi.counts;
  const total = totals.total;
  const statuses = statusesOf(totals);
  const canApprove = capabilities.approve;
  const quickLinks = useQuickLinks();
  const canOpen = useCanOpen();

  return (
    <>
      <StatRow>
        <StatCard
          icon={SquarePen}
          tone="primary"
          value={kpi.needAction}
          label="Phiếu cần xử lý"
          to="/input-reports"
        />
        <StatCard
          icon={Clock}
          tone="warning"
          value={totals.pending}
          label="Chờ duyệt"
          to={canApprove ? "/report-review" : "/input-reports"}
        />
        <StatCard
          icon={CircleCheck}
          tone="success"
          value={totals.approved}
          label={`Đã duyệt (${percent(totals.approved, total)}% tổng số phiếu)`}
          to={canApprove ? "/report-review" : "/input-reports"}
        />
        <StatCard
          icon={ClockAlert}
          tone="destructive"
          value={kpi.overdue}
          label="Quá hạn"
          to="/input-reports"
        />
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
            <PanelEmpty>
              {hasPeriods
                ? `Năm ${year} không có kỳ nào đang nhận số liệu.`
                : "Chưa có kỳ báo cáo nào."}
            </PanelEmpty>
          ) : (
            <ul className="scrollbar-fade -mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1">
              {periods.map((p) => {
                const pSubmitted = p.counts.approved + p.counts.pending;
                return (
                  <li key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <StatusBadge tone={p.overdue ? "overdue" : "info"}>
                        {deadlineLabel(p.daysLeft, p.overdue)}
                      </StatusBadge>
                      <span className="ms-auto text-[13px] leading-5 font-medium tabular-nums">
                        {formatNumber(pSubmitted)}/{formatNumber(p.counts.total)} phiếu đã nộp ·{" "}
                        {percent(pSubmitted, p.counts.total)}%
                      </span>
                    </div>
                    <StackedBar
                      total={p.counts.total}
                      label={`${p.name}: ${statusesOf(p.counts)
                        .map((s) => `${SHEET_STATUS[s].label} ${countOf(p.counts, s)}`)
                        .join(", ")}`}
                      segments={(["approved", "pending", "returned"] as const).map((s) => ({
                        key: s,
                        value: p.counts[s],
                        fill: SHEET_STATUS[s].fill,
                      }))}
                    />
                    <span className="text-muted-foreground text-xs">
                      {p.counts.total === 0
                        ? "Chưa có phiếu nào trong kỳ"
                        : `Nhận số liệu ${receivingRange(p.openFrom ?? p.fromDate, p.deadline ?? p.toDate)}`}
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
            <PanelEmpty>Năm {year} chưa có phiếu nào.</PanelEmpty>
          ) : (
            <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-8">
              <Donut
                total={total}
                label={`Đã nộp ${percent(kpi.submitted, total)}% số phiếu`}
                segments={statuses.map((s) => ({
                  key: s,
                  value: countOf(totals, s),
                  stroke: SHEET_STATUS[s].stroke,
                }))}
              >
                <span className="text-3xl leading-9 font-bold tabular-nums">
                  {percent(kpi.submitted, total)}%
                </span>
                <span className="text-muted-foreground text-[13px] leading-5">đã nộp</span>
              </Donut>
              <ul className="flex min-w-48 flex-1 flex-col gap-3.5">
                {statuses.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", SHEET_STATUS[s].fill)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{SHEET_STATUS[s].label}</span>
                    <span className="font-semibold tabular-nums">
                      {formatNumber(countOf(totals, s))}
                    </span>
                    <span className="text-muted-foreground w-9 text-right text-[13px] tabular-nums">
                      {percent(countOf(totals, s), total)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* Cần xử lý */}
        <Panel>
          <PanelHeader
            title={
              todo.total > todo.items.length
                ? `Cần xử lý (${formatNumber(todo.total)})`
                : "Cần xử lý"
            }
            linkLabel="Xem tất cả"
            linkTo="/input-reports"
          />
          {todo.items.length === 0 ? (
            <PanelEmpty>
              {periods.length === 0
                ? `Năm ${year} không có kỳ nào đang nhận số liệu.`
                : "Mọi đơn vị đã nộp đủ phiếu của các kỳ đang mở."}
            </PanelEmpty>
          ) : (
            <ul className="scrollbar-fade -mx-1 min-h-0 overflow-y-auto px-1">
              {todo.items.map((item) => {
                const to = todoLink(item, canApprove);
                const content = (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{item.unitName}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {todoDetail(item)}
                      </span>
                    </div>
                    {todoBadge(item)}
                  </>
                );
                return (
                  <li key={item.reportId} className="border-b last:border-b-0">
                    {canOpen(to) ? (
                      <Link
                        to={to}
                        className={cn(
                          "flex items-center gap-3 rounded-sm py-2",
                          "hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        )}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Truy cập nhanh */}
        <Panel>
          <PanelHeader title="Truy cập nhanh" />
          <div className="scrollbar-fade grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {quickLinks.map(({ label, to, icon: Icon }) => (
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
