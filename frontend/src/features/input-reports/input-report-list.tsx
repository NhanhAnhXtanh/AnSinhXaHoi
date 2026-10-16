import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Download, Eye, FileText, Pencil, RotateCcwClock, SearchX } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { TEMPLATE_SETS, TEMPLATE_VERSIONS } from "./fixtures";
import { ALL, EMPTY_FILTERS, type ListFilters } from "./filters";
import { ListToolbar } from "./list-toolbar";
import {
  STATUS_META,
  displayStatus,
  doneCount,
  dueLine,
  formatRange,
  hasAnyData,
  type InputReport,
} from "./model";
import { exportFileName, reportKindLabel, statusLine, workPath } from "./report-text";
import { RevisionHistoryDialog } from "./revision-history-dialog";
import { useInputReports } from "./store";

type QuickKey = "can-nhap" | "bi-tra-lai" | "cho-duyet" | "da-duyet";

/** Bốn thẻ lọc nhanh (UC-33 bước 2). "Cần nhập" không tính phiếu của kỳ quá hạn (4a). */
const QUICK: { key: QuickKey; label: string; match: (r: InputReport) => boolean }[] = [
  { key: "can-nhap", label: "Cần nhập", match: (r) => displayStatus(r) === "draft" },
  { key: "bi-tra-lai", label: "Bị trả lại", match: (r) => r.status === "returned" },
  { key: "cho-duyet", label: "Chờ Sở duyệt", match: (r) => r.status === "submitted" },
  { key: "da-duyet", label: "Đã phê duyệt", match: (r) => r.status === "approved" },
];

const PAGE_SIZES = [10, 20, 50];

/** Màn "Nhập liệu báo cáo" — danh sách phiếu của đơn vị (UC-33, Figma 309:14416). */
export function InputReportList() {
  const navigate = useNavigate();
  const { year } = useReportYear();
  const all = useInputReports();

  const [quick, setQuick] = useState<QuickKey | null>(null);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [historyFor, setHistoryFor] = useState<InputReport | null>(null);

  // Phiếu của năm dùng chung, kỳ mới nhất trước.
  const ofYear = useMemo(
    () =>
      all
        .filter((r) => Number(r.periodFrom.slice(0, 4)) === year)
        .sort((a, b) => b.periodFrom.localeCompare(a.periodFrom) || a.orgName.localeCompare(b.orgName, "vi")),
    [all, year]
  );

  const periods = useMemo(() => [...new Set(ofYear.map((r) => r.periodName))], [ofYear]);

  const rows = useMemo(() => {
    const q = filters.search.trim().toLocaleLowerCase("vi");
    const quickMatch = QUICK.find((x) => x.key === quick)?.match;
    return ofYear.filter(
      (r) =>
        (!quickMatch || quickMatch(r)) &&
        (q === "" || r.periodName.toLocaleLowerCase("vi").includes(q)) &&
        (filters.period === ALL || r.periodName === filters.period) &&
        (filters.statuses.length === 0 || filters.statuses.includes(displayStatus(r))) &&
        (filters.templateSet === ALL || r.templateSet === filters.templateSet) &&
        (filters.templateVersion === ALL || r.templateVersion === filters.templateVersion)
    );
  }, [ofYear, filters, quick]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, rows.length);

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
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const exportExcel = (r: InputReport) =>
    toast.success(`Đã xuất phiếu ${r.periodName} ra tệp ${exportFileName(r)}.`);

  const rowActions = (r: InputReport): { primary: PrimaryAction; items: ActionItem[] } => {
    const s = displayStatus(r);
    const open = () => navigate(workPath(r));
    // UC-33 5a: phiếu quá hạn mà chưa nhập gì thì không có gì để xem.
    const nothingToSee = s === "overdue" && !hasAnyData(r);
    const reason = nothingToSee ? "Phiếu chưa có số liệu nào" : undefined;

    const primary: PrimaryAction =
      s === "draft"
        ? { label: "Nhập dữ liệu", icon: Pencil, onClick: open }
        : s === "returned"
          ? { label: "Sửa & nộp lại", icon: Pencil, onClick: open }
          : { label: "Xem phiếu", icon: Eye, onClick: open, disabled: nothingToSee, reason };

    const items: ActionItem[] = [
      { key: "excel", label: "Xuất Excel", icon: Download, onSelect: () => exportExcel(r), disabled: nothingToSee, reason },
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
    filters.templateSet !== ALL ||
    filters.templateVersion !== ALL;

  return (
    <AsxhPage
      title="Nhập liệu báo cáo"
      description="Phiếu nhập liệu của đơn vị bạn theo từng kỳ. Chọn phiếu cần làm, nhập số liệu rồi nộp cho Sở Tài chính."
      actions={<YearSelect />}
    >
      <QuickFilterCards
        items={QUICK.map((x) => ({ key: x.key, label: x.label, count: ofYear.filter(x.match).length }))}
        value={quick}
        onChange={(k) => {
          setQuick(k as QuickKey | null);
          setPage(1);
        }}
      />

      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-e1">
        <ListToolbar
          filters={filters}
          onChange={changeFilters}
          onClear={clearAll}
          periods={periods}
          templateSets={TEMPLATE_SETS}
          templateVersions={TEMPLATE_VERSIONS}
          refreshing={refreshing}
          onRefresh={refresh}
          hasQuickFilter={quick !== null}
        />

        <Table className="border-t">
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
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-auto py-0 whitespace-normal">
                  {isFiltered ? (
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
                  ) : (
                    <EmptyState
                      icon={FileText}
                      title={`Chưa có phiếu nào trong năm ${year}`}
                      description="Phiếu sẽ hiện ở đây khi Sở Tài chính mở đợt báo cáo cho đơn vị bạn."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => {
                const s = displayStatus(r);
                const due = dueLine(r);
                const sub = statusLine(r);
                const { primary, items } = rowActions(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="h-16">
                      <TwoLineCell primary={r.periodName} secondary={formatRange(r.periodFrom, r.periodTo)} />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell primary={reportKindLabel(r)} secondary={`Phiên bản ${r.revision}`} />
                    </TableCell>
                    <TableCell>
                      <ProgressCell done={doneCount(r)} total={r.sheets.length} unit="biểu" />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell
                        primary={formatDate(r.dueDate)}
                        secondary={
                          <span className={cn(due.tone === "destructive" && "text-destructive-text")}>{due.text}</span>
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-96 flex-col items-start gap-1">
                        <StatusBadge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</StatusBadge>
                        <span className="w-full truncate text-xs text-muted-foreground" title={sub}>
                          {sub}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell align="right" className="sticky right-0 bg-card">
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
          total={rows.length}
          page={safePage}
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
        onView={(revision) => {
          const r = historyFor;
          setHistoryFor(null);
          if (r) navigate(workPath(r, revision));
        }}
      />
    </AsxhPage>
  );
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
        {total === 0 ? "Không có phiếu" : `Hiển thị ${from}–${to} trong ${total} phiếu`}
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
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
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
        ))}
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
