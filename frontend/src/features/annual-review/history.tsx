import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useList, useOne } from "@refinedev/core";
import {
  Download,
  Eye,
  FileDown,
  FileSearch,
  FileText,
  FilterX,
  Inbox,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  HeaderActions,
  LoadingState,
  RowActions,
  StatusBadge,
  TwoLineCell,
  formatDate,
  formatDateTime,
} from "@/shared/components/asxh";
import { DetailList, DetailRow, EmptyValue } from "@/shared/components/views/record-detail";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import {
  ANNUAL_RESOURCE,
  STATUS,
  SUBMITTER_ORG,
  UBND_ORG,
  downloadAll,
  downloadAttachment,
  errorMessage,
  errorStatus,
  formatSize,
  listAttachments,
  type AnnualAttachment,
  type AnnualReportRecord,
} from "./api";
import {
  ListPanel,
  ListToolbar,
  Pager,
  matchSubmission,
  usePaging,
  type StatusFilter,
} from "./list-parts";

/**
 * Lịch sử nộp báo cáo năm (UC-67) — mọi lần Sở nộp (kể cả phiếu đã bị trả lại) và
 * quyết định của UBND. `?nam=2026` lọc sẵn một năm; `?phieu=<id>` mở trang chi
 * tiết một lần nộp.
 */
export function AnnualSubmissionHistory() {
  const [params, setParams] = useSearchParams();
  const detailRaw = params.get("phieu");
  const detailId = detailRaw && /^\d+$/.test(detailRaw) ? Number(detailRaw) : null;

  const openDetail = (id: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("phieu", String(id));
      return next;
    });

  if (detailRaw !== null) {
    return detailId === null ? <NotFound /> : <SubmissionDetail id={detailId} />;
  }
  return <HistoryList initialYear={Number(params.get("nam")) || null} onOpenDetail={openDetail} />;
}

function HistoryList({
  initialYear,
  onOpenDetail,
}: {
  initialYear: number | null;
  onOpenDetail: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState<number | null>(initialYear);

  const { result, query } = useList<AnnualReportRecord>({
    resource: ANNUAL_RESOURCE,
    pagination: { mode: "off" },
    errorNotification: false,
  });

  const sorted = useMemo(
    () => [...(result.data ?? [])].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [result.data]
  );
  const years = useMemo(
    () => Array.from(new Set(sorted.map((s) => s.year))).sort((a, b) => b - a),
    [sorted]
  );
  const rows = useMemo(
    () => sorted.filter((s) => matchSubmission(s, search, status, year)),
    [sorted, search, status, year]
  );
  const paging = usePaging(rows, `${search}|${status}|${year}`);
  const filtered = search.trim() !== "" || status !== "all" || year !== null;

  const doDownload = async (s: AnnualReportRecord) => {
    try {
      // Danh sách không mang file — đọc riêng khi người dùng bấm tải.
      const files = s.attachments ?? (await listAttachments(s.id));
      await downloadAll(files);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa tải được file phiếu nộp. Bạn thử lại sau ít phút."));
    }
  };

  let body: ReactNode;
  if (query.isLoading) {
    body = <LoadingState label="Đang tải lịch sử nộp…" />;
  } else if (query.isError) {
    body = (
      <div className="flex justify-center px-6 py-8">
        <div className="w-full max-w-md rounded-lg border border-dashed">
          <EmptyState
            icon={TriangleAlert}
            title="Chưa tải được lịch sử nộp"
            description={errorMessage(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
            action={
              <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                <RotateCw aria-hidden />
                Thử lại
              </Button>
            }
          />
        </div>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="flex justify-center px-6 py-8">
        <div className="w-full max-w-md rounded-lg border border-dashed">
          {filtered ? (
            <EmptyState
              icon={FilterX}
              title="Không có lần nộp nào khớp bộ lọc"
              description="Thử bỏ bớt điều kiện lọc."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setYear(null);
                  }}
                >
                  <FilterX aria-hidden />
                  Xoá lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Chưa có lần nộp nào"
              description="Khi Sở Tài chính nộp báo cáo năm lên UBND, mỗi lần nộp sẽ hiện ở đây."
            />
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phiếu</TableHead>
            <TableHead>Người nộp</TableHead>
            <TableHead>Ngày nộp</TableHead>
            <TableHead>Số văn bản</TableHead>
            <TableHead>Kết quả của UBND</TableHead>
            <TableHead align="right" className="sticky right-0">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paging.slice.map((s) => {
            const st = STATUS[s.status];
            return (
              <TableRow key={s.id} className="h-16">
                <TableCell>
                  <TwoLineCell
                    primary={`Năm ${s.year} · Phiếu ${s.revisionNo}`}
                    secondary={`Số liệu phiên bản ${s.ledgerVersion}`}
                  />
                </TableCell>
                <TableCell>
                  <TwoLineCell primary={s.submittedBy ?? "—"} secondary={SUBMITTER_ORG} />
                </TableCell>
                <TableCell>
                  <TwoLineCell
                    primary={formatDate(s.submittedAt)}
                    secondary={formatDateTime(s.submittedAt).slice(11)}
                  />
                </TableCell>
                <TableCell>
                  <TwoLineCell
                    primary={s.docNo}
                    secondary={
                      s.attachmentCount > 0 ? `${s.attachmentCount} file đính kèm` : "Không có file đính kèm"
                    }
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </TableCell>
                <TableCell align="right" className="bg-card sticky right-0">
                  <RowActions
                    primary={{
                      label: "Xem phiếu",
                      icon: Eye,
                      onClick: () => navigate(`/annual-review/${s.id}?from=history`),
                    }}
                    items={[
                      {
                        key: "detail",
                        label: "Chi tiết lần nộp",
                        icon: FileText,
                        onSelect: () => onOpenDetail(s.id),
                      },
                      {
                        key: "files",
                        label: "Tải phiếu nộp",
                        icon: FileDown,
                        disabled: s.attachmentCount === 0,
                        reason: s.attachmentCount === 0 ? "Lần nộp này không có file đính kèm." : undefined,
                        onSelect: () => void doDownload(s),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <AsxhPage
      title="Lịch sử nộp báo cáo năm"
      description="Các lần Sở nộp báo cáo năm lên UBND và quyết định của UBND. Mở phiếu để xem đúng số liệu đã nộp."
    >
      <ListPanel
        toolbar={
          <ListToolbar
            search={search}
            onSearch={setSearch}
            status={status}
            onStatus={setStatus}
            year={year}
            onYear={setYear}
            years={years}
            onRefresh={() => void query.refetch()}
            refreshing={query.isFetching}
          />
        }
        pager={
          <Pager
            page={paging.page}
            pages={paging.pages}
            size={paging.size}
            total={paging.total}
            setPage={paging.setPage}
            setSize={paging.setSize}
            unit="phiếu"
          />
        }
      >
        {body}
      </ListPanel>
    </AsxhPage>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card text-card-foreground flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Chi tiết một lần nộp: thông tin nộp · quyết định của UBND · file phiếu nộp. */
function SubmissionDetail({ id }: { id: number }) {
  const navigate = useNavigate();
  const { result: s, query } = useOne<AnnualReportRecord>({
    resource: ANNUAL_RESOURCE,
    id,
    errorNotification: false,
  });

  if (query.isError && errorStatus(query.error) === 404) {
    return <NotFound />;
  }
  if (query.isError) {
    return (
      <AsxhPage title="Chưa mở được lần nộp" backTo="/annual-review/history">
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa mở được lần nộp báo cáo năm"
          description={errorMessage(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RotateCw aria-hidden />
              Thử lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (!s || s.id !== id) {
    return <LoadingState variant="page" label="Đang mở lần nộp…" />;
  }

  const st = STATUS[s.status];
  const decided = s.status !== "submitted" && s.decidedAt;
  const files = s.attachments ?? [];
  const sheetNames = (s.sheets ?? []).map((x) => x.shortName);

  const description = [
    `Sở Tài chính nộp ${formatDateTime(s.submittedAt)}`,
    decided
      ? `UBND ${s.status === "approved" ? "duyệt" : s.reopened ? "mở lại" : "trả lại"} ${formatDateTime(s.decidedAt ?? "")}`
      : "Đang chờ UBND duyệt",
  ].join(" · ");

  const download = async (file: AnnualAttachment) => {
    try {
      await downloadAttachment(file);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa tải được file phiếu nộp. Bạn thử lại sau ít phút."));
    }
  };

  return (
    <AsxhPage
      title={`Phiếu ${s.revisionNo} · Năm ${s.year}`}
      badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
      description={description}
      backTo="/annual-review/history"
      actions={
        <HeaderActions
          primary={{
            label: "Xem phiếu",
            icon: Eye,
            onClick: () => navigate(`/annual-review/${s.id}?from=history`),
          }}
          items={[
            {
              key: "files",
              label: "Tải phiếu nộp",
              icon: FileDown,
              disabled: files.length === 0,
              reason: files.length === 0 ? "Lần nộp này không có file đính kèm." : undefined,
              onSelect: () => {
                void downloadAll(files).catch((error: unknown) =>
                  toast.error(errorMessage(error, "Chưa tải được file phiếu nộp. Bạn thử lại sau ít phút."))
                );
              },
            },
          ]}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Thông tin nộp">
          <DetailList>
            <DetailRow label="Số văn bản">{s.docNo}</DetailRow>
            <DetailRow label="Ngày văn bản">{formatDate(s.docDate)}</DetailRow>
            <DetailRow label="Nộp lúc">{formatDateTime(s.submittedAt)}</DetailRow>
            <DetailRow label="Người nộp">
              {s.submittedBy ?? "—"} · {SUBMITTER_ORG}
            </DetailRow>
            <DetailRow label="Số liệu đã nộp">Số liệu tổng hợp, phiên bản {s.ledgerVersion}</DetailRow>
            <DetailRow label="Số biểu">
              {sheetNames.length > 0 ? `${sheetNames.length} biểu: ${sheetNames.join(", ")}` : <EmptyValue />}
            </DetailRow>
          </DetailList>
        </Panel>
        <Panel title="Quyết định của UBND">
          <DetailList>
            <DetailRow label="Kết quả">
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            </DetailRow>
            <DetailRow label="Người quyết định">
              {decided ? `${s.decidedBy ?? ""} · ${UBND_ORG}` : <EmptyValue>Chưa có</EmptyValue>}
            </DetailRow>
            <DetailRow label="Quyết định lúc">
              {decided ? formatDateTime(s.decidedAt ?? "") : <EmptyValue>Chưa có</EmptyValue>}
            </DetailRow>
            {s.status === "returned" && (
              <DetailRow label={s.reopened ? "Lý do mở lại" : "Lý do trả lại"}>
                {s.returnReason ?? <EmptyValue />}
              </DetailRow>
            )}
          </DetailList>
        </Panel>
      </div>
      <Panel title="File phiếu nộp">
        {files.length === 0 ? (
          <p className="text-muted-foreground px-4 py-4 text-sm">Lần nộp này không có file đính kèm.</p>
        ) : (
          <ul className="divide-border divide-y">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 truncate">{f.fileName}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{formatSize(f.fileSize)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ms-auto"
                  onClick={() => void download(f)}
                >
                  <Download aria-hidden />
                  Tải về
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AsxhPage>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <AsxhPage title="Không tìm thấy lần nộp" backTo="/annual-review/history">
      <EmptyState
        variant="page"
        icon={FileSearch}
        title="Không tìm thấy lần nộp báo cáo năm"
        description="Lần nộp có thể không còn hoặc đường dẫn không đúng."
        action={
          <Button type="button" variant="outline" onClick={() => navigate("/annual-review/history")}>
            Về Lịch sử nộp báo cáo năm
          </Button>
        }
      />
    </AsxhPage>
  );
}
