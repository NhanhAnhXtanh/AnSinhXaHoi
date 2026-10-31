import { useEffect, useMemo, useState } from "react";
import { useList, type CrudFilter } from "@refinedev/core";
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
  TriangleAlert,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import {
  AsxhPage,
  EmptyState,
  formatDate,
  formatNumber,
  LoadingState,
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
  hhmm,
  KIND_LABEL,
  periodRange,
  STATUS_VIEW,
  type ApiPeriodLite,
  type ApiPublication,
  type PublicationKind,
  type PublicationStatus,
} from "./model";

const PAGE_SIZES = [10, 20, 50] as const;

/** Người mở đợt luôn là cán bộ Sở — máy chủ chưa trả đơn vị của tài khoản. */
const OPENER_ORG = "Sở Tài chính";

export function PublicationHistoryList() {
  const navigate = useNavigate();
  const { year } = useReportYear();

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | PublicationStatus>("all");
  const [kind, setKind] = useState<"all" | PublicationKind>("all");
  const [periodId, setPeriodId] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(0);

  // Gõ tìm: chờ người dùng dừng tay rồi mới hỏi máy chủ.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText]);

  // Đổi năm: kỳ đang lọc thuộc năm cũ nên bỏ.
  useEffect(() => {
    setPeriodId("all");
    setPage(0);
  }, [year]);

  /* ---------- Kỳ của năm (cho ô lọc Kỳ và dòng khoảng thời gian) ---------- */

  const periodsList = useList<ApiPeriodLite>({
    resource: "report_periods",
    pagination: { currentPage: 1, pageSize: 1000 },
    filters: [{ field: "calendar.year", operator: "eq", value: year }],
    sorters: [{ field: "fromDate", order: "asc" }],
  });
  const periodsById = useMemo(
    () => new Map((periodsList.result?.data ?? []).map((p) => [p.id, p])),
    [periodsList.result?.data]
  );
  const periodOptions = useMemo(
    () => (periodsList.result?.data ?? []).map((p) => ({ id: String(p.id), name: p.name })),
    [periodsList.result?.data]
  );

  /* ---------- Các đợt (lọc + phân trang ở máy chủ) ---------- */

  const filters: CrudFilter[] = useMemo(() => {
    const f: CrudFilter[] = [{ field: "year", operator: "eq", value: year }];
    if (status !== "all") f.push({ field: "status", operator: "eq", value: status });
    if (kind !== "all") f.push({ field: "kind", operator: "eq", value: kind });
    if (periodId !== "all") f.push({ field: "period.id", operator: "eq", value: periodId });
    if (search) f.push({ field: "q", operator: "eq", value: search });
    return f;
  }, [year, status, kind, periodId, search]);

  const { result, query } = useList<ApiPublication>({
    resource: "publications",
    pagination: { currentPage: page + 1, pageSize },
    filters,
    sorters: [
      { field: "createdAt", order: "desc" },
      { field: "id", order: "desc" },
    ],
    // Giữ trang cũ trong lúc tải trang mới / lọc mới — thanh lọc không bị gỡ ra lắp lại
    // (ô tìm mất con trỏ giữa chừng khi đang gõ).
    queryOptions: { placeholderData: (previous) => previous },
  });

  const rows = result?.data ?? [];
  const total = result?.total ?? rows.length;
  const filtering = status !== "all" || kind !== "all" || periodId !== "all" || search !== "";

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  // Tổng số đợt giảm sau khi lọc / tải lại: trang đang đứng vượt trang cuối thì máy chủ trả
  // trang rỗng (bảng trống mà chân bảng vẫn ghi số). Kẹp `page` — không chỉ `current` hiển thị —
  // theo kết quả thật để gửi lại đúng `_start`.
  const serverTotal = query.isPlaceholderData || query.isFetching ? undefined : result?.total;
  useEffect(() => {
    if (serverTotal === undefined) return;
    const lastPage = Math.max(0, Math.ceil(serverTotal / pageSize) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [serverTotal, page, pageSize]);
  const first = total === 0 ? 0 : current * pageSize + 1;
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
    setSearchText("");
    setSearch("");
    setStatus("all");
    setKind("all");
    setPeriodId("all");
    setPage(0);
  };

  const refresh = () => {
    void query.refetch();
    void periodsList.query.refetch();
  };

  const body = () => {
    if (query.isLoading) return <LoadingState variant="page" label="Đang tải lịch sử mở đợt…" />;
    if (query.isError)
      return (
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Không tải được lịch sử mở đợt"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button variant="outline" onClick={refresh}>
              Tải lại
            </Button>
          }
        />
      );
    if (total === 0 && !filtering)
      return (
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
      );
    return (
      <div className="overflow-hidden rounded-lg border bg-card shadow-e1">
        {/* Thanh lọc */}
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
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
                    <SelectItem value="LAN_DAU">{KIND_LABEL.LAN_DAU}</SelectItem>
                    <SelectItem value="BO_SUNG">{KIND_LABEL.BO_SUNG}</SelectItem>
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
          <Button variant="outline" size="icon" aria-label="Làm mới" title="Làm mới" onClick={refresh}>
            <RefreshCw className={cn(query.isFetching && "animate-spin")} />
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
        {total === 0 ? (
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
                const at = new Date(p.createdAt);
                const view = STATUS_VIEW[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <TwoLineCell
                        primary={p.period.name}
                        secondary={periodRange(periodsById.get(p.period.id), formatDate)}
                      />
                    </TableCell>
                    <TableCell>{KIND_LABEL[p.kind]}</TableCell>
                    <TableCell>
                      <TwoLineCell
                        primary={`${formatNumber(p.unitCount)} đơn vị`}
                        secondary={`${formatNumber(p.reportCount)} phiếu · ${formatNumber(p.sheetCount)} biểu`}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell primary={p.createdBy || "Hệ thống"} secondary={OPENER_ORG} />
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
                          primary={{
                            label: "Xem chi tiết",
                            icon: Eye,
                            onClick: () => navigate(`/publication-history/${p.id}`),
                          }}
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
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2.5">
            <span className="text-sm text-muted-foreground">
              Hiển thị {first}–{last} trong {formatNumber(total)} đợt
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
    );
  };

  return (
    <AsxhPage
      title="Lịch sử mở đợt"
      description="Các đợt đã mở cho từng kỳ báo cáo: ai mở, mở lúc nào và đã tạo bao nhiêu phiếu."
      actions={<YearSelect />}
    >
      {body()}
    </AsxhPage>
  );
}
