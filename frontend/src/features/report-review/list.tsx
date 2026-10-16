import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarX,
  CircleCheck,
  Download,
  Eye,
  History,
  RefreshCw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  ProgressCell,
  QuickFilterCards,
  RowActions,
  StatusBadge,
  TwoLineCell,
  YearSelect,
  formatDate,
  useReportYear,
  type ActionItem,
  type PrimaryAction,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";

import {
  ALL,
  EMPTY_MORE_FILTERS,
  MoreFilters,
  countMoreFilters,
  type MoreFilterValue,
} from "./components/more-filters";
import { Pager } from "./components/pager";
import { VersionHistoryDialog } from "./components/version-history-dialog";
import type { ReviewReport, ReviewStatus } from "./fixtures";
import {
  NO_DATA_REASON,
  STATUS_META,
  STATUS_ORDER,
  TOTAL_SHEETS,
  exportFileName,
  hasNoData,
  normalize,
  statusSubline,
  timeOf,
} from "./model";
import { useReviewReports } from "./store";

const BLOCKS = ["Khối huyện", "Khối xã"] as const;

/** Kỳ mới nhất lên đầu; cùng kỳ thì theo tên đơn vị. */
function compareReports(a: ReviewReport, b: ReviewReport): number {
  if (a.period.key !== b.period.key) return a.period.key < b.period.key ? 1 : -1;
  return a.orgName.localeCompare(b.orgName, "vi");
}

const uniq = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "vi"));

/**
 * Duyệt phiếu nhập (Sở) — hàng đợi phiếu các đơn vị đã nộp trong năm đang chọn.
 * Chỉ là hàng đợi: phê duyệt / trả lại nằm ở màn Xem phiếu.
 */
export function ReviewList() {
  const navigate = useNavigate();
  const { year } = useReportYear();
  const all = useReviewReports();

  const [quick, setQuick] = useState<ReviewStatus | null>(null);
  const [search, setSearch] = useState("");
  const [periodKey, setPeriodKey] = useState<string>(ALL);
  const [block, setBlock] = useState<string>(ALL);
  const [more, setMore] = useState<MoreFilterValue>(EMPTY_MORE_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [historyFor, setHistoryFor] = useState<ReviewReport | null>(null);
  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const yearReports = useMemo(
    () => all.filter((r) => r.period.year === year).sort(compareReports),
    [all, year]
  );

  const periods = useMemo(() => {
    const map = new Map<string, string>();
    yearReports.forEach((r) => map.set(r.period.key, r.period.name));
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [yearReports]);

  const districts = useMemo(() => uniq(yearReports.map((r) => r.district)), [yearReports]);
  const templateSets = useMemo(
    () => uniq(yearReports.map((r) => r.templateSet)),
    [yearReports]
  );

  // Lọc theo mọi điều kiện trừ thẻ nhanh — số trên thẻ đếm trong phạm vi này.
  const scoped = useMemo(() => {
    const q = normalize(search);
    return yearReports.filter((r) => {
      if (periodKey !== ALL && r.period.key !== periodKey) return false;
      if (block !== ALL && r.orgBlock !== block) return false;
      if (more.statuses.length > 0 && !more.statuses.includes(r.status)) return false;
      if (more.district !== ALL && r.district !== more.district) return false;
      if (more.templateSet !== ALL && r.templateSet !== more.templateSet) return false;
      if (q) {
        const hay = normalize(`${r.orgName} ${r.district} ${r.period.name}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [yearReports, search, periodKey, block, more]);

  const rows = useMemo(
    () => (quick ? scoped.filter((r) => r.status === quick) : scoped),
    [scoped, quick]
  );

  const quickItems = STATUS_ORDER.map((s) => ({
    key: s,
    label: STATUS_META[s].label,
    count: scoped.filter((r) => r.status === s).length,
  }));

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Đổi điều kiện lọc thì về trang 1.
  useEffect(() => {
    setPage(1);
  }, [quick, search, periodKey, block, more, year, pageSize]);

  const hasFilters =
    search.trim() !== "" || periodKey !== ALL || block !== ALL || countMoreFilters(more) > 0;

  const clearAll = () => {
    setQuick(null);
    setSearch("");
    setPeriodKey(ALL);
    setBlock(ALL);
    setMore(EMPTY_MORE_FILTERS);
  };

  const refresh = () => {
    setRefreshing(true);
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 600);
  };

  const open = (r: ReviewReport) => navigate(`/report-review/${r.id}`);

  const primaryFor = (r: ReviewReport): PrimaryAction =>
    r.status === "pending"
      ? { label: "Duyệt phiếu", icon: CircleCheck, onClick: () => open(r) }
      : {
          label: "Xem phiếu",
          icon: Eye,
          onClick: () => open(r),
          disabled: hasNoData(r),
          reason: hasNoData(r) ? NO_DATA_REASON : undefined,
        };

  const itemsFor = (r: ReviewReport): ActionItem[] => [
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      disabled: hasNoData(r),
      reason: hasNoData(r) ? NO_DATA_REASON : undefined,
      onSelect: () =>
        toast.success(
          `Đã tải về tệp ${exportFileName(r, r.previousVersions.length + 1)}.`
        ),
    },
    {
      key: "history",
      label: "Lịch sử phiên bản",
      icon: History,
      onSelect: () => setHistoryFor(r),
    },
  ];

  const filterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...more.statuses.map((s) => ({
      key: `status-${s}`,
      label: `Trạng thái: ${STATUS_META[s].label}`,
      onRemove: () => setMore({ ...more, statuses: more.statuses.filter((x) => x !== s) }),
    })),
    ...(more.district !== ALL
      ? [
          {
            key: "district",
            label: `Huyện / thành phố: ${more.district}`,
            onRemove: () => setMore({ ...more, district: ALL }),
          },
        ]
      : []),
    ...(more.templateSet !== ALL
      ? [
          {
            key: "template",
            label: `Bộ biểu mẫu: ${more.templateSet}`,
            onRemove: () => setMore({ ...more, templateSet: ALL }),
          },
        ]
      : []),
  ];

  const periodName = periods.find((p) => p.key === periodKey)?.name;

  const renderEmpty = () => {
    if (yearReports.length === 0) {
      return (
        <EmptyState
          icon={CalendarX}
          title={`Chưa có phiếu nào trong năm ${year}`}
          description="Khi Sở mở đợt báo cáo, phiếu của các đơn vị sẽ hiện ở đây."
        />
      );
    }
    if (quick === "pending" && !hasFilters) {
      return (
        <EmptyState
          icon={CircleCheck}
          title="Không còn phiếu nào chờ duyệt"
          description="Bạn đã xử lý hết phiếu các đơn vị nộp."
          action={
            <Button type="button" variant="outline" onClick={clearAll}>
              Xem tất cả phiếu
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={SearchX}
        title="Không có phiếu phù hợp"
        description="Thử bỏ bớt điều kiện lọc hoặc tìm bằng tên khác."
        action={
          <Button type="button" variant="outline" onClick={clearAll}>
            Xoá lọc
          </Button>
        }
      />
    );
  };

  return (
    <AsxhPage
      title="Duyệt phiếu nhập"
      description="Phiếu các đơn vị đã nộp. Mở phiếu để kiểm tra số liệu, rồi phê duyệt hoặc trả lại kèm lý do."
      actions={<YearSelect />}
    >
      <QuickFilterCards
        items={quickItems}
        value={quick}
        onChange={(k) => setQuick(k as ReviewStatus | null)}
      />

      <section className="bg-card text-card-foreground shadow-e1 flex min-w-0 flex-col overflow-hidden rounded-lg border">
        {/* Thanh lọc */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên đơn vị hoặc kỳ báo cáo…"
                aria-label="Tìm phiếu"
                className="ps-9"
              />
            </div>

            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo kỳ">
                <span className="truncate">Kỳ: {periodName ?? "Tất cả các kỳ"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả các kỳ</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo khối">
                <span className="truncate">
                  Khối: {block === ALL ? "Tất cả các khối" : block}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả các khối</SelectItem>
                {BLOCKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <MoreFilters
              value={more}
              onChange={setMore}
              districts={districts}
              templateSets={templateSets}
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Làm mới"
              title="Làm mới"
              onClick={refresh}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>

          {filterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="bg-surface-subtle inline-flex h-7 items-center gap-1 rounded-md border ps-2.5 pe-1 text-xs font-medium"
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Bỏ điều kiện ${chip.label}`}
                    onClick={chip.onRemove}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-[3px]"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMore(EMPTY_MORE_FILTERS)}
              >
                Xoá lọc
              </Button>
            </div>
          )}
        </div>

        {/* Bảng */}
        <Table aria-busy={refreshing || undefined}>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Đơn vị</TableHead>
              <TableHead className="w-[200px]">Kỳ báo cáo</TableHead>
              <TableHead className="w-[180px]">Tiến độ</TableHead>
              <TableHead className="w-[150px]">Ngày nộp</TableHead>
              <TableHead className="w-[360px]">Trạng thái</TableHead>
              <TableHead align="right" className="w-[220px] pe-4">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={cn(refreshing && "opacity-60 transition-opacity")}>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-[22rem] whitespace-normal">
                  {renderEmpty()}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => {
                const meta = STATUS_META[r.status];
                const sub = statusSubline(r);
                const openable = !hasNoData(r);
                return (
                  <TableRow
                    key={r.id}
                    className="h-15"
                    onDoubleClick={openable ? () => open(r) : undefined}
                  >
                    <TableCell className="ps-4">
                      <TwoLineCell
                        primary={<span className="font-medium">{r.orgName}</span>}
                        secondary={`${r.orgBlock} · ${r.district}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell primary={r.period.name} secondary={r.period.range} />
                    </TableCell>
                    <TableCell>
                      <ProgressCell done={r.doneSheets} total={TOTAL_SHEETS} unit="biểu" />
                    </TableCell>
                    <TableCell>
                      {r.submittedAt ? (
                        <TwoLineCell
                          primary={formatDate(r.submittedAt)}
                          secondary={timeOf(r.submittedAt)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                        <span
                          className="text-muted-foreground block max-w-[21rem] truncate text-xs"
                          title={sub}
                        >
                          {sub}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell align="right" className="pe-4">
                      <RowActions primary={primaryFor(r)} items={itemsFor(r)} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <Pager
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>

      {historyFor && (
        <VersionHistoryDialog
          report={historyFor}
          open
          onOpenChange={(o) => !o && setHistoryFor(null)}
          onView={(no) => {
            const current = historyFor.previousVersions.length + 1;
            navigate(
              no === current
                ? `/report-review/${historyFor.id}`
                : `/report-review/${historyFor.id}?phienban=${no}`
            );
          }}
        />
      )}
    </AsxhPage>
  );
}
