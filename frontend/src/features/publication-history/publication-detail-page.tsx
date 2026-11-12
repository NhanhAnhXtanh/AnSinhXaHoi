import { Fragment, useEffect, useMemo, useState } from "react";
import { useCan, useCustom, useOne } from "@refinedev/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  FileX2,
  FunnelX,
  RefreshCw,
  RotateCcwClock,
  Search,
  SearchX,
  Sigma,
  TriangleAlert,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";

import {
  AsxhPage,
  EmptyState,
  formatDate,
  formatNumber,
  LoadingState,
  QuickFilterCards,
  RowActions,
  StatusBadge,
  TwoLineCell,
  type ActionItem,
} from "@/shared/components/asxh";
import { customResult } from "@/shared/hooks/use-custom-result";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
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

import { publicationItemsUrl, type ApiPublicationItem, type ApiPublicationItems } from "./api";
import { ItemHistory } from "./item-history";
import {
  COMPLETION_VIEW,
  hhmm,
  KIND_LABEL,
  ledgerCounts,
  periodRange,
  ROW_STATUS_ORDER,
  ROW_STATUS_VIEW,
  rowStatus,
  STATUS_VIEW,
  UNIT_GROUP_LABEL,
  type ApiPeriodLite,
  type ApiPublication,
  type RowStatus,
} from "./model";
import { includesFolded } from "@/shared/lib/fold-vi";

const LIST_PATH = "/publication-history";
const PAGE_SIZES = [20, 50, 100] as const;
/** Thẻ luôn hiện kể cả khi bằng 0; các thẻ còn lại chỉ hiện khi có dòng. */
const ALWAYS_SHOWN: ReadonlySet<RowStatus> = new Set(["draft", "submitted", "returned", "approved"]);

type Block = "tinh" | "huyen" | "xa";

const rowKey = (i: ApiPublicationItem) => `${i.report.firstId}:${i.template.id}`;

/**
 * Chi tiết một đợt mở (UC-30), trang riêng `/publication-history/:id`: thông tin đợt, thẻ đếm
 * theo trạng thái phiếu, rồi từng dòng đơn vị × biểu mà đợt đã phát (gom sẵn ở máy chủ —
 * `GET /api/publications/{id}/items`). Mở một dòng để xem diễn biến của đúng biểu đó về sau,
 * rồi đi tiếp sang phiếu hoặc Tổng hợp.
 */
export function PublicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const numericId = id && /^\d+$/.test(id) ? Number(id) : null;

  const { result: publication, query: publicationQuery } = useOne<ApiPublication>({
    resource: "publications",
    id: numericId ?? 0,
    queryOptions: { enabled: numericId !== null },
    errorNotification: false,
  });

  if (numericId === null || (publicationQuery.isError && errorStatus(publicationQuery.error) === 404)) {
    return (
      <AsxhPage title="Không tìm thấy đợt mở" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={FileSearch}
          title="Không tìm thấy đợt mở"
          description="Đường dẫn có thể không đúng. Quay lại lịch sử mở đợt để chọn đợt khác."
          action={
            <Button variant="outline" onClick={() => navigate(LIST_PATH)}>
              Về lịch sử mở đợt
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (publicationQuery.isError) {
    return (
      <AsxhPage title="Chưa mở được đợt" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa mở được đợt"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button variant="outline" onClick={() => void publicationQuery.refetch()}>
              Tải lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (!publication || publication.id !== numericId) {
    return <LoadingState variant="page" label="Đang mở đợt…" />;
  }
  return <DetailScreen key={publication.id} publication={publication} />;
}

function DetailScreen({ publication: p }: { publication: ApiPublication }) {
  const navigate = useNavigate();
  const { data: canReview } = useCan({ resource: "report_review", action: "list" });
  const { data: canSummary } = useCan({ resource: "summary", action: "list" });

  const { result: period } = useOne<ApiPeriodLite>({
    resource: "report_periods",
    id: p.period.id,
    errorNotification: false,
  });

  const { result, query } = useCustom<ApiPublicationItems>({
    url: publicationItemsUrl(p.id),
    method: "get",
    errorNotification: false,
  });
  const items = useMemo(() => customResult(result?.data, "items")?.items ?? [], [result?.data]);

  const [quick, setQuick] = useState<RowStatus | null>(null);
  const [block, setBlock] = useState<"all" | Block>("all");
  const [templateId, setTemplateId] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Gõ tìm: chờ người dùng dừng tay rồi mới lọc (bảng có thể tới cả nghìn dòng).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const templates = useMemo(() => {
    const byId = new Map<number, { id: number; label: string }>();
    for (const i of items)
      if (!byId.has(i.template.id))
        byId.set(i.template.id, {
          id: i.template.id,
          label: [i.template.shortName, i.template.name].filter(Boolean).join(" — "),
        });
    return [...byId.values()];
  }, [items]);

  // Lọc theo khối / biểu / tên trước, thẻ đếm tính trên kết quả đó rồi mới lọc theo thẻ.
  const narrowed = useMemo(
    () =>
      items.filter(
        (i) =>
          (block === "all" || i.unit.block === block) &&
          (templateId === "all" || String(i.template.id) === templateId) &&
          includesFolded(i.unit.name, search)
      ),
    [items, block, templateId, search]
  );
  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { draft: 0, submitted: 0, returned: 0, approved: 0, locked: 0, cancelled: 0 };
    for (const i of narrowed) c[rowStatus(i)] += 1;
    return c;
  }, [narrowed]);
  const rows = useMemo(
    () => (quick === null ? narrowed : narrowed.filter((i) => rowStatus(i) === quick)),
    [narrowed, quick]
  );

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  const first = rows.length === 0 ? 0 : current * pageSize + 1;
  const last = current * pageSize + pageRows.length;

  const units = useMemo(() => new Set(items.map((i) => i.unit.id)).size, [items]);
  const added = useMemo(() => items.filter((i) => i.delivery === "ADDED_TO_OPEN_REPORT").length, [items]);
  const showLedger = items.some((i) => i.ledger !== null);
  const hasDerived = rows.some((i) => i.derived);
  const filtering = block !== "all" || templateId !== "all" || search !== "" || quick !== null;

  const clearAll = () => {
    setQuick(null);
    setBlock("all");
    setTemplateId("all");
    setSearchText("");
    setSearch("");
    setPage(0);
  };

  const opened = new Date(p.createdAt);
  const openedBy = p.createdBy || "Hệ thống";
  const range = periodRange(period, formatDate);
  const backHere = `${LIST_PATH}/${p.id}`;

  const openReport = (i: ApiPublicationItem) =>
    navigate(`/report-review/${i.report.id}?bieu=${i.template.id}&from=${encodeURIComponent(backHere)}`);
  const openSummary = (i: ApiPublicationItem) => {
    const params = new URLSearchParams({ ky: String(p.period.id), bieu: String(i.template.id) });
    if (period?.year) params.set("nam", String(period.year));
    navigate(`/summary?${params.toString()}`);
  };

  const quickItems = ROW_STATUS_ORDER.filter((s) => ALWAYS_SHOWN.has(s) || counts[s] > 0).map((s) => ({
    key: s,
    label: ROW_STATUS_VIEW[s].label,
    count: counts[s],
  }));

  const body = () => {
    if (query.isLoading) return <LoadingState variant="page" label="Đang tải các dòng của đợt…" />;
    if (query.isError)
      return (
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Không tải được các dòng của đợt"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tải lại
            </Button>
          }
        />
      );
    if (items.length === 0)
      return (
        <EmptyState
          variant="page"
          icon={FileX2}
          title={p.status === "CANCELLED" ? "Phiếu của đợt đã bị xoá khi thu hồi kỳ" : "Đợt này chưa có dòng nào"}
          description={
            p.status === "CANCELLED"
              ? "Khi thu hồi kỳ để thiết lập lại, mọi phiếu của kỳ bị xoá; đợt vẫn được giữ lại để tra cứu."
              : "Không còn biểu nào của đợt trong các phiếu hiện có của kỳ."
          }
        />
      );
    return (
      <>
        <QuickFilterCards
          items={quickItems}
          value={quick}
          onChange={(k) => {
            setQuick(k as RowStatus | null);
            setPage(0);
          }}
        />

        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-e1">
          {/* Thanh lọc */}
          <div className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm theo tên đơn vị…"
                aria-label="Tìm theo tên đơn vị"
                className="pl-9"
              />
            </div>
            <Select
              value={block}
              onValueChange={(v) => {
                setBlock(v as "all" | Block);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[200px]" aria-label="Lọc theo khối đơn vị">
                <SelectValue>{block === "all" ? "Khối: Tất cả" : UNIT_GROUP_LABEL[block]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả các khối</SelectItem>
                {(Object.keys(UNIT_GROUP_LABEL) as Block[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {UNIT_GROUP_LABEL[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length > 1 && (
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[200px]" aria-label="Lọc theo biểu">
                  <SelectValue>
                    {templateId === "all"
                      ? "Biểu: Tất cả"
                      : `Biểu ${templates.find((t) => String(t.id) === templateId)?.label.split(" — ")[0] ?? ""}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả các biểu</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtering && (
              <Button variant="ghost" onClick={clearAll}>
                <FunnelX />
                Xoá lọc
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Làm mới"
              title="Làm mới"
              onClick={() => void query.refetch()}
            >
              <RefreshCw className={cn(query.isFetching && "animate-spin")} />
            </Button>
          </div>

          {/* Bảng */}
          {rows.length === 0 ? (
            <div className="border-t py-10">
              <EmptyState
                variant="inline"
                icon={SearchX}
                title="Không có dòng nào khớp bộ lọc"
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
                  <TableHead className="w-10" aria-label="Diễn biến" />
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Biểu</TableHead>
                  <TableHead>Cách nhận</TableHead>
                  <TableHead>Phiếu hiện tại</TableHead>
                  <TableHead>Tình trạng biểu</TableHead>
                  {showLedger && <TableHead>Ghi nhận số liệu</TableHead>}
                  <TableHead align="right" className="sticky right-0 w-14">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((i) => {
                  const key = rowKey(i);
                  const open = expanded === key;
                  const status = ROW_STATUS_VIEW[rowStatus(i)];
                  const completion = COMPLETION_VIEW[i.sheet.completion];
                  const saved = i.sheet.dataUpdatedAt ? new Date(i.sheet.dataUpdatedAt) : null;
                  // Chỉ nút ⋯ ở cột thao tác: bảng nhiều cột, nút chữ sẽ đè lên cột cuối.
                  const menu: ActionItem[] = [
                    ...(canReview?.can
                      ? [{ key: "open", label: "Mở phiếu", icon: Eye, onSelect: () => openReport(i) }]
                      : []),
                    {
                      key: "history",
                      label: open ? "Thu gọn diễn biến" : "Xem diễn biến",
                      icon: RotateCcwClock,
                      onSelect: () => setExpanded(open ? null : key),
                    },
                    ...(canSummary?.can
                      ? [{ key: "summary", label: "Xem trong Tổng hợp", icon: Sigma, onSelect: () => openSummary(i) }]
                      : []),
                  ];
                  return (
                    <Fragment key={key}>
                      <TableRow className={cn(open && "border-b-0 bg-surface-subtle")}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-expanded={open}
                            aria-label={open ? "Thu gọn diễn biến" : "Xem diễn biến"}
                            title={open ? "Thu gọn diễn biến" : "Xem diễn biến"}
                            onClick={() => setExpanded(open ? null : key)}
                          >
                            {open ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <TwoLineCell
                            className="max-w-[200px]"
                            primary={i.unit.name ?? "Đơn vị không còn trong danh mục"}
                            secondary={i.unit.block ? UNIT_GROUP_LABEL[i.unit.block] : ""}
                          />
                        </TableCell>
                        <TableCell>
                          <TwoLineCell
                            className="max-w-[190px]"
                            primary={i.template.shortName ? `Biểu ${i.template.shortName}` : "Biểu"}
                            secondary={[
                              i.template.name,
                              i.templateVersion.versionNo ? `Phiên bản ${i.templateVersion.versionNo}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          />
                        </TableCell>
                        <TableCell>
                          <TwoLineCell
                            primary={
                              <>
                                {i.delivery === "NEW_REPORT" ? "Phiếu mới của đợt" : "Thêm vào phiếu đang nhập"}
                                {i.derived && <span className="text-muted-foreground"> *</span>}
                              </>
                            }
                            secondary={
                              i.delivery === "NEW_REPORT"
                                ? `Phát ${formatDate(i.issuedAt)} ${hhmm(new Date(i.issuedAt))}`
                                : `Phiếu lập ở đợt ${i.reportPublicationNo}`
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                            {i.report.revisionNo > 1 && (
                              <span className="text-xs text-muted-foreground">
                                Phiên bản {i.report.revisionNo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge tone={completion.tone}>{completion.label}</StatusBadge>
                            <span className="text-xs text-muted-foreground">
                              {saved ? `Lưu ${formatDate(saved)} ${hhmm(saved)}` : "Chưa lưu số liệu"}
                            </span>
                          </div>
                        </TableCell>
                        {showLedger && (
                          <TableCell>
                            <LedgerCell item={i} />
                          </TableCell>
                        )}
                        <TableCell align="right" className={cn("sticky right-0", open ? "bg-surface-subtle" : "bg-card")}>
                          <div className="flex justify-end">
                            <RowActions items={menu} />
                          </div>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                          <TableCell colSpan={showLedger ? 8 : 7} className="px-6 pt-1 pb-4 whitespace-normal">
                            <ItemHistory item={i} openedBy={openedBy} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Phân trang */}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2.5">
              <span className="text-sm text-muted-foreground">
                Hiển thị {formatNumber(first)}–{formatNumber(last)} trong {formatNumber(rows.length)} dòng
              </span>
              {hasDerived && (
                <span className="text-xs text-muted-foreground">
                  Dấu * là dòng được suy ra từ thời điểm phát biểu, dữ liệu gốc không ghi rõ đợt.
                </span>
              )}
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
                <SelectTrigger size="sm" className="w-[112px]" aria-label="Số dòng mỗi trang">
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
        </section>
      </>
    );
  };

  const view = STATUS_VIEW[p.status];
  return (
    <AsxhPage
      title={`Đợt mở ${p.period.name} (${KIND_LABEL[p.kind].toLowerCase()})`}
      description={[
        `Mở lúc ${hhmm(opened)} ngày ${formatDate(opened)} bởi ${openedBy}`,
        range ? `Kỳ ${range}` : null,
        query.isSuccess
          ? `${formatNumber(units)} đơn vị · ${formatNumber(items.length)} biểu${
              added > 0 ? ` (${formatNumber(added)} biểu thêm vào phiếu đang nhập)` : ""
            }`
          : `${formatNumber(p.unitCount)} đơn vị · ${formatNumber(p.sheetCount)} biểu`,
      ]
        .filter(Boolean)
        .join(" · ")}
      backTo={LIST_PATH}
      badge={<StatusBadge tone={view.tone}>{view.label}</StatusBadge>}
    >
      {body()}
    </AsxhPage>
  );
}

/** Lần ghi nhận số liệu gần nhất; lần lỗi chỉ nêu khi nó mới hơn lần thành công. */
function LedgerCell({ item }: { item: ApiPublicationItem }) {
  const ledger = item.ledger;
  if (!ledger) return null;
  const ok = ledger.lastSuccess;
  const fail = ledger.lastFailure;
  if (fail && (!ok || new Date(fail.at).getTime() > new Date(ok.at).getTime())) {
    const at = new Date(fail.at);
    return (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge tone="destructive">Ghi nhận không thành công</StatusBadge>
        <span className="text-xs text-muted-foreground">
          {formatDate(at)} {hhmm(at)}
        </span>
      </div>
    );
  }
  if (ok) {
    const at = new Date(ok.at);
    return <TwoLineCell primary={`${formatDate(at)} ${hhmm(at)}`} secondary={ledgerCounts(ok)} />;
  }
  return <span className="text-sm text-muted-foreground">Chưa ghi nhận</span>;
}

/** Mã lỗi HTTP của một lỗi Refine (`HttpError.statusCode`). */
function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(code) ? code : undefined;
  }
  return undefined;
}
