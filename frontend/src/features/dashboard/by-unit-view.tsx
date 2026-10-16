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
import { toast } from "sonner";

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

import {
  SHEETS_PER_REPORT,
  SHEET_NAMES,
  UNITS,
  UNIT_PERIODS,
  UNIT_TYPE_LABEL,
  type Unit,
  type UnitType,
} from "./fixtures";
import { ArrowLink, Panel, PanelEmpty, StatCard, StatRow } from "./parts";
import {
  CELL_STATUS,
  UNIT_PROGRESS,
  UNIT_PROGRESS_ORDER,
  isSubmitted,
  percent,
  unitProgress,
  type UnitProgress,
} from "./status";

const ALL = "all";
const ALL_PERIOD_IDS = UNIT_PERIODS.map((p) => p.id);
const NO_UNITS: Unit[] = [];

/**
 * Phiếu đáng nhìn nhất của một đơn vị: phiếu đầu tiên chưa nộp xong
 * (đang nhập, chưa nộp hoặc bị trả lại); nộp hết rồi thì coi như đủ biểu.
 */
function currentDone(unit: Unit, periodIds: string[]): number {
  const open = unit.reports.find(
    (r) => periodIds.includes(r.periodId) && !isSubmitted(r.status)
  );
  return open ? open.done : SHEETS_PER_REPORT;
}

/** Tên các biểu chưa xong của một phiếu, xoay theo đơn vị cho khác nhau. */
function unfinishedSheets(done: number, seed: number): string[] {
  const missing = SHEETS_PER_REPORT - done;
  if (missing <= 0) return [];
  const start = seed % SHEET_NAMES.length;
  const rotated = [...SHEET_NAMES.slice(start), ...SHEET_NAMES.slice(0, start)];
  return rotated
    .slice(0, missing)
    .sort((a, b) => SHEET_NAMES.indexOf(a) - SHEET_NAMES.indexOf(b));
}

/**
 * Trang chủ, chế độ "Theo đơn vị": tiến độ nộp của từng đơn vị qua các kỳ
 * đang nhận số liệu, bảng bên trái, chi tiết đơn vị đang chọn bên phải.
 */
export function ByUnitView({ year, hasData }: { year: number; hasData: boolean }) {
  const units = hasData ? UNITS : NO_UNITS;

  const [search, setSearch] = useState("");
  const [periodId, setPeriodId] = useState<string>(ALL);
  const [unitType, setUnitType] = useState<string>(ALL);
  const [progress, setProgress] = useState<UnitProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(units[0]?.id ?? null);

  const periodIds = useMemo(
    () => (periodId === ALL ? ALL_PERIOD_IDS : [periodId]),
    [periodId]
  );
  const periods = UNIT_PERIODS.filter((p) => periodIds.includes(p.id));

  // Thẻ chỉ số và phân bố theo loại tính trên mọi kỳ, không theo bộ lọc.
  const overall = useMemo(() => {
    const counts: Record<UnitProgress, number> = {
      notSubmitted: 0,
      returned: 0,
      partial: 0,
      complete: 0,
    };
    const byType: Record<UnitType, { complete: number; total: number }> = {
      xa: { complete: 0, total: 0 },
      truong: { complete: 0, total: 0 },
      so: { complete: 0, total: 0 },
    };
    for (const u of units) {
      const p = unitProgress(u, ALL_PERIOD_IDS);
      counts[p] += 1;
      byType[u.type].total += 1;
      if (p === "complete") byType[u.type].complete += 1;
    }
    return { counts, byType };
  }, [units]);

  // Lọc theo tìm kiếm, kỳ, loại; chip trạng thái đếm trên kết quả đó.
  const scoped = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return units
      .filter((u) => unitType === ALL || u.type === unitType)
      .filter((u) => !q || u.name.toLocaleLowerCase("vi").includes(q))
      .map((u) => ({ unit: u, progress: unitProgress(u, periodIds) }));
  }, [units, search, unitType, periodIds]);

  const chipCounts = UNIT_PROGRESS_ORDER.reduce(
    (acc, k) => {
      acc[k] = scoped.filter((r) => r.progress === k).length;
      return acc;
    },
    {} as Record<UnitProgress, number>
  );
  const rows = progress ? scoped.filter((r) => r.progress === progress) : scoped;
  // Chưa bấm đơn vị nào (hoặc vừa đổi sang năm có dữ liệu) thì xem đơn vị đầu bảng.
  const selected =
    units.find((u) => u.id === selectedId) ?? (selectedId ? null : (units[0] ?? null));

  const notComplete = overall.counts.notSubmitted + overall.counts.partial;
  const totalReports = units.length * UNIT_PERIODS.length;

  const resetFilters = () => {
    setSearch("");
    setPeriodId(ALL);
    setUnitType(ALL);
    setProgress(null);
  };

  return (
    <>
      <StatRow>
        <StatCard
          icon={BuildingComplex}
          tone="primary"
          value={units.length}
          label={`Đơn vị phải nộp (${formatNumber(totalReports)} phiếu, ${UNIT_PERIODS.length} kỳ)`}
        />
        <StatCard
          icon={CircleCheck}
          tone="success"
          value={overall.counts.complete}
          label={`Đã nộp đủ (${percent(overall.counts.complete, units.length)}% số đơn vị)`}
        />
        <StatCard
          icon={SquarePen}
          tone="warning"
          value={notComplete}
          label={`Chưa nộp đủ (${overall.counts.notSubmitted} chưa nộp, ${overall.counts.partial} nộp thiếu)`}
        />
        <StatCard
          icon={Undo2}
          tone="destructive"
          value={overall.counts.returned}
          label="Có phiếu bị trả lại"
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
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-40" aria-label="Lọc theo kỳ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả kỳ đang nhận</SelectItem>
                {UNIT_PERIODS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
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
                {(Object.keys(UNIT_TYPE_LABEL) as UnitType[]).map((t) => (
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
              onClick={() => toast.success("Đã cập nhật số liệu mới nhất.")}
            >
              <RefreshCw />
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
              hasData ? (
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
                  title={`Năm ${year} chưa có kỳ nào đang nhận số liệu`}
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
                    {periods.map((p) => (
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
                            secondary={`${UNIT_TYPE_LABEL[unit.type]} · ${periods.length} phiếu`}
                          />
                        </td>
                        {periods.map((period) => {
                          const r = unit.reports.find((x) => x.periodId === period.id);
                          return (
                            <td key={period.id} className="px-3 py-2">
                              {r && (
                                <StatusBadge tone={CELL_STATUS[r.status].tone}>
                                  {CELL_STATUS[r.status].label}
                                </StatusBadge>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <ProgressCell
                            done={currentDone(unit, periodIds)}
                            total={SHEETS_PER_REPORT}
                          />
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
              <UnitDetail unit={selected} periodIds={periodIds} />
            ) : (
              <>
                <h2 className="text-base leading-6 font-semibold">Chi tiết đơn vị</h2>
                <PanelEmpty>Bấm một đơn vị trong bảng để xem từng phiếu.</PanelEmpty>
              </>
            )}
          </Panel>

          <Panel className="shrink-0 gap-3.5">
            <h2 className="text-base leading-6 font-semibold">Phân bố theo loại đơn vị</h2>
            {units.length === 0 ? (
              <PanelEmpty>Năm {year} chưa có đơn vị nào phải nộp.</PanelEmpty>
            ) : (
              (Object.keys(UNIT_TYPE_LABEL) as UnitType[]).map((t) => {
                const { complete, total } = overall.byType[t];
                return (
                  <div key={t} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{UNIT_TYPE_LABEL[t]}</span>
                      <span className="text-muted-foreground flex-1 text-xs">
                        {total} đơn vị
                      </span>
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
                );
              })
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
function UnitDetail({ unit, periodIds }: { unit: Unit; periodIds: string[] }) {
  const reports = unit.reports.filter((r) => periodIds.includes(r.periodId));
  const p = unitProgress(unit, periodIds);
  const seed = Number(unit.id.replace(/\D/g, "")) || 0;

  const stats = [
    {
      label: "Đã duyệt",
      value: reports.filter((r) => r.status === "approved").length,
      text: "text-success-text",
    },
    {
      label: "Chờ duyệt",
      value: reports.filter((r) => r.status === "pending").length,
      text: "text-warning-text",
    },
    {
      label: "Bị trả lại",
      value: reports.filter((r) => r.status === "returned").length,
      text: "text-destructive-text",
    },
    {
      label: "Đang nhập liệu",
      value: reports.filter((r) => r.status === "entering" || r.status === "notStarted")
        .length,
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
          {UNIT_TYPE_LABEL[unit.type]} · {reports.length} phiếu trong {reports.length} kỳ
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

      {reports.map((r, i) => {
        const period = UNIT_PERIODS.find((x) => x.id === r.periodId);
        if (!period) return null;
        const missing = isSubmitted(r.status) ? [] : unfinishedSheets(r.done, seed + i);
        return (
          <div key={r.periodId} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {period.name} · {period.batch}
              </span>
              <StatusBadge tone={CELL_STATUS[r.status].tone}>
                {CELL_STATUS[r.status].label}
              </StatusBadge>
            </div>
            <span className="text-muted-foreground text-xs">
              Hạn nộp {formatDate(period.deadline)}
            </span>
            <ProgressCell done={r.done} total={SHEETS_PER_REPORT} />
            {missing.length > 0 && (
              <p className="rounded-md bg-surface-subtle px-3 py-2.5 text-[13px] leading-5">
                Biểu chưa xong: biểu {missing.join(", ")}
              </p>
            )}
          </div>
        );
      })}

      <div>
        <ArrowLink to="/input-reports">Mở danh sách phiếu</ArrowLink>
      </div>
    </div>
  );
}
