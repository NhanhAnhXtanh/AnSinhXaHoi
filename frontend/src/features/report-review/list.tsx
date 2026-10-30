import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useCustom, useList, type CrudFilter } from "@refinedev/core";
import {
  CalendarX,
  CircleCheck,
  Download,
  Eye,
  History,
  RefreshCw,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  AsxhPage,
  EmptyState,
  LoadingState,
  Pager,
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
import { customResult } from "@/shared/hooks/use-custom-result";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";

import {
  REPORTS_RESOURCE,
  SUMMARY_URL,
  type InputReportRecord,
  type InputReportSummary,
} from "./api";
import {
  ALL,
  EMPTY_MORE_FILTERS,
  MoreFilters,
  countMoreFilters,
  type FilterOption,
  type MoreFilterValue,
} from "./components/more-filters";
import { VersionHistoryDialog } from "./components/version-history-dialog";
import {
  BLOCK_OPTIONS,
  NO_DATA_REASON,
  STATUS_META,
  STATUS_ORDER,
  badgeOf,
  countOf,
  displayFilter,
  formatRange,
  hasNoData,
  reviewStatus,
  statusSubline,
  timeOf,
  unitSubline,
  type ReviewStatus,
} from "./model";
import { useReportExport } from "./use-report-export";

/**
 * Duyệt phiếu nhập (Sở) — hàng đợi phiếu các đơn vị trong năm đang chọn (UC-39).
 * Chỉ là hàng đợi: phê duyệt / trả lại nằm ở màn Xem phiếu.
 */
export function ReviewList() {
  const navigate = useNavigate();
  const { year } = useReportYear();
  const { exportReport, exporting } = useReportExport();

  const [quick, setQuick] = useState<ReviewStatus | null>(null);
  const [search, setSearch] = useState("");
  const [periodKey, setPeriodKey] = useState<string>(ALL);
  const [block, setBlock] = useState<string>(ALL);
  const [more, setMore] = useState<MoreFilterValue>(EMPTY_MORE_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyFor, setHistoryFor] = useState<InputReportRecord | null>(null);

  // Đổi năm: bỏ kỳ / huyện / bộ mẫu của năm cũ, về trang 1.
  const [yearOfFilters, setYearOfFilters] = useState(year);
  if (yearOfFilters !== year) {
    setYearOfFilters(year);
    setPeriodKey(ALL);
    setMore((m) => ({ ...m, district: ALL, templateSet: ALL }));
    setPage(1);
  }

  // Lọc theo mọi điều kiện trừ trạng thái — số trên thẻ đếm trong phạm vi này.
  const base = useMemo(() => {
    const filters: CrudFilter[] = [{ field: "year", operator: "eq", value: year }];
    if (periodKey !== ALL) filters.push({ field: "period.id", operator: "eq", value: periodKey });
    if (block !== ALL) filters.push({ field: "unit.block", operator: "eq", value: block });
    if (more.district !== ALL) filters.push({ field: "unit.parent.id", operator: "eq", value: more.district });
    if (more.templateSet !== ALL) filters.push({ field: "templateSet.id", operator: "eq", value: more.templateSet });
    const q = search.trim();
    if (q !== "") filters.push({ field: "q", operator: "eq", value: q });
    return filters;
  }, [year, periodKey, block, more.district, more.templateSet, search]);

  const { result, query } = useList<InputReportRecord>({
    resource: REPORTS_RESOURCE,
    pagination: { currentPage: page, pageSize, mode: "server" },
    filters: [...base, displayFilter(quick, more.statuses)],
    errorNotification: false,
  });

  const summaryQueryParams = useMemo(() => {
    const q: Record<string, string> = {};
    for (const f of base) if ("field" in f) q[f.field] = String(f.value);
    return q;
  }, [base]);
  const { result: summaryResult, query: summaryQuery } = useCustom<InputReportSummary>({
    url: SUMMARY_URL,
    method: "get",
    config: { query: summaryQueryParams },
    errorNotification: false,
  });
  const summary = customResult(summaryResult?.data, "counts");

  const rows = result.data;
  const total = result.total ?? 0;

  // Tải lại / có người khác thao tác làm tổng số phiếu giảm: trang đang đứng có thể vượt trang
  // cuối — máy chủ trả trang rỗng. Kẹp về trang cuối hợp lệ (chỉ theo kết quả thật, không theo
  // dữ liệu giữ chỗ của trang trước) để gửi lại đúng `_start`.
  const serverTotal = query.isPlaceholderData || query.isFetching ? undefined : result.total;
  useEffect(() => {
    if (serverTotal === undefined) return;
    const last = Math.max(1, Math.ceil(serverTotal / pageSize));
    if (page > last) setPage(last);
  }, [serverTotal, page, pageSize]);

  const periods = summary?.periods ?? [];
  const districts: FilterOption[] = useMemo(
    () => (summary?.districts ?? []).map((d) => ({ id: String(d.id), name: d.name })),
    [summary]
  );
  const templateSets: FilterOption[] = useMemo(
    () => (summary?.templateSets ?? []).map((t) => ({ id: String(t.id), name: t.name })),
    [summary]
  );

  const quickItems = STATUS_ORDER.map((s) => ({
    key: s,
    label: STATUS_META[s].label,
    count: countOf(summary, s),
  }));

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const hasFilters = search.trim() !== "" || periodKey !== ALL || block !== ALL || countMoreFilters(more) > 0;

  const clearAll = () => {
    setQuick(null);
    setSearch("");
    setPeriodKey(ALL);
    setBlock(ALL);
    setMore(EMPTY_MORE_FILTERS);
    setPage(1);
  };

  const refresh = () => {
    void query.refetch();
    void summaryQuery.refetch();
  };
  const refreshing = query.isFetching || summaryQuery.isFetching;

  const open = (r: InputReportRecord) => navigate(`/report-review/${r.id}`);

  const primaryFor = (r: InputReportRecord): PrimaryAction =>
    reviewStatus(r) === "pending"
      ? { label: "Duyệt phiếu", icon: CircleCheck, onClick: () => open(r) }
      : {
          label: "Xem phiếu",
          icon: Eye,
          onClick: () => open(r),
          disabled: hasNoData(r),
          reason: hasNoData(r) ? NO_DATA_REASON : undefined,
        };

  const itemsFor = (r: InputReportRecord): ActionItem[] => [
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      disabled: hasNoData(r) || exporting,
      reason: hasNoData(r) ? NO_DATA_REASON : undefined,
      onSelect: () => void exportReport(r),
    },
    {
      key: "history",
      label: "Lịch sử phiên bản",
      icon: History,
      onSelect: () => setHistoryFor(r),
    },
  ];

  const districtName = districts.find((d) => d.id === more.district)?.name ?? "Đã chọn";
  const templateSetName = templateSets.find((t) => t.id === more.templateSet)?.name ?? "Đã chọn";

  const filterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...more.statuses.map((s) => ({
      key: `status-${s}`,
      label: `Trạng thái: ${STATUS_META[s].label}`,
      onRemove: () => resetPage(setMore)({ ...more, statuses: more.statuses.filter((x) => x !== s) }),
    })),
    ...(more.district !== ALL
      ? [
          {
            key: "district",
            label: `Huyện / thành phố: ${districtName}`,
            onRemove: () => resetPage(setMore)({ ...more, district: ALL }),
          },
        ]
      : []),
    ...(more.templateSet !== ALL
      ? [
          {
            key: "template",
            label: `Bộ biểu mẫu: ${templateSetName}`,
            onRemove: () => resetPage(setMore)({ ...more, templateSet: ALL }),
          },
        ]
      : []),
  ];

  const periodName = periods.find((p) => String(p.id) === periodKey)?.name;
  const blockLabel = BLOCK_OPTIONS.find((b) => b.key === block)?.label;

  const renderEmpty = () => {
    if (query.isLoading) {
      return <LoadingState label="Đang tải hàng đợi duyệt…" />;
    }
    if (query.isError) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa tải được danh sách phiếu"
          description="Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây."
          action={
            <Button type="button" variant="outline" onClick={refresh}>
              Thử lại
            </Button>
          }
        />
      );
    }
    if (summary && summary.total === 0 && !hasFilters) {
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
        onChange={(k) => {
          setQuick(k as ReviewStatus | null);
          setPage(1);
        }}
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
                onChange={(e) => resetPage(setSearch)(e.target.value)}
                placeholder="Tìm theo tên đơn vị hoặc kỳ báo cáo…"
                aria-label="Tìm phiếu"
                className="ps-9"
              />
            </div>

            <Select value={periodKey} onValueChange={resetPage(setPeriodKey)}>
              <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo kỳ">
                <span className="truncate">Kỳ: {periodName ?? "Tất cả các kỳ"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả các kỳ</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={block} onValueChange={resetPage(setBlock)}>
              <SelectTrigger className="w-full sm:w-60" aria-label="Lọc theo khối">
                <span className="truncate">Khối: {blockLabel ?? "Tất cả các khối"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả các khối</SelectItem>
                {BLOCK_OPTIONS.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <MoreFilters
              value={more}
              onChange={resetPage(setMore)}
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
              <Button type="button" variant="outline" size="sm" onClick={() => resetPage(setMore)(EMPTY_MORE_FILTERS)}>
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
          <TableBody className={cn(query.isFetching && !query.isLoading && "opacity-60 transition-opacity")}>
            {rows.length === 0 || query.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-[22rem] whitespace-normal">
                  {renderEmpty()}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const badge = badgeOf(r);
                const sub = statusSubline(r);
                const openable = !hasNoData(r);
                return (
                  <TableRow key={r.id} className="h-15" onDoubleClick={openable ? () => open(r) : undefined}>
                    <TableCell className="ps-4">
                      <TwoLineCell
                        primary={<span className="font-medium">{r.unit.name}</span>}
                        secondary={unitSubline(r) || undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell
                        primary={r.period.name}
                        secondary={formatRange(r.period.fromDate, r.period.toDate)}
                      />
                    </TableCell>
                    <TableCell>
                      <ProgressCell done={r.progress.done} total={r.progress.total} unit="biểu" />
                    </TableCell>
                    <TableCell>
                      {r.submittedAt ? (
                        <TwoLineCell primary={formatDate(r.submittedAt)} secondary={timeOf(r.submittedAt)} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                        <span className="text-muted-foreground block max-w-[21rem] truncate text-xs" title={sub}>
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
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </section>

      {historyFor && (
        <VersionHistoryDialog
          report={historyFor}
          open
          onOpenChange={(o) => !o && setHistoryFor(null)}
          onView={(revisionId) => {
            setHistoryFor(null);
            navigate(`/report-review/${revisionId}`);
          }}
        />
      )}
    </AsxhPage>
  );
}
