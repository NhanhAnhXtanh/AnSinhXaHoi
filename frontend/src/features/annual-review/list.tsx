import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useList } from "@refinedev/core";
import { CircleCheck, Eye, FilterX, History, Inbox, RotateCw, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";

import {
  AsxhPage,
  EmptyState,
  LoadingState,
  RowActions,
  StatusBadge,
  TwoLineCell,
  formatDate,
  formatDateTime,
} from "@/shared/components/asxh";
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
  errorMessage,
  latestPerYear,
  submitOrdinal,
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
 * Duyệt báo cáo năm — mỗi năm một dòng là phiếu Sở Tài chính nộp gần nhất.
 * Nút trên dòng: "Duyệt báo cáo" khi phiếu đang chờ, còn lại "Xem phiếu".
 * Danh sách nhỏ (mỗi năm vài lần nộp) nên tải hết một lần, lọc và phân trang tại chỗ.
 */
export function AnnualReviewList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState<number | null>(null);

  const { result, query } = useList<AnnualReportRecord>({
    resource: ANNUAL_RESOURCE,
    pagination: { mode: "off" },
    errorNotification: false,
  });

  const all = useMemo(() => latestPerYear(result.data ?? []), [result.data]);
  const rows = useMemo(
    () => all.filter((s) => matchSubmission(s, search, status, year)),
    [all, search, status, year]
  );
  const paging = usePaging(rows, `${search}|${status}|${year}`);
  const filtered = search.trim() !== "" || status !== "all" || year !== null;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setYear(null);
  };

  let body: ReactNode;
  if (query.isLoading) {
    body = <LoadingState label="Đang tải danh sách báo cáo năm…" />;
  } else if (query.isError) {
    body = (
      <div className="flex justify-center px-6 py-8">
        <div className="w-full max-w-md rounded-lg border border-dashed">
          <EmptyState
            icon={TriangleAlert}
            title="Chưa tải được danh sách"
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
              title="Không có phiếu nào khớp bộ lọc"
              description="Thử bỏ bớt điều kiện lọc."
              action={
                <Button type="button" variant="outline" onClick={clearFilters}>
                  <FilterX aria-hidden />
                  Xoá lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Chưa có báo cáo năm nào được nộp"
              description="Khi Sở Tài chính nộp báo cáo năm, phiếu sẽ hiện ở đây để bạn kiểm tra và duyệt."
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
            <TableHead>Năm báo cáo</TableHead>
            <TableHead>Người nộp</TableHead>
            <TableHead>Ngày nộp</TableHead>
            <TableHead>Số văn bản</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead align="right" className="sticky right-0">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paging.slice.map((s) => {
            const st = STATUS[s.status];
            const waiting = s.status === "submitted";
            return (
              <TableRow key={s.id} className="h-16">
                <TableCell>
                  <TwoLineCell
                    primary={`Năm ${s.year}`}
                    secondary={
                      s.revisionNo > 1
                        ? `Phiếu ${s.revisionNo} · ${submitOrdinal(s.revisionNo)}`
                        : `Phiếu ${s.revisionNo}`
                    }
                  />
                </TableCell>
                <TableCell>
                  <TwoLineCell primary={SUBMITTER_ORG} secondary={s.submittedBy ?? undefined} />
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
                <TableCell className="max-w-72">
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    {s.status === "returned" && s.decidedAt && (
                      <span
                        className="text-muted-foreground max-w-full truncate text-xs"
                        title={s.returnReason ?? undefined}
                      >
                        {s.reopened ? "Mở lại" : "Trả lại"} {formatDate(s.decidedAt)} · Lý do: {s.returnReason}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell align="right" className="bg-card sticky right-0 transition-colors [tr:hover>&]:bg-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-card))]">
                  <RowActions
                    primary={{
                      label: waiting ? "Duyệt báo cáo" : "Xem phiếu",
                      icon: waiting ? CircleCheck : Eye,
                      onClick: () => navigate(`/annual-review/${s.id}`),
                    }}
                    items={[
                      {
                        key: "history",
                        label: "Lịch sử phiếu",
                        icon: History,
                        onSelect: () => navigate(`/annual-review/history?nam=${s.year}`),
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
      title="Duyệt báo cáo năm"
      description="Mỗi năm Sở Tài chính nộp một phiếu báo cáo. Mở phiếu để kiểm tra, rồi phê duyệt hoặc trả lại."
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
            years={all.map((s) => s.year)}
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
