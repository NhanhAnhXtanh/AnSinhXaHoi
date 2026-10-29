import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useCan, useCustomMutation } from "@refinedev/core";
import { CalendarClock, Inbox, Lock, RotateCw, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  MasterDetailLayout,
  PeriodList,
  WorkCard,
} from "@/shared/components/asxh";
import type { PeriodItem, PrimaryAction } from "@/shared/components/asxh";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { Button } from "@/shared/ui/button";

import {
  DEPT_REPORTS_URL,
  JSON_HEADERS,
  SUMMARY_URL,
  closePeriodUrl,
  errorMessage,
  periodKindOf,
  periodStatusMeta,
  useApiArray,
  useApiObject,
  type PeriodOverview,
  type SummaryPeriodItem,
} from "./api";
import { DeptPeriodView } from "./dept-period-view";
import { LivePeriodView } from "./live-period-view";
import { formatRange } from "./period-text";

/** Kỳ mặc định: kỳ gần nhất đã có phiếu được duyệt / đã lưu số liệu; không có thì kỳ gần nhất đã thiết lập. */
function defaultPeriodId(periods: SummaryPeriodItem[]): number | null {
  // Ngày theo giờ máy — `toISOString()` là ngày UTC, 0h–7h sáng ở Việt Nam còn là hôm qua.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const started = periods.filter((p) => p.fromDate <= today);
  const pick = (list: SummaryPeriodItem[]) => list[list.length - 1]?.id ?? null;
  return (
    pick(started.filter((p) => p.approvedUnits > 0 || p.deptReportId !== null)) ??
    pick(started.filter((p) => p.assignedUnits > 0)) ??
    pick(periods.filter((p) => p.assignedUnits > 0)) ??
    periods[0]?.id ??
    null
  );
}

/**
 * Chế độ "Theo kỳ" (UC-50): danh sách kỳ của năm bên trái, bảng tổng hợp của kỳ
 * đang chọn bên phải. Kỳ chưa lưu số liệu → tổng hợp trực tiếp từ phiếu đã duyệt
 * (chọn được phạm vi đơn vị); kỳ đã lưu → số liệu tổng hợp của Sở (sửa được, có
 * lịch sử và so sánh phiên bản).
 */
export function PeriodMode({ year }: { year: number }) {
  const periodsState = useApiArray<SummaryPeriodItem>(`${SUMMARY_URL}/periods`, { year });
  const periods = useMemo(() => periodsState.data ?? [], [periodsState.data]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Đổi kỳ dựng lại panel phải: số tổng hợp đang sửa chưa lưu sẽ mất — hỏi trước.
  const confirmDiscard = useConfirmDiscard();

  useEffect(() => {
    if (periodsState.data && (selectedId === null || !periodsState.data.some((p) => p.id === selectedId))) {
      setSelectedId(defaultPeriodId(periodsState.data));
    }
  }, [periodsState.data, selectedId]);

  const items = useMemo<PeriodItem[]>(
    () =>
      periods.map((p) => {
        const meta = periodStatusMeta(p.status);
        return {
          id: String(p.id),
          name: p.name,
          range: formatRange(p.fromDate, p.toDate),
          kind: periodKindOf(p.kind),
          tone: meta.tone,
          statusLabel: meta.label,
        };
      }),
    [periods]
  );

  const refreshList = useCallback(() => {
    void periodsState.refetch();
  }, [periodsState]);

  const empty = periodsState.isLoading ? (
    <LoadingState label="Đang tải kỳ báo cáo…" />
  ) : periodsState.error ? (
    <EmptyState
      icon={TriangleAlert}
      title="Chưa tải được kỳ báo cáo"
      description={errorMessage(periodsState.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
      action={
        <Button type="button" variant="outline" size="sm" onClick={refreshList}>
          <RotateCw aria-hidden />
          Thử lại
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={CalendarClock}
      title="Chưa có kỳ báo cáo nào"
      description="Hãy tạo lịch ở màn Lịch và kỳ báo cáo trước."
    />
  );

  const list = (
    <PeriodList
      periods={items}
      selectedId={selectedId === null ? null : String(selectedId)}
      onSelect={(id) => {
        const next = Number(id);
        if (next !== selectedId) confirmDiscard(() => setSelectedId(next));
      }}
      empty={empty}
    />
  );

  if (selectedId === null) {
    return (
      <MasterDetailLayout aside={list}>
        <WorkCard title={`Năm ${year}`}>
          {periodsState.isLoading ? (
            <LoadingState label="Đang tải số liệu tổng hợp…" />
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Chưa có kỳ báo cáo nào"
              description="Hãy tạo lịch ở màn Lịch và kỳ báo cáo trước."
            />
          )}
        </WorkCard>
      </MasterDetailLayout>
    );
  }

  return (
    <MasterDetailLayout aside={list}>
      <PeriodPanel key={selectedId} periodId={selectedId} year={year} onChanged={refreshList} />
    </MasterDetailLayout>
  );
}

/** Panel phải của một kỳ: nạp tổng quan rồi chọn chế độ sống / số liệu Sở. */
function PeriodPanel({ periodId, year, onChanged }: { periodId: number; year: number; onChanged: () => void }) {
  const overviewState = useApiObject<PeriodOverview>(`${SUMMARY_URL}/periods/${periodId}`, undefined, "period");
  const overview = overviewState.data;
  const { data: canCloseResult } = useCan({ resource: "publications", action: "create" });
  const canClose = canCloseResult?.can ?? false;
  const { mutateAsync: post } = useCustomMutation();
  const [dialog, setDialog] = useState<"close" | "save" | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await overviewState.refetch();
    onChanged();
  }, [overviewState, onChanged]);

  if (!overview) {
    return (
      <WorkCard title="Tổng hợp báo cáo">
        {overviewState.error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Chưa mở được kỳ báo cáo"
            description={errorMessage(overviewState.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
            action={
              <Button type="button" variant="outline" onClick={() => void overviewState.refetch()}>
                <RotateCw aria-hidden />
                Thử lại
              </Button>
            }
          />
        ) : (
          <LoadingState label="Đang tải số liệu tổng hợp…" />
        )}
      </WorkCard>
    );
  }

  const period = overview.period;

  // ------------------------------------------------------------ chốt đợt / lưu số liệu (UC-27, UC-54)
  const saveSummary = async () => {
    try {
      await post({
        url: DEPT_REPORTS_URL,
        method: "post",
        values: { periodId },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      toast.success(`Đã lưu số liệu tổng hợp ${period.name}.`);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa lưu được số liệu tổng hợp. Bạn thử lại sau ít phút."));
    }
  };

  const doClose = async () => {
    setBusy(true);
    try {
      await post({
        url: closePeriodUrl(periodId),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setDialog(null);
      // Máy chủ lưu số liệu tổng hợp ngay trong lần chốt đợt (BR-27.1).
      toast.success(`Đã chốt đợt báo cáo ${period.name} và lưu số liệu tổng hợp.`);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Chưa chốt được đợt báo cáo. Bạn thử lại sau ít phút."));
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    setBusy(true);
    try {
      setDialog(null);
      await saveSummary();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const isOpen = period.status === "open" || period.status === "overdue";
  const isClosed = period.status === "closed" || period.status === "locked";

  const dialogs: ReactNode = (
    <>
      <ConfirmDialog
        open={dialog === "close"}
        onOpenChange={(o) => !o && !busy && setDialog(null)}
        title={`Chốt đợt báo cáo ${period.name}?`}
        description={`Đơn vị sẽ không nhập thêm được số liệu cho kỳ này và kỳ không mở lại được.${
          period.submittedUnits > 0
            ? ` Còn ${period.submittedUnits} đơn vị đã nộp đang chờ duyệt — hãy duyệt hoặc trả lại hết trước khi chốt đợt.`
            : ""
        }${overview.canWrite ? " Số liệu tổng hợp của kỳ sẽ được lưu lại ngay sau khi chốt." : ""}`}
        confirmLabel={`Chốt đợt ${period.name}`}
        onConfirm={() => void doClose()}
      />
      <ConfirmDialog
        open={dialog === "save"}
        onOpenChange={(o) => !o && !busy && setDialog(null)}
        title="Lưu số liệu tổng hợp?"
        description={`Số tổng hợp hiện tại của mọi biểu trong ${period.name} sẽ được lưu lại. Sau đó bạn vẫn có thể sửa số ngay trên màn này. Mỗi kỳ chỉ lưu được một lần.`}
        confirmLabel="Lưu số liệu"
        onConfirm={() => void doSave()}
      />
    </>
  );

  if (overview.deptReportId !== null) {
    return (
      <>
        <DeptPeriodView
          key={overview.deptReportId}
          overview={overview}
          reportId={overview.deptReportId}
          onChanged={() => void refresh()}
        />
        {dialogs}
      </>
    );
  }

  // Nút chính khi kỳ chưa lưu số liệu: Chốt đợt (kỳ đang mở) → Lưu số liệu (kỳ đã chốt).
  let primary: PrimaryAction | undefined;
  if (isOpen && canClose) {
    primary = {
      label: "Chốt đợt",
      icon: Lock,
      onClick: () => setDialog("close"),
      loading: busy,
      disabled: period.approvedUnits === 0,
      reason: period.approvedUnits === 0 ? "Chưa có phiếu nào được duyệt nên chưa chốt đợt được." : undefined,
    };
  } else if (isClosed && overview.canWrite && !overview.yearLock) {
    primary = {
      label: "Lưu số liệu",
      icon: Save,
      onClick: () => setDialog("save"),
      loading: busy,
      disabled: overview.saveBlockReason !== null,
      reason: overview.saveBlockReason ?? undefined,
    };
  }

  return (
    <>
      <LivePeriodView overview={overview} year={year} primary={primary} emptyIcon={isOpen ? Inbox : CalendarClock} />
      {dialogs}
    </>
  );
}
