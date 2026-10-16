import { useMemo, useState } from "react";
import { CircleCheck, Download, Eye, FilterX, History, Inbox } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
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

import { STATUS } from "./fixtures";
import {
  ListPanel,
  ListToolbar,
  Pager,
  matchSubmission,
  submitOrdinal,
  usePaging,
  type StatusFilter,
} from "./list-parts";
import { latestPerYear, useSubmissions } from "./store";

/**
 * Duyệt báo cáo năm — mỗi năm một dòng là phiếu Sở Tài chính nộp gần nhất.
 * Nút trên dòng: "Duyệt báo cáo" khi phiếu đang chờ, còn lại "Xem phiếu".
 */
export function AnnualReviewList() {
  const navigate = useNavigate();
  const submissions = useSubmissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState<number | null>(null);

  const all = useMemo(() => latestPerYear(submissions), [submissions]);
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
        ) : (
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
                const waiting = s.status === "cho-duyet";
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
                      <TwoLineCell primary={s.submitterOrg} secondary={s.submittedBy} />
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
                    <TableCell className="max-w-72">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        {s.status === "tra-lai" && s.decidedAt && (
                          <span
                            className="text-muted-foreground max-w-full truncate text-xs"
                            title={s.reason}
                          >
                            {s.reopened ? "Mở lại" : "Trả lại"} {formatDate(s.decidedAt)} · Lý do:{" "}
                            {s.reason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="right" className="bg-card sticky right-0">
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
                          {
                            key: "export",
                            label: "Xuất Excel",
                            icon: Download,
                            onSelect: () =>
                              toast.success(`Đã xuất Excel báo cáo năm ${s.year} · Phiếu ${s.revisionNo}.`),
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
