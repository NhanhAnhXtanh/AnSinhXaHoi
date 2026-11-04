import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarX, TriangleAlert } from "lucide-react";

import {
  EmptyState,
  LoadingState,
  StatusBadge,
  TwoLineCell,
  formatDate,
} from "@/shared/components/asxh";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import { DeadlinePicker } from "./deadline-picker";
import {
  KIND_LABELS,
  KIND_ORDER,
  PERIOD_STATUS_VIEW,
  deadlineLockReason,
  type PeriodKind,
  type PeriodRow,
} from "./model";

type TabValue = "all" | PeriodKind;

/**
 * Panel phải "Các kỳ sẽ tạo" (Figma 310:46295): tab theo loại kỳ, bảng kỳ có
 * ô hạn nộp sửa được từng kỳ và badge trạng thái. Thân bảng tự cuộn.
 */
export function PeriodPreviewPanel({
  periods,
  kinds,
  daysValid,
  loading,
  error,
  onDeadlineChange,
  readOnly = false,
  readOnlyReason = "Bạn chỉ có quyền xem lịch báo cáo.",
}: {
  periods: PeriodRow[];
  kinds: PeriodKind[];
  /** Hạn nộp (ngày) hợp lệ — không hợp lệ thì không vẽ xem trước (UC-06 3b). */
  daysValid: boolean;
  /** Đang tải kỳ đã lưu / khung xem trước lần đầu. */
  loading?: boolean;
  /** Câu báo lỗi khi không tải được; kèm nút thử lại nếu có. */
  error?: { message: string; action?: ReactNode } | null;
  onDeadlineChange: (slot: string, iso: string) => void;
  /** Người chỉ có quyền xem, hoặc lịch đã chốt: ô hạn nộp không sửa được. */
  readOnly?: boolean;
  /** Vì sao chỉ xem — hiện khi rê vào ô hạn nộp. */
  readOnlyReason?: string;
}) {
  const [tab, setTab] = useState<TabValue>("all");
  const shownKinds = KIND_ORDER.filter((k) => kinds.includes(k));
  const activeTab: TabValue = tab !== "all" && !kinds.includes(tab) ? "all" : tab;
  const rows = activeTab === "all" ? periods : periods.filter((p) => p.kind === activeTab);
  const ready = daysValid && kinds.length > 0 && !loading && !error;

  return (
    <section className="bg-card text-card-foreground border-border flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <header className="flex shrink-0 items-baseline gap-2 border-b border-border px-6 py-4">
        <h2 className="text-base leading-6 font-semibold">Các kỳ sẽ tạo</h2>
        {ready && (
          <span className="text-muted-foreground text-sm tabular-nums">{periods.length} kỳ</span>
        )}
      </header>

      {!daysValid ? (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa xem trước được các kỳ"
          description="Hạn nộp báo cáo phải từ 1 đến 365 ngày. Bạn sửa ô Hạn nộp báo cáo bên trái để xem các kỳ sẽ tạo."
        />
      ) : kinds.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="Chưa chọn loại kỳ nào"
          description="Chọn ít nhất một loại kỳ cần sinh ở bên trái để xem các kỳ sẽ tạo."
        />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa xem được các kỳ"
          description={error.message}
          action={error.action}
        />
      ) : loading ? (
        <LoadingState label="Đang tải các kỳ…" />
      ) : (
        <>
          <div className="shrink-0 px-6 pt-4 pb-3">
            <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabValue)}>
              <TabsList>
                <TabsTrigger value="all" className="px-3 tabular-nums">
                  Tất cả ({periods.length})
                </TabsTrigger>
                {shownKinds.map((k) => (
                  <TabsTrigger key={k} value={k} className="px-3 tabular-nums">
                    {KIND_LABELS[k]} ({periods.filter((p) => p.kind === k).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="ps-6">Kỳ báo cáo</TableHead>
                  <TableHead className="w-28">Loại kỳ</TableHead>
                  <TableHead className="w-44">Hạn nộp</TableHead>
                  <TableHead className="w-40 pe-6">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const view = PERIOD_STATUS_VIEW[p.status] ?? PERIOD_STATUS_VIEW.draft;
                  return (
                    <TableRow key={p.slot}>
                      <TableCell className="ps-6">
                        <TwoLineCell
                          primary={p.name}
                          secondary={`${formatDate(p.fromDate)} – ${formatDate(p.toDate)}`}
                        />
                      </TableCell>
                      <TableCell>{KIND_LABELS[p.kind]}</TableCell>
                      <TableCell>
                        <DeadlinePicker
                          value={p.deadline}
                          periodEnd={p.toDate}
                          periodName={p.name}
                          disabled={readOnly || !p.editable}
                          disabledReason={
                            readOnly ? readOnlyReason : deadlineLockReason(p.status)
                          }
                          onChange={(iso) => onDeadlineChange(p.slot, iso)}
                        />
                      </TableCell>
                      <TableCell className="pe-6">
                        <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <footer className="text-muted-foreground shrink-0 border-t border-border px-6 py-3 text-sm">
            {periods.length} kỳ{readOnly ? "" : " · Bấm vào ô ngày để sửa hạn nộp của từng kỳ."}
          </footer>
        </>
      )}
    </section>
  );
}
