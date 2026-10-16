import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FunnelX,
  RefreshCw,
  RotateCcwClock,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import {
  AsxhPage,
  EmptyState,
  formatDate,
  formatNumber,
  RowActions,
  StatusBadge,
  TwoLineCell,
  useReportYear,
  YearSelect,
} from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import {
  PUBLICATIONS,
  type Publication,
  type PublicationKind,
  type PublicationStatus,
} from "./fixtures";
import { fold, KIND_LABEL, parseAt, STATUS_VIEW, totals } from "./model";
import { PublicationDetailDialog } from "./publication-detail-dialog";

const PAGE_SIZES = [10, 20, 50] as const;

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function PublicationHistoryList() {
  const navigate = useNavigate();
  const { year } = useReportYear();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | PublicationStatus>("all");
  const [kind, setKind] = useState<"all" | PublicationKind>("all");
  const [periodId, setPeriodId] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Publication | null>(null);

  const ofYear = useMemo(
    () =>
      PUBLICATIONS.filter((p) => p.year === year).sort((a, b) =>
        b.openedAt.localeCompare(a.openedAt)
      ),
    [year]
  );

  const periodOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of ofYear) if (!seen.has(p.periodId)) seen.set(p.periodId, p.periodName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [ofYear]);

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return ofYear.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (kind === "all" || p.kind === kind) &&
        (periodId === "all" || p.periodId === periodId) &&
        (!q || fold(`${p.periodName} ${p.openedBy}`).includes(q))
    );
  }, [ofYear, search, status, kind, periodId]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const first = filtered.length === 0 ? 0 : current * pageSize + 1;
  const last = current * pageSize + rows.length;

  const moreCount = (kind !== "all" ? 1 : 0) + (periodId !== "all" ? 1 : 0);
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(status !== "all"
      ? [{ key: "status", label: `Trạng thái: ${STATUS_VIEW[status].label}`, clear: () => setStatus("all") }]
      : []),
    ...(kind !== "all"
      ? [{ key: "kind", label: `Đợt: ${KIND_LABEL[kind]}`, clear: () => setKind("all") }]
      : []),
    ...(periodId !== "all"
      ? [
          {
            key: "period",
            label: `Kỳ: ${periodOptions.find((o) => o.id === periodId)?.name ?? ""}`,
            clear: () => setPeriodId("all"),
          },
        ]
      : []),
  ];

  const clearAll = () => {
    setSearch("");
    setStatus("all");
    setKind("all");
    setPeriodId("all");
    setPage(0);
  };

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <AsxhPage
      title="Lịch sử mở đợt"
      description="Các đợt đã mở cho từng kỳ báo cáo: ai mở, mở lúc nào và đã tạo bao nhiêu phiếu."
      actions={<YearSelect />}
    >
      {ofYear.length === 0 ? (
        <EmptyState
          variant="page"
          icon={RotateCcwClock}
          title={`Năm ${year} chưa có đợt mở nào`}
          description="Khi Sở mở đợt báo cáo cho một kỳ ở màn Thiết lập & điều hành, đợt đó sẽ hiện ở đây."
          action={
            <Button variant="outline" onClick={() => navigate("/period-setup")}>
              Mở Thiết lập & điều hành
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-e1">
          {/* Thanh lọc */}
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Tìm theo kỳ báo cáo hoặc người mở…"
                aria-label="Tìm theo kỳ báo cáo hoặc người mở"
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as "all" | PublicationStatus);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[156px]" aria-label="Lọc theo trạng thái">
                <SelectValue>
                  Trạng thái: {status === "all" ? "Tất cả" : STATUS_VIEW[status].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {(Object.keys(STATUS_VIEW) as PublicationStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_VIEW[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal />
                  Bộ lọc khác
                  {moreCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {moreCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-72 flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Đợt</Label>
                  <Select
                    value={kind}
                    onValueChange={(v) => {
                      setKind(v as "all" | PublicationKind);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="first">{KIND_LABEL.first}</SelectItem>
                      <SelectItem value="supplement">{KIND_LABEL.supplement}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Kỳ báo cáo</Label>
                  <Select
                    value={periodId}
                    onValueChange={(v) => {
                      setPeriodId(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả các kỳ</SelectItem>
                      {periodOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              aria-label="Làm mới"
              title="Làm mới"
              onClick={refresh}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 rounded-md border bg-surface-subtle py-0.5 ps-2 pe-1 text-xs"
                >
                  {c.label}
                  <button
                    type="button"
                    aria-label={`Bỏ điều kiện ${c.label}`}
                    onClick={() => {
                      c.clear();
                      setPage(0);
                    }}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <FunnelX />
                Xoá lọc
              </Button>
            </div>
          )}

          {/* Bảng */}
          {filtered.length === 0 ? (
            <div className="border-t py-10">
              <EmptyState
                variant="inline"
                icon={SearchX}
                title="Không có đợt nào khớp bộ lọc"
                description="Thử tìm bằng từ khác hoặc bỏ bớt điều kiện lọc."
                action={
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    <FunnelX />
                    Xoá lọc
                  </Button>
                }
              />
            </div>
          ) : (
            <Table className="border-t">
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ báo cáo</TableHead>
                  <TableHead>Đợt</TableHead>
                  <TableHead>Đơn vị và phiếu</TableHead>
                  <TableHead>Người mở</TableHead>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead align="right" className="sticky right-0">
                    Thao tác
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const t = totals(p);
                  const at = parseAt(p.openedAt);
                  const view = STATUS_VIEW[p.status];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <TwoLineCell primary={p.periodName} secondary={p.periodRange} />
                      </TableCell>
                      <TableCell>{KIND_LABEL[p.kind]}</TableCell>
                      <TableCell>
                        <TwoLineCell
                          primary={`${formatNumber(t.units)} đơn vị`}
                          secondary={`${formatNumber(t.tickets)} phiếu · ${formatNumber(t.forms)} biểu`}
                        />
                      </TableCell>
                      <TableCell>
                        <TwoLineCell primary={p.openedBy} secondary={p.openedByOrg} />
                      </TableCell>
                      <TableCell>
                        <TwoLineCell primary={formatDate(at)} secondary={hhmm(at)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                      </TableCell>
                      <TableCell align="right" className="sticky right-0 bg-card">
                        <div className="flex justify-end">
                          <RowActions
                            primary={{ label: "Xem chi tiết", icon: Eye, onClick: () => setDetail(p) }}
                            items={[
                              {
                                key: "setup",
                                label: "Mở kỳ ở Thiết lập & điều hành",
                                icon: ExternalLink,
                                onSelect: () => navigate("/period-setup"),
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Phân trang */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2.5">
              <span className="text-sm text-muted-foreground">
                Hiển thị {first}–{last} trong {formatNumber(filtered.length)} đợt
              </span>
              <div className="ms-auto flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang trước"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft />
                </Button>
                {Array.from({ length: pages }, (_, i) => (
                  <Button
                    key={i}
                    variant={i === current ? "default" : "ghost"}
                    size="icon-sm"
                    aria-current={i === current ? "page" : undefined}
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang sau"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm" className="w-[104px]" aria-label="Số đợt mỗi trang">
                  <SelectValue>{pageSize} / trang</SelectValue>
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
          )}
        </div>
      )}

      <PublicationDetailDialog
        publication={detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      />
    </AsxhPage>
  );
}
