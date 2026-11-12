import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useCustom, useList } from "@refinedev/core";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Pencil,
  RotateCcwClock,
  SearchX,
  TriangleAlert,
} from "lucide-react";

import {
  AsxhPage,
  EmptyState,
  LoadingState,
  ProgressCell,
  QuickFilterCards,
  RowActions,
  StatusBadge,
  TwoLineCell,
  YearSelect,
  formatDate,
  formatNumber,
  useReportYear,
  type ActionItem,
  type PrimaryAction,
} from "@/shared/components/asxh";
import { customResult } from "@/shared/hooks/use-custom-result";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import {
  REPORTS_RESOURCE,
  SUMMARY_URL,
  type DisplayKey,
  type InputReportRecord,
  type InputReportSummary,
} from "./api";
import { useExportReport } from "./export-report";
import { ALL, EMPTY_FILTERS, baseFilters, displayFilter, toQuery, type ListFilters } from "./filters";
import { ListToolbar, type FilterOption } from "./list-toolbar";
import { STATUS_META, displayStatus, dueLine, formatRange, hasAnyData } from "./model";
import { RevisionHistoryDialog } from "./revision-history-dialog";
import { reportKindLabel, statusLine, workPath } from "./report-text";
import { isForbiddenError, loadErrorText } from "@/shared/lib/user-message";

/** Bốn thẻ lọc nhanh (UC-33 bước 2). "Cần nhập" không tính phiếu của kỳ quá hạn (4a). */
const QUICK: { key: DisplayKey; label: string }[] = [
  { key: "draft", label: "Cần nhập" },
  { key: "returned", label: "Bị trả lại" },
  { key: "submitted", label: "Chờ Sở duyệt" },
  { key: "approved", label: "Đã phê duyệt" },
];

const PAGE_SIZES = [10, 20, 50];

/** Màn "Nhập liệu báo cáo" — danh sách phiếu của đơn vị (UC-33, Figma 309:14416). */
export function InputReportList() {
  const navigate = useNavigate();
  const { year } = useReportYear();
  const { exportReport, exporting } = useExportReport();

  const [quick, setQuick] = useState<DisplayKey | null>(null);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyFor, setHistoryFor] = useState<InputReportRecord | null>(null);

  // Đổi năm thì bỏ kỳ / bộ mẫu đã chọn của năm cũ và về trang 1.
  const [yearOfFilters, setYearOfFilters] = useState(year);
  if (yearOfFilters !== year) {
    setYearOfFilters(year);
    setFilters((f) => ({ ...f, period: ALL, templateSet: ALL }));
    setPage(1);
  }

  const base = useMemo(() => baseFilters(year, filters), [year, filters]);

  const { result, query } = useList<InputReportRecord>({
    resource: REPORTS_RESOURCE,
    pagination: { currentPage: page, pageSize, mode: "server" },
    filters: [...base, ...displayFilter(quick, filters.statuses)],
    errorNotification: false,
  });

  const { result: summaryResult, query: summaryQuery } = useCustom<InputReportSummary>({
    url: SUMMARY_URL,
    method: "get",
    config: { query: toQuery(base) },
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const periods: FilterOption[] = useMemo(
    () => (summary?.periods ?? []).map((p) => ({ id: String(p.id), name: p.name })),
    [summary]
  );
  const templateSets: FilterOption[] = useMemo(
    () => (summary?.templateSets ?? []).map((t) => ({ id: String(t.id), name: t.name })),
    [summary]
  );

  const changeFilters = (next: ListFilters) => {
    setFilters(next);
    setPage(1);
  };
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQuick(null);
    setPage(1);
  };
  const refresh = () => {
    void query.refetch();
    void summaryQuery.refetch();
  };

  const rowActions = (r: InputReportRecord): { primary: PrimaryAction; items: ActionItem[] } => {
    const s = displayStatus(r);
    const open = () => navigate(workPath(r.id));
    // UC-33 5a: phiếu quá hạn mà chưa nhập gì thì không có gì để xem.
    const nothingToSee = s === "overdue" && !hasAnyData(r);
    const reason = nothingToSee ? "Phiếu chưa có số liệu nào" : undefined;

    const primary: PrimaryAction =
      s === "draft" && r.period.status === "open"
        ? { label: "Nhập dữ liệu", icon: Pencil, onClick: open }
        : s === "returned"
          ? { label: "Sửa & nộp lại", icon: Pencil, onClick: open }
          : { label: "Xem phiếu", icon: Eye, onClick: open, disabled: nothingToSee, reason };

    const items: ActionItem[] = [
      {
        key: "excel",
        label: "Xuất Excel",
        icon: Download,
        onSelect: () => void exportReport(r),
        disabled: nothingToSee || exporting || r.progress.total === 0,
        reason: reason ?? (r.progress.total === 0 ? "Phiếu chưa có biểu nào" : undefined),
      },
      {
        key: "history",
        label: "Lịch sử phiên bản",
        icon: RotateCcwClock,
        onSelect: () => setHistoryFor(r),
        disabled: nothingToSee,
        reason,
      },
    ];
    return { primary, items };
  };

  const isFiltered =
    quick !== null ||
    filters.search.trim() !== "" ||
    filters.period !== ALL ||
    filters.statuses.length > 0 ||
    filters.templateSet !== ALL;

  const renderBody = () => {
    if (query.isLoading) {
      return <LoadingState label="Đang tải danh sách phiếu…" />;
    }
    if (query.isError) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa tải được danh sách phiếu"
          description={loadErrorText(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
          action={
            isForbiddenError(query.error) ? undefined : (
              <Button type="button" variant="outline" onClick={refresh}>
                Thử lại
              </Button>
            )
          }
        />
      );
    }
    if (isFiltered) {
      return (
        <EmptyState
          icon={SearchX}
          title="Không có phiếu nào khớp điều kiện lọc"
          description="Bạn thử bỏ bớt điều kiện lọc hoặc chọn kỳ khác."
          action={
            <Button type="button" variant="outline" onClick={clearAll}>
              Xoá lọc
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={FileText}
        title={`Chưa có phiếu nào trong năm ${year}`}
        description="Phiếu sẽ hiện ở đây khi Sở Tài chính mở đợt báo cáo cho đơn vị bạn."
      />
    );
  };

  return (
    <AsxhPage
      title="Nhập liệu báo cáo"
      description="Phiếu nhập liệu của đơn vị bạn theo từng kỳ. Chọn phiếu cần làm, nhập số liệu rồi nộp cho Sở Tài chính."
      actions={<YearSelect />}
    >
      <QuickFilterCards
        items={QUICK.map((x) => ({ key: x.key, label: x.label, count: summary?.counts[x.key] ?? 0 }))}
        value={quick}
        onChange={(k) => {
          setQuick(k as DisplayKey | null);
          setPage(1);
        }}
      />

      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-e1">
        <ListToolbar
          filters={filters}
          onChange={changeFilters}
          onClear={clearAll}
          periods={periods}
          templateSets={templateSets}
          refreshing={query.isFetching || summaryQuery.isFetching}
          onRefresh={refresh}
          hasQuickFilter={quick !== null}
        />

        <Table className="border-t" aria-busy={query.isFetching || undefined}>
          <TableHeader>
            <TableRow>
              <TableHead>Kỳ báo cáo</TableHead>
              <TableHead>Phiếu</TableHead>
              <TableHead>Tiến độ</TableHead>
              <TableHead>Hạn nộp</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead align="right" className="sticky right-0">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={cn(query.isFetching && !query.isLoading && "opacity-60 transition-opacity")}>
            {rows.length === 0 || query.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-auto py-0 whitespace-normal">
                  {renderBody()}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const s = displayStatus(r);
                const due = dueLine(r);
                const sub = statusLine(r);
                const { primary, items } = rowActions(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="h-16">
                      <TwoLineCell
                        primary={r.period.name}
                        secondary={formatRange(r.period.fromDate, r.period.toDate)}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell primary={reportKindLabel(r)} secondary={`Phiên bản ${r.revisionNo}`} />
                    </TableCell>
                    <TableCell>
                      <ProgressCell done={r.progress.done} total={r.progress.total} unit="biểu" />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell
                        primary={r.period.deadline ? formatDate(r.period.deadline) : "—"}
                        secondary={
                          <span className={cn(due.tone === "destructive" && "text-destructive-text")}>{due.text}</span>
                        }
                      />
                    </TableCell>
                    {/* Ô nhận phần bề rộng còn lại của bảng (w-full) mà không tự nở theo chữ
                        (max-w-0), nên dòng lý do chỉ cắt "…" khi chạm mép cột; min-w-64 giữ
                        cột không bị bóp quá hẹp khi màn nhỏ. */}
                    <TableCell className="w-full max-w-0 min-w-64">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</StatusBadge>
                        <span className="w-full truncate text-xs text-muted-foreground" title={sub}>
                          {sub}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell align="right" className="sticky right-0 bg-card transition-colors [tr:hover>&]:bg-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-card))]">
                      <div className="flex justify-end">
                        <RowActions primary={primary} items={items} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <Pager
          from={from}
          to={to}
          total={total}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </section>

      <RevisionHistoryDialog
        report={historyFor}
        open={historyFor !== null}
        onOpenChange={(o) => !o && setHistoryFor(null)}
        onView={(revisionId) => {
          setHistoryFor(null);
          navigate(workPath(revisionId));
        }}
      />
    </AsxhPage>
  );
}

/** Dãy số trang gọn: 1 … 4 5 6 … 12. */
function pageList(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = [...new Set([1, count, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= count)
    .sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Phân trang: "Hiển thị 1–7 trong 7 phiếu"  [‹] 1 2 [›]  [10 / trang] */
function Pager({
  from,
  to,
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
      <span className="text-sm text-muted-foreground tabular-nums">
        {total === 0
          ? "Không có phiếu"
          : `Hiển thị ${formatNumber(from)}–${formatNumber(to)} trong ${formatNumber(total)} phiếu`}
      </span>
      <div className="ms-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        {pageList(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} aria-hidden className="flex w-8 justify-center text-muted-foreground">
              <Ellipsis className="size-4" />
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === page ? "default" : "ghost"}
              size="icon-sm"
              aria-label={`Trang ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Trang sau"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
        <SelectTrigger size="sm" className="w-28" aria-label="Số phiếu mỗi trang">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} / trang
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
