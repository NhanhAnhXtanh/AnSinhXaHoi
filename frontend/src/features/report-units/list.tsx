import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
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
  UNIT_TYPES,
  UNIT_TYPE_LABELS,
  type ReportUnit,
  type UnitType,
} from "./fixtures";
import {
  KHOI_LABELS,
  childrenOf,
  deleteBlocker,
  deleteUnit,
  descendantIds,
  findUnit,
  khoiOf,
  setUnitActive,
  useReportUnits,
  type Khoi,
} from "./store";

type StatusFilter = "all" | "active" | "inactive";
type KhoiFilter = "all" | Khoi;
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

/** Nhãn trong ô lọc "Khối: …". */
const KHOI_SHORT: Record<Khoi, string> = { tinh: "Tỉnh", huyen: "Huyện", xa: "Xã" };

export function ReportUnitList() {
  const navigate = useNavigate();
  const units = useReportUnits();

  const [search, setSearch] = useState("");
  const [khoi, setKhoi] = useState<KhoiFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(childrenOf(units, null).map((u) => u.id))
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Giữ `pending` khi hộp đang đóng dần, để chữ trong hộp không biến mất giữa chừng.
  const [dialogOpen, setDialogOpen] = useState(false);

  function ask(next: PendingConfirm) {
    setPending(next);
    setDialogOpen(true);
  }

  const term = search.trim().toLocaleLowerCase("vi");
  const filtering =
    term !== "" || khoi !== "all" || status !== "all" || type !== "all";

  /** Khi đang lọc: đơn vị khớp + mọi cấp trên của nó (để giữ dạng cây). */
  const included = useMemo(() => {
    if (!filtering) return null;
    const out = new Set<string>();
    for (const u of units) {
      const match =
        (term === "" || u.name.toLocaleLowerCase("vi").includes(term)) &&
        (khoi === "all" || khoiOf(u.type) === khoi) &&
        (type === "all" || u.type === type) &&
        (status === "all" || (status === "active") === u.active);
      if (!match) continue;
      let cur: ReportUnit | undefined = u;
      while (cur && !out.has(cur.id)) {
        out.add(cur.id);
        cur = findUnit(units, cur.parentId);
      }
    }
    return out;
  }, [units, filtering, term, khoi, type, status]);

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    const walk = (parentId: string | null, level: number) => {
      for (const unit of childrenOf(units, parentId)) {
        if (included && !included.has(unit.id)) continue;
        const kids = childrenOf(units, unit.id).filter(
          (k) => !included || included.has(k.id)
        );
        // Đang lọc thì mở hết nhánh có kết quả — người tìm cần thấy ngay chỗ khớp.
        const isOpen = included ? true : expanded.has(unit.id);
        out.push({ unit, level, hasChildren: kids.length > 0, expanded: isOpen });
        if (kids.length > 0 && isOpen) walk(unit.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [units, included, expanded]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setKhoi("all");
    setStatus("all");
    setType("all");
    setPage(0);
  }

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  }

  function askDeactivate(unit: ReportUnit) {
    const ids = descendantIds(units, unit.id);
    const activeDescendants = units.filter((u) => ids.has(u.id) && u.active).length;
    ask({ kind: "deactivate", unit, activeDescendants });
  }

  function reactivate(unit: ReportUnit) {
    setUnitActive(unit.id, true);
    const hasInactiveChild = childrenOf(units, unit.id).some((u) => !u.active);
    toast.success(
      hasInactiveChild
        ? `Đã kích hoạt lại đơn vị ${unit.name}. Các đơn vị cấp dưới vẫn đang ngừng hoạt động — bạn kích hoạt lại từng đơn vị nếu cần.`
        : `Đã kích hoạt lại đơn vị ${unit.name}.`
    );
  }

  function confirmPending() {
    if (!pending) return;
    const { unit } = pending;
    if (pending.kind === "deactivate") {
      setUnitActive(unit.id, false);
      toast.success(
        pending.activeDescendants > 0
          ? `Đã ngừng hoạt động đơn vị ${unit.name} và ${pending.activeDescendants} đơn vị cấp dưới.`
          : `Đã ngừng hoạt động đơn vị ${unit.name}.`
      );
    } else {
      const blocker = deleteBlocker(units, unit.id);
      if (blocker) {
        toast.error(
          `Chưa xoá được đơn vị ${unit.name} vì ${blocker}. Bạn có thể chọn Ngừng hoạt động thay cho xoá.`
        );
      } else {
        deleteUnit(unit.id);
        toast.success(`Đã xoá đơn vị ${unit.name}.`);
      }
    }
    setDialogOpen(false);
  }

  function rowItems(unit: ReportUnit): ActionItem[] {
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
            onSelect: () => reactivate(unit),
          },
      {
        key: "delete",
        label: "Xoá đơn vị",
        icon: Trash,
        destructive: true,
        separatorBefore: true,
        onSelect: () => ask({ kind: "delete", unit }),
      },
    ];
  }

  function secondaryLine(row: FlatRow): string {
    const { unit } = row;
    if (row.hasChildren || childrenOf(units, unit.id).length > 0) {
      return `${formatNumber(descendantIds(units, unit.id).size)} đơn vị trực thuộc`;
    }
    const parent = findUnit(units, unit.parentId);
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
              value={khoi}
              onValueChange={(v) => {
                setKhoi(v as KhoiFilter);
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
                {(Object.keys(KHOI_LABELS) as Khoi[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KHOI_SHORT[k]}
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
              disabled={refreshing}
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
        {rows.length === 0 ? (
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
                        secondary={secondaryLine(row)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{UNIT_TYPE_LABELS[row.unit.type]}</TableCell>
                  <TableCell>{KHOI_LABELS[khoiOf(row.unit.type)]}</TableCell>
                  <TableCell align="right">
                    {formatNumber(row.unit.accounts.length)}
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
        {rows.length > 0 && (
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
            ? `Đơn vị “${pending.unit.name}” sẽ bị xoá và không khôi phục được. Nếu đơn vị còn đơn vị cấp dưới, tài khoản hoặc phiếu báo cáo thì chưa xoá được — khi đó bạn có thể chọn Ngừng hoạt động.`
            : ""
        }
        confirmLabel="Xoá đơn vị"
        cancelLabel="Quay lại"
        destructive
        onConfirm={confirmPending}
      />

      <ConfirmDialog
        open={dialogOpen && pending?.kind === "deactivate"}
        onOpenChange={setDialogOpen}
        title="Ngừng hoạt động đơn vị này?"
        description={
          pending?.kind === "deactivate"
            ? pending.activeDescendants > 0
              ? `Đơn vị “${pending.unit.name}” có ${pending.activeDescendants} đơn vị cấp dưới đang hoạt động. Toàn bộ đơn vị cấp dưới và tài khoản của chúng sẽ ngừng hoạt động theo. Khi kích hoạt lại, các đơn vị cấp dưới không tự hoạt động lại.`
              : `Đơn vị “${pending.unit.name}” sẽ không nhận phiếu báo cáo và tài khoản của đơn vị không đăng nhập được nữa. Bạn có thể kích hoạt lại sau.`
            : ""
        }
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Quay lại"
        onConfirm={confirmPending}
      />
    </AsxhPage>
  );
}
