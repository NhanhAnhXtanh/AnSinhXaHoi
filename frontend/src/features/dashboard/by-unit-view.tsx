import { useMemo, useState } from "react";
import {
  BuildingComplex,
  CircleCheck,
  RefreshCw,
  Search,
  SearchX,
  SquarePen,
  Undo2,
} from "lucide-react";

import {
  EmptyState,
  ProgressCell,
  StatusBadge,
  TwoLineCell,
  formatDate,
  formatNumber,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

import { ArrowLink, Panel, PanelEmpty, StatCard, StatRow } from "./parts";
import {
  CELL_STATUS,
  UNIT_PROGRESS,
  UNIT_PROGRESS_ORDER,
  UNIT_TYPE_LABEL,
  percent,
  reportBadge,
  unitProgress,
} from "./status";
import type {
  HomeDashboard,
  ReportUnitType,
  UnitBoard,
  UnitPeriod,
  UnitRow,
  UnitState,
} from "./types";

const ALL = "all";

/** Bảng hiện tối đa bốn cột kỳ gần nhất khi xem "Tất cả kỳ đang nhận" (UC-76). */
const PERIOD_COLUMN_LIMIT = 4;

const EMPTY_BOARD: UnitBoard = {
  periods: [],
  summary: {
    unitCount: 0,
    reportCount: 0,
    complete: 0,
    notSubmitted: 0,
    partial: 0,
    returned: 0,
    returnedReports: 0,
  },
  typeShares: [],
  items: [],
};

/** Phiếu của đơn vị trong các kỳ đang lọc (`null` = mọi kỳ). */
const reportsIn = (unit: UnitRow, periodId: number | null) =>
  periodId === null ? unit.reports : unit.reports.filter((r) => r.periodId === periodId);

/**
 * Trang chủ, chế độ "Theo đơn vị": tiến độ nộp của từng đơn vị qua các kỳ
 * đang nhận số liệu, bảng bên trái, chi tiết đơn vị đang chọn bên phải.
 *
 * Thẻ chỉ số và phân bố theo loại là số máy chủ đã tính trên mọi kỳ; tìm kiếm,
 * lọc kỳ, lọc loại và chip tình trạng lọc tại chỗ trên danh sách đã nạp.
 */
export function ByUnitView({
  data,
  onRefresh,
  refreshing,
}: {
  data: HomeDashboard;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { year, capabilities } = data;
  const board = data.units ?? EMPTY_BOARD;
  const units = board.items;

  const [search, setSearch] = useState("");
  const [periodValue, setPeriodValue] = useState<string>(ALL);
  const [unitType, setUnitType] = useState<string>(ALL);
  const [progress, setProgress] = useState<UnitState | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Kỳ đang lọc: giá trị cũ không còn trong danh sách (đổi năm) thì về "tất cả".
  const periodId =
    periodValue === ALL || !board.periods.some((p) => String(p.id) === periodValue)
      ? null
      : Number(periodValue);
  const columns: UnitPeriod[] =
    periodId === null
      ? board.periods.slice(-PERIOD_COLUMN_LIMIT)
      : board.periods.filter((p) => p.id === periodId);

  // Lọc theo tìm kiếm, kỳ, loại; chip trạng thái đếm trên kết quả đó.
  const scoped = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    const rows: { unit: UnitRow; progress: UnitState }[] = [];
    for (const unit of units) {
      if (unitType !== ALL && unit.type !== unitType) continue;
      if (q && !unit.name.toLocaleLowerCase("vi").includes(q)) continue;
      const p = unitProgress(unit, periodId);
      if (p) rows.push({ unit, progress: p });
    }
    return rows;
  }, [units, search, unitType, periodId]);

  const chipCounts = UNIT_PROGRESS_ORDER.reduce(
    (acc, k) => {
      acc[k] = scoped.filter((r) => r.progress === k).length;
      return acc;
    },
    {} as Record<UnitState, number>
  );
  const rows = progress ? scoped.filter((r) => r.progress === progress) : scoped;
  // Chưa bấm đơn vị nào thì xem đơn vị đầu bảng.
  const selected =
    (selectedId !== null ? units.find((u) => u.id === selectedId) : undefined) ??
    rows[0]?.unit ??
    null;

  const { summary } = board;
  const notComplete = summary.notSubmitted + summary.partial;
  const typeOptions: ReportUnitType[] = board.typeShares.map((s) => s.type);
  const hasUnits = units.length > 0;

  const resetFilters = () => {
    setSearch("");
    setPeriodValue(ALL);
    setUnitType(ALL);
    setProgress(null);
  };

  return (
    <>
      <StatRow>
        <StatCard
          icon={BuildingComplex}
          tone="primary"
          value={summary.unitCount}
          label={`Đơn vị phải nộp (${formatNumber(summary.reportCount)} phiếu, ${board.periods.length} kỳ)`}
        />
        <StatCard
          icon={CircleCheck}
          tone="success"
          value={summary.complete}
          label={`Đã nộp đủ (${percent(summary.complete, summary.unitCount)}% số đơn vị)`}
        />
        <StatCard
          icon={SquarePen}
          tone="warning"
          value={notComplete}
          label={`Chưa nộp đủ (${summary.notSubmitted} chưa nộp, ${summary.partial} nộp thiếu)`}
        />
        <StatCard
          icon={Undo2}
          tone="destructive"
          value={summary.returned}
          label="Có phiếu bị trả lại"
          to={capabilities.approve ? "/report-review" : "/input-reports"}
        />
      </StatRow>

      <div
        className={cn(
          "grid min-h-0 grid-cols-1 gap-4",
          "xl:flex-1 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]"
        )}
      >
        {/* Tiến độ nộp theo đơn vị */}
        <Panel className="max-xl:max-h-[48rem]">
          <h2 className="shrink-0 text-base leading-6 font-semibold">
            Tiến độ nộp theo đơn vị
          </h2>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm đơn vị..."
                aria-label="Tìm đơn vị"
                className="ps-9"
              />
            </div>
            <Select
              value={periodId === null ? ALL : String(periodId)}
              onValueChange={setPeriodValue}
            >
              <SelectTrigger className="w-40" aria-label="Lọc theo kỳ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả kỳ đang nhận</SelectItem>
                {board.periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={unitType} onValueChange={setUnitType}>
              <SelectTrigger className="w-40" aria-label="Lọc theo loại đơn vị">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả loại đơn vị</SelectItem>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {UNIT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Làm mới"
              title="Làm mới"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2" role="group" aria-label="Lọc theo tình trạng">
            <FilterChip
              active={progress === null}
              onClick={() => setProgress(null)}
              label="Tất cả"
              count={scoped.length}
            />
            {UNIT_PROGRESS_ORDER.map((k) => (
              <FilterChip
                key={k}
                active={progress === k}
                onClick={() => setProgress(progress === k ? null : k)}
                label={UNIT_PROGRESS[k].label}
                count={chipCounts[k]}
                dot={UNIT_PROGRESS[k].dot}
              />
            ))}
          </div>

          <div className="scrollbar-fade min-h-0 flex-1 overflow-auto rounded-md border">
            {rows.length === 0 ? (
              hasUnits ? (
                <EmptyState
                  icon={SearchX}
                  title="Không có đơn vị nào khớp"
                  description="Bạn thử đổi từ khoá tìm kiếm hoặc bỏ bớt bộ lọc."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Bỏ lọc
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={BuildingComplex}
                  title={
                    data.hasPeriods
                      ? `Năm ${year} chưa có kỳ nào đang nhận số liệu`
                      : "Chưa có kỳ báo cáo nào"
                  }
                  description="Khi Sở mở đợt nhận số liệu, tiến độ của từng đơn vị sẽ hiện ở đây."
                />
              )
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-subtle">
                  <tr className="border-b">
                    <th className="text-muted-foreground px-3 py-2.5 text-left text-xs font-medium">
                      Đơn vị
                    </th>
                    {columns.map((p) => (
                      <th
                        key={p.id}
                        className="text-muted-foreground w-32 px-3 py-2.5 text-left text-xs font-medium"
                      >
                        {p.name}
                      </th>
                    ))}
                    <th className="text-muted-foreground w-36 px-3 py-2.5 text-left text-xs font-medium">
                      Tiến độ biểu
                    </th>
                    <th className="text-muted-foreground w-32 px-3 py-2.5 text-left text-xs font-medium">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ unit, progress: p }) => {
                    const isSelected = unit.id === selected?.id;
                    const inScope = reportsIn(unit, periodId);
                    const done = inScope.reduce((n, r) => n + r.sheetsDone, 0);
                    const total = inScope.reduce((n, r) => n + r.sheetsTotal, 0);
                    return (
                      <tr
                        key={unit.id}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(unit.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(unit.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b last:border-b-0 outline-none",
                          "hover:bg-surface-subtle focus-visible:bg-accent",
                          isSelected && "bg-info-subtle hover:bg-info-subtle"
                        )}
                      >
                        <td className="px-3 py-2">
                          <TwoLineCell
                            primary={unit.name}
                            secondary={`${UNIT_TYPE_LABEL[unit.type]} · ${inScope.length} phiếu`}
                          />
                        </td>
                        {columns.map((period) => {
                          const cell = unit.periodStates[String(period.id)];
                          return (
                            <td key={period.id} className="px-3 py-2">
                              {cell && (
                                <StatusBadge tone={CELL_STATUS[cell].tone}>
                                  {CELL_STATUS[cell].label}
                                </StatusBadge>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <ProgressCell done={done} total={total} />
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={UNIT_PROGRESS[p].tone}>
                            {UNIT_PROGRESS[p].label}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-muted-foreground shrink-0 text-xs">
            Hiển thị {formatNumber(rows.length)} / {formatNumber(units.length)} đơn vị · Bấm
            một đơn vị để xem từng phiếu
          </p>
        </Panel>

        {/* Cột phải: chi tiết đơn vị + phân bố theo loại */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Panel className="xl:flex-1">
            {selected ? (
              <UnitDetail
                unit={selected}
                periods={board.periods}
                periodId={periodId}
                canApprove={capabilities.approve}
              />
            ) : (
              <>
                <h2 className="text-base leading-6 font-semibold">Chi tiết đơn vị</h2>
                <PanelEmpty>Bấm một đơn vị trong bảng để xem từng phiếu.</PanelEmpty>
              </>
            )}
          </Panel>

          <Panel className="shrink-0 gap-3.5">
            <h2 className="text-base leading-6 font-semibold">Phân bố theo loại đơn vị</h2>
            {board.typeShares.length === 0 ? (
              <PanelEmpty>Năm {year} chưa có đơn vị nào phải nộp.</PanelEmpty>
            ) : (
              board.typeShares.map(({ type, complete, total }) => (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{UNIT_TYPE_LABEL[type]}</span>
                    <span className="text-muted-foreground flex-1 text-xs">{total} đơn vị</span>
                    <span className="text-[13px] leading-5 font-medium tabular-nums">
                      {complete}/{total} · {percent(complete, total)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full bg-success"
                      style={{ width: `${percent(complete, total)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Chip lọc bo 8px: nhãn + số, chấm màu theo tình trạng. */
function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary bg-accent text-foreground"
          : "bg-card text-foreground hover:bg-surface-subtle"
      )}
    >
      {dot && <span className={cn("size-2 rounded-full", dot)} aria-hidden />}
      {label}
      <span className="tabular-nums">{formatNumber(count)}</span>
    </button>
  );
}

/** Panel phải: tình trạng từng phiếu của đơn vị đang chọn. */
function UnitDetail({
  unit,
  periods,
  periodId,
  canApprove,
}: {
  unit: UnitRow;
  periods: UnitPeriod[];
  periodId: number | null;
  canApprove: boolean;
}) {
  const reports = reportsIn(unit, periodId);
  const p = unitProgress(unit, periodId) ?? unit.state;
  const periodCount = new Set(reports.map((r) => r.periodId)).size;

  const stats = [
    {
      label: "Đã duyệt",
      value: reports.filter((r) => r.status === "APPROVED" || (r.status === "LOCKED" && r.approvedAt)).length,
      text: "text-success-text",
    },
    {
      label: "Chờ duyệt",
      value: reports.filter((r) => r.status === "SUBMITTED").length,
      text: "text-warning-text",
    },
    {
      label: "Bị trả lại",
      value: reports.filter((r) => r.status === "RETURNED").length,
      text: "text-destructive-text",
    },
    {
      label: "Đang nhập liệu",
      value: reports.filter((r) => r.status === "DRAFT" || (r.status === "LOCKED" && !r.approvedAt)).length,
      text: "text-info-text",
    },
  ];

  return (
    <div className="scrollbar-fade -mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base leading-6 font-semibold">{unit.name}</h2>
          <StatusBadge tone={UNIT_PROGRESS[p].tone}>{UNIT_PROGRESS[p].label}</StatusBadge>
        </div>
        <span className="text-muted-foreground text-xs">
          {UNIT_TYPE_LABEL[unit.type]} · {reports.length} phiếu trong {periodCount} kỳ
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col rounded-md bg-surface-subtle px-3 py-2.5">
            <span className={cn("text-xl leading-7 font-bold tabular-nums", s.text)}>
              {s.value}
            </span>
            <span className="text-muted-foreground text-xs">{s.label}</span>
          </div>
        ))}
      </div>

      {reports.map((r) => {
        const period = periods.find((x) => x.id === r.periodId);
        const badge = reportBadge(r.status, r.sheetsDone, r.approvedAt);
        const editable = r.status === "DRAFT" || r.status === "RETURNED";
        const link =
          r.status === "SUBMITTED" && canApprove ? `/report-review/${r.id}` : `/input-reports/${r.id}`;
        return (
          <div key={r.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {period?.name ?? "Kỳ báo cáo"} · Đợt {r.publicationNo}
              </span>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </div>
            <span className="text-muted-foreground text-xs">
              {period?.deadline ? `Hạn nộp ${formatDate(period.deadline)}` : "Chưa đặt hạn nộp"}
            </span>
            <ProgressCell done={r.sheetsDone} total={r.sheetsTotal} />
            {r.status === "RETURNED" && r.returnReason?.trim() && (
              <p className="rounded-md bg-destructive-subtle px-3 py-2.5 text-[13px] leading-5 text-destructive-text">
                Lý do trả lại: {r.returnReason.trim()}
              </p>
            )}
            {editable && r.pendingSheets.length > 0 && (
              <p className="rounded-md bg-surface-subtle px-3 py-2.5 text-[13px] leading-5">
                Biểu chưa xong: biểu {r.pendingSheets.join(", ")}
              </p>
            )}
            <div>
              <ArrowLink to={link}>Mở phiếu</ArrowLink>
            </div>
          </div>
        );
      })}

      <div>
        <ArrowLink to="/input-reports">Mở danh sách phiếu</ArrowLink>
      </div>
    </div>
  );
}
