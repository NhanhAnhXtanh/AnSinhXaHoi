import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  useDelete,
  useList,
  useUpdate,
  type CrudFilter,
  type HttpError,
} from "@refinedev/core";
import {
  ChevronLeft,
  ChevronRight,
  FunnelX,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  RowActions,
  StatusBadge,
  TwoLineCell,
  formatNumber,
  type ActionItem,
} from "@/shared/components/asxh";
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
import { cn } from "@/shared/lib/utils";

import {
  BLOCKS,
  BLOCK_LABELS,
  BLOCK_SHORT,
  TREE_PAGE_SIZE,
  UNIT_RESOURCE,
  UNIT_TYPES,
  UNIT_TYPE_LABELS,
  apiErrorMessage,
  childIndex,
  descendantIds,
  type ReportUnit,
  type UnitBlock,
  type UnitType,
} from "./model";
import { useUnitAccountCounts } from "./use-unit-account-counts";

type StatusFilter = "all" | "active" | "inactive";
type BlockFilter = "all" | UnitBlock;
type TypeFilter = "all" | UnitType;

type FlatRow = {
  unit: ReportUnit;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
};

type PendingConfirm =
  | { kind: "delete"; unit: ReportUnit }
  | { kind: "deactivate"; unit: ReportUnit; activeDescendants: number };

const PAGE_SIZES = [10, 20, 50];

const LOAD_ERROR = "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại.";

/** Giá trị trễ một nhịp gõ — tìm kiếm gửi lên máy chủ khi người dùng ngừng gõ. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Danh sách đơn vị dạng cây — `GET /api/report_units`.
 *
 * Cây được tải đủ một lần (một trang lớn, xếp theo mã). Khi tìm hoặc lọc, máy chủ trả
 * các đơn vị khớp (`q`, `unitType`, `block`, `active`); màn giữ dạng cây bằng cách
 * hiện thêm mọi cấp trên của chúng từ cây đã tải.
 */
export function ReportUnitList() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [block, setBlock] = useState<BlockFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  // null = mặc định (mở sẵn các đơn vị gốc), có từ khi người dùng bấm mở/thu gọn.
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Giữ `pending` khi hộp đang đóng dần, để chữ trong hộp không biến mất giữa chừng.
  const [dialogOpen, setDialogOpen] = useState(false);

  const term = useDebouncedValue(search.trim(), 300);
  const filtering =
    term !== "" || block !== "all" || status !== "all" || type !== "all";

  const { result: treeResult, query: treeQuery } = useList<ReportUnit>({
    resource: UNIT_RESOURCE,
    pagination: { currentPage: 1, pageSize: TREE_PAGE_SIZE },
    sorters: [{ field: "budgetCode", order: "asc" }],
    errorNotification: false,
  });
  const units = useMemo(() => treeResult.data ?? [], [treeResult.data]);
  // Số tài khoản gắn với từng đơn vị (null = chưa biết / không có quyền xem người dùng).
  const accountCounts = useUnitAccountCounts();

  const filters = useMemo<CrudFilter[]>(() => {
    const out: CrudFilter[] = [];
    if (term !== "") out.push({ field: "q", operator: "eq", value: term });
    if (block !== "all") out.push({ field: "block", operator: "eq", value: block });
    if (type !== "all") out.push({ field: "unitType", operator: "eq", value: type });
    if (status !== "all") {
      out.push({ field: "active", operator: "eq", value: status === "active" });
    }
    return out;
  }, [term, block, type, status]);

  const { result: matchResult, query: matchQuery } = useList<ReportUnit>({
    resource: UNIT_RESOURCE,
    pagination: { currentPage: 1, pageSize: TREE_PAGE_SIZE },
    filters,
    errorNotification: false,
    queryOptions: {
      enabled: filtering,
      // Giữ kết quả lần lọc trước trong lúc chờ lần mới, để bảng không nháy trắng.
      placeholderData: (previous) => previous,
    },
  });

  const { mutateAsync: updateUnit } = useUpdate<ReportUnit, HttpError, { active: boolean }>();
  const { mutateAsync: deleteUnit } = useDelete<ReportUnit>();

  const index = useMemo(() => childIndex(units), [units]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const openSet = useMemo(
    () => expanded ?? new Set((index.get(null) ?? []).map((u) => u.id)),
    [expanded, index]
  );

  /** Khi đang lọc: đơn vị khớp + mọi cấp trên của nó (để giữ dạng cây). */
  const included = useMemo(() => {
    if (!filtering) return null;
    const out = new Set<number>();
    for (const match of matchResult.data ?? []) {
      let cur: ReportUnit | undefined = byId.get(match.id);
      while (cur && !out.has(cur.id)) {
        out.add(cur.id);
        cur = cur.parent ? byId.get(cur.parent.id) : undefined;
      }
    }
    return out;
  }, [filtering, matchResult.data, byId]);

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    const walk = (parentId: number | null, level: number) => {
      for (const unit of index.get(parentId) ?? []) {
        if (included && !included.has(unit.id)) continue;
        const kids = (index.get(unit.id) ?? []).filter(
          (k) => !included || included.has(k.id)
        );
        // Đang lọc thì mở hết nhánh có kết quả — người tìm cần thấy ngay chỗ khớp.
        const isOpen = included ? true : openSet.has(unit.id);
        out.push({ unit, level, hasChildren: kids.length > 0, expanded: isOpen });
        if (kids.length > 0 && isOpen) walk(unit.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [index, included, openSet]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const loading = treeQuery.isLoading || (filtering && matchQuery.isLoading);
  const loadError = treeQuery.isError
    ? treeQuery.error
    : filtering && matchQuery.isError
      ? matchQuery.error
      : null;
  const refreshing = !loading && (treeQuery.isFetching || (filtering && matchQuery.isFetching));

  function ask(next: PendingConfirm) {
    setPending(next);
    setDialogOpen(true);
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev ?? openSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setBlock("all");
    setStatus("all");
    setType("all");
    setPage(0);
  }

  function refresh() {
    void treeQuery.refetch();
    if (filtering) void matchQuery.refetch();
  }

  function askDeactivate(unit: ReportUnit) {
    const ids = descendantIds(index, unit.id);
    const activeDescendants = units.filter((u) => ids.has(u.id) && u.active).length;
    ask({ kind: "deactivate", unit, activeDescendants });
  }

  async function setActive(unit: ReportUnit, active: boolean): Promise<boolean> {
    try {
      await updateUnit({
        resource: UNIT_RESOURCE,
        id: unit.id,
        values: { active },
        successNotification: false,
        errorNotification: false,
      });
      return true;
    } catch (error) {
      toast.error(
        apiErrorMessage(
          error,
          active
            ? `Chưa kích hoạt lại được đơn vị ${unit.name}. Bạn thử lại sau ít phút.`
            : `Chưa ngừng hoạt động được đơn vị ${unit.name}. Bạn thử lại sau ít phút.`
        )
      );
      return false;
    }
  }

  async function reactivate(unit: ReportUnit) {
    if (!(await setActive(unit, true))) return;
    const hasInactiveChild = (index.get(unit.id) ?? []).some((u) => !u.active);
    toast.success(
      hasInactiveChild
        ? `Đã kích hoạt lại đơn vị ${unit.name}. Các đơn vị cấp dưới vẫn đang ngừng hoạt động — bạn kích hoạt lại từng đơn vị nếu cần.`
        : `Đã kích hoạt lại đơn vị ${unit.name}.`
    );
  }

  async function confirmPending() {
    if (!pending) return;
    const current = pending;
    setDialogOpen(false);
    const { unit } = current;

    if (current.kind === "deactivate") {
      if (!(await setActive(unit, false))) return;
      toast.success(
        current.activeDescendants > 0
          ? `Đã ngừng hoạt động đơn vị ${unit.name} và ${current.activeDescendants} đơn vị cấp dưới.`
          : `Đã ngừng hoạt động đơn vị ${unit.name}.`
      );
      return;
    }

    try {
      await deleteUnit({
        resource: UNIT_RESOURCE,
        id: unit.id,
        successNotification: false,
        errorNotification: false,
      });
      toast.success(`Đã xoá đơn vị ${unit.name}.`);
    } catch (error) {
      // 409 tiếng Việt từ máy chủ: còn cấp dưới, đã thiết lập biểu hoặc đã có phiếu.
      toast.error(
        apiErrorMessage(
          error,
          `Chưa xoá được đơn vị ${unit.name}. Bạn có thể chọn Ngừng hoạt động thay cho xoá.`
        )
      );
    }
  }

  function rowItems(unit: ReportUnit): ActionItem[] {
    const hasChildren = (index.get(unit.id)?.length ?? 0) > 0;
    return [
      {
        key: "edit",
        label: "Sửa đơn vị",
        icon: Pencil,
        onSelect: () => navigate(`/report-units/edit/${unit.id}`),
      },
      unit.active
        ? {
            key: "deactivate",
            label: "Ngừng hoạt động",
            icon: PowerOff,
            onSelect: () => askDeactivate(unit),
          }
        : {
            key: "reactivate",
            label: "Kích hoạt lại",
            icon: Power,
            onSelect: () => void reactivate(unit),
          },
      {
        key: "delete",
        label: "Xoá đơn vị",
        icon: Trash,
        destructive: true,
        separatorBefore: true,
        disabled: hasChildren,
        reason: hasChildren
          ? "Còn đơn vị cấp dưới nên chưa xoá được. Hãy chuyển hoặc xoá các đơn vị cấp dưới trước."
          : undefined,
        onSelect: () => ask({ kind: "delete", unit }),
      },
    ];
  }

  function secondaryLine(unit: ReportUnit): string {
    if ((index.get(unit.id)?.length ?? 0) > 0) {
      return `${formatNumber(descendantIds(index, unit.id).size)} đơn vị trực thuộc`;
    }
    const parent = unit.parent ? byId.get(unit.parent.id) ?? unit.parent : undefined;
    return parent ? `Thuộc ${parent.name}` : "Đơn vị cao nhất";
  }

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (status !== "all") {
    chips.push({
      key: "status",
      label: `Trạng thái: ${status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}`,
      clear: () => setStatus("all"),
    });
  }
  if (type !== "all") {
    chips.push({
      key: "type",
      label: `Loại đơn vị: ${UNIT_TYPE_LABELS[type]}`,
      clear: () => setType("all"),
    });
  }

  const from = rows.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(rows.length, (safePage + 1) * pageSize);

  return (
    <AsxhPage
      title="Danh sách đơn vị"
      description="Các đơn vị báo cáo của tỉnh, xếp theo cấp trên – cấp dưới."
      actions={
        <HeaderActions
          primary={{
            label: "Thêm đơn vị",
            icon: Plus,
            onClick: () => navigate("/report-units/create"),
          }}
        />
      }
    >
      <div className="bg-card text-card-foreground border-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
        {/* Thanh lọc */}
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Tìm theo tên đơn vị…"
                aria-label="Tìm theo tên đơn vị"
                className="ps-9"
              />
            </div>

            <Select
              value={block}
              onValueChange={(v) => {
                setBlock(v as BlockFilter);
                setPage(0);
              }}
            >
              <SelectTrigger className="min-w-40" aria-label="Lọc theo khối">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Khối:</span>
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Tất cả</SelectItem>
                {BLOCKS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {BLOCK_SHORT[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                  <SlidersHorizontal aria-hidden />
                  Bộ lọc khác
                  {chips.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5 tabular-nums">
                      {chips.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-72 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ru-filter-status">Trạng thái</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => {
                      setStatus(v as StatusFilter);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger id="ru-filter-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="active">Đang hoạt động</SelectItem>
                      <SelectItem value="inactive">Ngừng hoạt động</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ru-filter-type">Loại đơn vị</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      setType(v as TypeFilter);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger id="ru-filter-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {UNIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {UNIT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Làm mới"
              title="Làm mới"
              onClick={refresh}
              disabled={refreshing || loading}
            >
              <RefreshCw aria-hidden className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>

          {(chips.length > 0 || filtering) && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="bg-accent text-accent-foreground inline-flex h-7 items-center gap-1 rounded-md ps-2.5 pe-1 text-xs font-medium"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => {
                      chip.clear();
                      setPage(0);
                    }}
                    aria-label={`Bỏ điều kiện ${chip.label}`}
                    className="hover:bg-background/60 inline-flex size-5 items-center justify-center rounded"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <FunnelX aria-hidden />
                Xoá lọc
              </Button>
            </div>
          )}
        </div>

        {/* Bảng cây */}
        {loading ? (
          <LoadingState label="Đang tải danh sách đơn vị…" />
        ) : loadError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Chưa tải được danh sách đơn vị"
            description={apiErrorMessage(loadError, LOAD_ERROR)}
            action={
              <Button type="button" variant="outline" onClick={refresh}>
                <RefreshCw aria-hidden />
                Thử lại
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={filtering ? FunnelX : Search}
            title={filtering ? "Không có đơn vị nào khớp" : "Chưa có đơn vị nào"}
            description={
              filtering
                ? "Thử đổi từ khoá tìm kiếm hoặc bỏ bớt điều kiện lọc."
                : "Bấm Thêm đơn vị để tạo đơn vị đầu tiên."
            }
            action={
              filtering ? (
                <Button type="button" variant="outline" onClick={clearFilters}>
                  <FunnelX aria-hidden />
                  Xoá lọc
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Tên đơn vị</TableHead>
                <TableHead className="w-32">Loại đơn vị</TableHead>
                <TableHead className="w-32">Khối</TableHead>
                <TableHead align="right" className="w-24">
                  Tài khoản
                </TableHead>
                <TableHead className="w-44">Trạng thái</TableHead>
                <TableHead align="right" className="w-20 pe-4">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.unit.id}>
                  <TableCell className="ps-4">
                    <div
                      className="flex min-w-0 items-center gap-1.5"
                      style={{
                        paddingInlineStart: `calc(var(--spacing) * ${row.level * 5})`,
                      }}
                    >
                      {row.hasChildren ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-6"
                          aria-expanded={row.expanded}
                          aria-label={
                            row.expanded
                              ? `Thu gọn ${row.unit.name}`
                              : `Mở rộng ${row.unit.name}`
                          }
                          onClick={() => toggle(row.unit.id)}
                          disabled={included !== null}
                        >
                          <ChevronRight
                            aria-hidden
                            className={cn(
                              "transition-transform duration-150",
                              row.expanded && "rotate-90"
                            )}
                          />
                        </Button>
                      ) : (
                        <span aria-hidden className="size-6 shrink-0" />
                      )}
                      <TwoLineCell
                        primary={row.unit.name}
                        secondary={secondaryLine(row.unit)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{UNIT_TYPE_LABELS[row.unit.unitType] ?? "—"}</TableCell>
                  <TableCell>{BLOCK_LABELS[row.unit.block] ?? "—"}</TableCell>
                  <TableCell align="right">
                    {accountCounts
                      ? formatNumber(accountCounts.get(row.unit.id) ?? 0)
                      : formatNumber(null)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={row.unit.active ? "success" : "neutral"}>
                      {row.unit.active ? "Đang hoạt động" : "Ngừng hoạt động"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell align="right" className="pe-4">
                    <RowActions items={rowItems(row.unit)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Phân trang */}
        {!loading && !loadError && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-muted-foreground text-sm tabular-nums">
              Hiển thị {formatNumber(from)}–{formatNumber(to)} trong{" "}
              {formatNumber(rows.length)} đơn vị
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Trang trước"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              {Array.from({ length: pageCount }, (_, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={i === safePage ? "default" : "ghost"}
                  size="icon-sm"
                  aria-label={`Trang ${i + 1}`}
                  aria-current={i === safePage ? "page" : undefined}
                  onClick={() => setPage(i)}
                  className="tabular-nums"
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Trang sau"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm" className="ms-2 min-w-28" aria-label="Số dòng mỗi trang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / trang
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialogOpen && pending?.kind === "delete"}
        onOpenChange={setDialogOpen}
        title="Xoá đơn vị này?"
        description={
          pending?.kind === "delete"
            ? `Đơn vị “${pending.unit.name}” sẽ bị xoá và không khôi phục được. Nếu đơn vị đã được thiết lập biểu cho kỳ báo cáo hoặc đã có phiếu báo cáo thì chưa xoá được — khi đó bạn có thể chọn Ngừng hoạt động.`
            : ""
        }
        confirmLabel="Xoá đơn vị"
        cancelLabel="Quay lại"
        destructive
        onConfirm={() => void confirmPending()}
      />

      <ConfirmDialog
        open={dialogOpen && pending?.kind === "deactivate"}
        onOpenChange={setDialogOpen}
        title="Ngừng hoạt động đơn vị này?"
        description={
          pending?.kind === "deactivate"
            ? pending.activeDescendants > 0
              ? `Đơn vị “${pending.unit.name}” có ${pending.activeDescendants} đơn vị cấp dưới đang hoạt động. Toàn bộ đơn vị cấp dưới sẽ ngừng hoạt động theo. Khi kích hoạt lại, các đơn vị cấp dưới không tự hoạt động lại.`
              : `Đơn vị “${pending.unit.name}” sẽ không nhận phiếu báo cáo nữa. Bạn có thể kích hoạt lại sau.`
            : ""
        }
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Quay lại"
        onConfirm={() => void confirmPending()}
      />
    </AsxhPage>
  );
}
