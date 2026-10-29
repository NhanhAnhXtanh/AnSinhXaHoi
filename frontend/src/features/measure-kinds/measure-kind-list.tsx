import { useEffect, useMemo, useState } from "react";
import {
  useCan,
  useCustom,
  useCustomMutation,
  useInvalidate,
  useList,
  type BaseRecord,
  type CrudFilter,
  type HttpError,
} from "@refinedev/core";
import {
  ChevronLeft,
  ChevronRight,
  FunnelX,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  SearchX,
  SquarePen,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  formatNumber,
  LoadingState,
  RowActions,
  StatusBadge,
  TwoLineCell,
} from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
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

import { DeclareDialog } from "./declare-dialog";
import {
  INDICATOR_MEASURES_URL,
  KIND_VIEW,
  MEASURE_KINDS,
  ruleText,
  sheetLine,
  UNSET,
  type ApiIndicatorMeasure,
  type MeasureKind,
} from "./model";

const PAGE_SIZES = [20, 50, 100] as const;
/** Tên resource của màn — quyền tra qua SCREEN_PERMISSIONS (`indicator_measures:*`). */
const SCREEN = "measure_kinds";
/** Resource REST mà danh sách đọc. */
const API_RESOURCE = "indicator_measures";
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

type KindFilter = "all" | typeof UNSET | MeasureKind;

/** Câu lỗi tiếng Việt máy chủ trả, hoặc câu dự phòng. */
function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message !== "" && /[À-ỹ]/.test(message)) return message;
  }
  return fallback;
}

function kindFilterLabel(kind: KindFilter): string {
  if (kind === "all") return "Tất cả";
  if (kind === UNSET) return "Chưa khai";
  return KIND_VIEW[kind].label;
}

export function MeasureKindList() {
  const invalidate = useInvalidate();
  const { data: canWriteData } = useCan({ resource: SCREEN, action: "edit" });
  const canWrite = canWriteData?.can === true;

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sheet, setSheet] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, ApiIndicatorMeasure>>(() => new Map());
  const [dialog, setDialog] = useState<{ key: number; rows: ApiIndicatorMeasure[] } | null>(null);
  const [resetRow, setResetRow] = useState<ApiIndicatorMeasure | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText]);

  /* ---------- Biểu có chỉ tiêu (ô lọc Biểu) ---------- */

  const sheetsQuery = useCustom<BaseRecord, HttpError>({
    url: `${INDICATOR_MEASURES_URL}/sheets`,
    method: "get",
    errorNotification: false,
    queryOptions: { refetchOnWindowFocus: false },
  });
  const sheetsRaw = sheetsQuery.result?.data as unknown;
  const sheetOptions = useMemo(() => (Array.isArray(sheetsRaw) ? (sheetsRaw as string[]) : []), [sheetsRaw]);

  /* ---------- Danh mục chỉ tiêu ---------- */

  const filters: CrudFilter[] = useMemo(() => {
    const f: CrudFilter[] = [];
    if (kind !== "all") f.push({ field: "measureKind", operator: "eq", value: kind });
    if (sheet !== "all") f.push({ field: "sheet", operator: "eq", value: sheet });
    if (search) f.push({ field: "q", operator: "eq", value: search });
    return f;
  }, [kind, sheet, search]);

  const { result, query } = useList<ApiIndicatorMeasure>({
    resource: API_RESOURCE,
    pagination: { currentPage: page + 1, pageSize },
    filters,
    queryOptions: { placeholderData: (previous) => previous },
  });

  const rows = result?.data ?? [];
  const total = result?.total ?? rows.length;
  const filtering = kind !== "all" || sheet !== "all" || search !== "";
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const serverTotal = query.isPlaceholderData || query.isFetching ? undefined : result?.total;
  useEffect(() => {
    if (serverTotal === undefined) return;
    const lastPage = Math.max(0, Math.ceil(serverTotal / pageSize) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [serverTotal, page, pageSize]);
  const first = total === 0 ? 0 : current * pageSize + 1;
  const last = current * pageSize + rows.length;

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPageSelected = rows.some((r) => selected.has(r.id));

  const toggleRow = (row: ApiIndicatorMeasure, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (on) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of rows) {
        if (on) next.set(r.id, r);
        else next.delete(r.id);
      }
      return next;
    });

  const clearAll = () => {
    setSearchText("");
    setSearch("");
    setKind("all");
    setSheet("all");
    setPage(0);
  };

  const refresh = () => {
    void query.refetch();
    void sheetsQuery.query.refetch();
  };

  /* ---------- Ghi ---------- */

  const { mutateAsync: put } = useCustomMutation();

  const save = async (codes: string[], measureKind: MeasureKind | null, note: string | null) => {
    setBusy(true);
    try {
      await put({
        url: INDICATOR_MEASURES_URL,
        method: "put",
        values: { indicatorCodes: codes, measureKind, note },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Chưa lưu được bản chất chỉ tiêu. Bạn thử lại sau ít phút."));
      return false;
    } finally {
      setBusy(false);
      await invalidate({ resource: API_RESOURCE, invalidates: ["list"] });
    }
  };

  const confirmDeclare = async (measureKind: MeasureKind, note: string | null) => {
    if (!dialog) return;
    const codes = dialog.rows.map((r) => r.indicatorCode);
    if (await save(codes, measureKind, note)) {
      toast.success(
        codes.length === 1
          ? `Đã khai "${KIND_VIEW[measureKind].label}" cho chỉ tiêu ${dialog.rows[0].indicatorName}.`
          : `Đã khai "${KIND_VIEW[measureKind].label}" cho ${formatNumber(codes.length)} chỉ tiêu.`
      );
      setDialog(null);
      setSelected(new Map());
    }
  };

  // Hộp xác nhận tự đóng khi bấm, nên giữ dòng trong biến cục bộ trước khi ghi.
  const confirmReset = async () => {
    const row = resetRow;
    if (!row) return;
    if (await save([row.indicatorCode], null, null)) {
      toast.success(`Chỉ tiêu ${row.indicatorName} đã về cách tính mặc định.`);
    }
  };

  const openDialog = (target: ApiIndicatorMeasure[]) =>
    setDialog((prev) => ({ key: (prev?.key ?? 0) + 1, rows: target }));

  /* ---------- Hiển thị ---------- */

  const body = () => {
    if (query.isLoading) return <LoadingState variant="page" label="Đang tải danh mục chỉ tiêu…" />;
    if (query.isError)
      return (
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Không tải được danh mục chỉ tiêu"
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
          icon={Scale}
          title="Chưa có chỉ tiêu nào"
          description="Chỉ tiêu hiện ở đây khi có phiếu của đơn vị được Sở phê duyệt lần đầu."
        />
      );
    return (
      <div className="overflow-hidden rounded-lg border bg-card shadow-e1">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm theo tên chỉ tiêu…"
              aria-label="Tìm theo tên chỉ tiêu"
              className="pl-9"
            />
          </div>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as KindFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[230px]" aria-label="Lọc theo bản chất">
              <SelectValue>Bản chất: {kindFilterLabel(kind)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value={UNSET}>Chưa khai</SelectItem>
              {MEASURE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_VIEW[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sheet}
            onValueChange={(v) => {
              setSheet(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]" aria-label="Lọc theo biểu">
              <SelectValue>Biểu: {sheet === "all" ? "Tất cả" : sheet}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {sheetOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Làm mới" title="Làm mới" onClick={refresh}>
            <RefreshCw className={cn(query.isFetching && "animate-spin")} />
          </Button>
        </div>

        {filtering && (
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <FunnelX />
              Xoá lọc
            </Button>
          </div>
        )}

        {canWrite && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t bg-surface-subtle px-3 py-2">
            <span className="text-sm">
              Đã chọn <span className="font-semibold">{formatNumber(selected.size)}</span> chỉ tiêu
            </span>
            <Button size="sm" onClick={() => openDialog([...selected.values()])}>
              <SquarePen />
              Khai bản chất
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
              <X />
              Bỏ chọn
            </Button>
          </div>
        )}

        {total === 0 ? (
          <div className="border-t py-10">
            <EmptyState
              variant="inline"
              icon={SearchX}
              title="Không có chỉ tiêu nào khớp bộ lọc"
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
                {canWrite && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => togglePage(v === true)}
                      aria-label="Chọn mọi chỉ tiêu trên trang"
                    />
                  </TableHead>
                )}
                <TableHead>Chỉ tiêu</TableHead>
                <TableHead>Bản chất</TableHead>
                <TableHead>Khi tổng hợp nhiều kỳ</TableHead>
                <TableHead>Ghi chú</TableHead>
                {canWrite && (
                  <TableHead align="right" className="sticky right-0">
                    Thao tác
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                  {canWrite && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => toggleRow(row, v === true)}
                        aria-label={`Chọn chỉ tiêu ${row.indicatorName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="max-w-[420px] whitespace-normal">
                    <TwoLineCell primary={row.indicatorName} secondary={sheetLine(row)} />
                  </TableCell>
                  <TableCell>
                    {row.measureKind ? (
                      <StatusBadge tone={KIND_VIEW[row.measureKind].tone}>
                        {KIND_VIEW[row.measureKind].label}
                      </StatusBadge>
                    ) : (
                      <TwoLineCell
                        primary={<StatusBadge tone="outline">Chưa khai</StatusBadge>}
                        secondary={`Đang tính như: ${KIND_VIEW[row.effectiveKind].label}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    {ruleText(row.quantityRule, row.amountRule)}
                  </TableCell>
                  <TableCell className="max-w-[240px] whitespace-normal text-sm text-muted-foreground">
                    {row.note || "—"}
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right" className="sticky right-0 bg-card">
                      <RowActions
                        primary={{
                          label: row.measureKind ? "Đổi bản chất" : "Khai bản chất",
                          icon: SquarePen,
                          onClick: () => openDialog([row]),
                        }}
                        items={[
                          {
                            key: "reset",
                            label: "Về cách tính mặc định",
                            icon: RotateCcw,
                            disabled: !row.measureKind,
                            reason: row.measureKind ? undefined : "Chỉ tiêu chưa khai bản chất.",
                            onSelect: () => setResetRow(row),
                          },
                        ]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2.5">
            <span className="text-sm text-muted-foreground">
              Hiển thị {first}–{last} trong {formatNumber(total)} chỉ tiêu
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
              <span className="px-2 text-sm tabular-nums">
                Trang {current + 1}/{pages}
              </span>
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
              <SelectTrigger size="sm" className="w-[112px]" aria-label="Số chỉ tiêu mỗi trang">
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
      title="Bản chất chỉ tiêu"
      description="Khai mỗi chỉ tiêu là người hưởng, lượt hỗ trợ, mức hỗ trợ, số tháng hay kinh phí, để khi tổng hợp cả quý, cả năm hệ thống cộng hoặc lấy số cho đúng."
    >
      {body()}

      {dialog && (
        <DeclareDialog
          key={dialog.key}
          rows={dialog.rows}
          open
          busy={busy}
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          onConfirm={(k, n) => void confirmDeclare(k, n)}
        />
      )}

      <ConfirmDialog
        open={resetRow !== null}
        onOpenChange={(o) => {
          if (!o) setResetRow(null);
        }}
        title="Đưa chỉ tiêu về cách tính mặc định?"
        description={
          resetRow
            ? `Chỉ tiêu ${resetRow.indicatorName} sẽ được tính như "${KIND_VIEW.NGUOI.label}" khi tổng hợp nhiều kỳ.`
            : ""
        }
        confirmLabel="Về mặc định"
        onConfirm={() => void confirmReset()}
      />
    </AsxhPage>
  );
}
