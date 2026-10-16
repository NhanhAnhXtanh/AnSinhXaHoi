import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Eye, FileDown, FileSearch, FileText, FilterX, Inbox } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  HeaderActions,
  RowActions,
  StatusBadge,
  TwoLineCell,
  formatDate,
  formatDateTime,
  formatNumber,
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

import { STATUS, UBND_ORG, type AnnualSubmission } from "./fixtures";
import {
  ListPanel,
  ListToolbar,
  Pager,
  matchSubmission,
  usePaging,
  type StatusFilter,
} from "./list-parts";
import { PERIOD_SHEETS, YEAR_SHEET } from "./sheets";
import { useSubmissions } from "./store";

const SHEET_NAMES = [YEAR_SHEET, ...PERIOD_SHEETS].map((s) => s.short);

/**
 * Lịch sử nộp báo cáo năm — mọi lần Sở nộp (kể cả phiếu đã bị trả lại) và
 * quyết định của UBND. `?nam=2026` lọc sẵn một năm; `?phieu=<mã>` mở trang
 * chi tiết một lần nộp.
 */
export function AnnualSubmissionHistory() {
  const [params, setParams] = useSearchParams();
  const submissions = useSubmissions();
  const detailId = params.get("phieu");
  const detail = detailId ? submissions.find((s) => s.id === detailId) : undefined;

  const openDetail = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("phieu", id);
      return next;
    });

  if (detailId) {
    return detail ? <SubmissionDetail s={detail} /> : <NotFound />;
  }
  return (
    <HistoryList
      submissions={submissions}
      initialYear={Number(params.get("nam")) || null}
      onOpenDetail={openDetail}
    />
  );
}

function HistoryList({
  submissions,
  initialYear,
  onOpenDetail,
}: {
  submissions: AnnualSubmission[];
  initialYear: number | null;
  onOpenDetail: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState<number | null>(initialYear);

  const sorted = useMemo(
    () => [...submissions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [submissions]
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
        {rows.length === 0 ? (
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
        ) : (
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
                        secondary={`Số liệu phiên bản ${s.versionNo}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoLineCell primary={s.submittedBy} secondary={s.submitterOrg} />
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
                          s.files.length > 0 ? `${s.files.length} file đính kèm` : "Không có file đính kèm"
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
                            disabled: s.files.length === 0,
                            reason:
                              s.files.length === 0 ? "Lần nộp này không có file đính kèm." : undefined,
                            onSelect: () =>
                              toast.success(`Đang tải ${s.files.map((f) => f.name).join(", ")}.`),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
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
function SubmissionDetail({ s }: { s: AnnualSubmission }) {
  const navigate = useNavigate();
  const st = STATUS[s.status];
  const decided = s.status !== "cho-duyet" && s.decidedAt;

  const description = [
    `Sở Tài chính nộp ${formatDateTime(s.submittedAt)}`,
    decided
      ? `UBND ${s.status === "da-duyet" ? "duyệt" : s.reopened ? "mở lại" : "trả lại"} ${formatDateTime(s.decidedAt ?? "")}`
      : "Đang chờ UBND duyệt",
  ].join(" · ");

  const download = (name: string) => toast.success(`Đang tải ${name}.`);

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
              disabled: s.files.length === 0,
              reason: s.files.length === 0 ? "Lần nộp này không có file đính kèm." : undefined,
              onSelect: () => s.files.forEach((f) => download(f.name)),
            },
            {
              key: "export",
              label: "Xuất Excel",
              icon: Download,
              onSelect: () =>
                toast.success(`Đã xuất Excel báo cáo năm ${s.year} · Phiếu ${s.revisionNo}.`),
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
              {s.submittedBy} · {s.submitterOrg}
            </DetailRow>
            <DetailRow label="Số liệu đã nộp">Số liệu tổng hợp, phiên bản {s.versionNo}</DetailRow>
            <DetailRow label="Số biểu">
              {SHEET_NAMES.length} biểu: {SHEET_NAMES.join(", ")}
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
            {s.status === "tra-lai" && (
              <DetailRow label={s.reopened ? "Lý do mở lại" : "Lý do trả lại"}>
                {s.reason ?? <EmptyValue />}
              </DetailRow>
            )}
          </DetailList>
        </Panel>
      </div>
      <Panel title="File phiếu nộp">
        {s.files.length === 0 ? (
          <p className="text-muted-foreground px-4 py-4 text-sm">
            Lần nộp này không có file đính kèm.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {s.files.map((f) => (
              <li key={f.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatNumber(f.sizeKb)} KB
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ms-auto"
                  onClick={() => download(f.name)}
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
