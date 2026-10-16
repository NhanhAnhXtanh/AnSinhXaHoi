import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, FileSpreadsheet, History, RotateCw, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  HeaderActions,
  LoadingState,
  MasterDetailLayout,
  StatusBadge,
  WorkCard,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction, StatusTone } from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  exportWorkbooksToXlsx,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  SUMMARY_URL,
  errorMessage,
  parseWorkbook,
  useApiArray,
  useApiObject,
  type YearItem,
  type YearOverview,
  type YearSheet,
} from "./api";
import { SheetBody, SheetEmpty, SheetError, SheetFrame } from "./sheet-frame";
import { joinVi, summaryExportName } from "./utils";
import { SubmitBlockedDialog, YearHistoryDialog } from "./year-dialogs";

function yearStatus(item: { ledgerVersion: number; lockReason: string | null }): { label: string; tone: StatusTone } {
  if (item.lockReason) return { label: "Đã khoá", tone: "locked" };
  if (item.ledgerVersion > 0) return { label: "Đang soạn", tone: "info" };
  return { label: "Chưa lưu số liệu", tone: "outline" };
}

/**
 * Chế độ "Theo năm" (UC-52): danh sách năm bên trái, biểu tổng hợp năm (01 và
 * các phụ lục, phiên bản theo mốc 01/07) bên phải, chỉ xem. Năm đã có số liệu
 * tổng hợp lưu ở các kỳ thì script đọc số liệu đó ở phiên bản mới nhất; chưa có
 * thì tổng hợp trực tiếp theo năm dương lịch (T1–T6 và T7–T12).
 */
export function YearMode({ year, onYearChange }: { year: number; onYearChange: (y: number) => void }) {
  const yearsState = useApiArray<YearItem>(`${SUMMARY_URL}/years`, undefined);
  const years = yearsState.data ?? [];

  const list = (
    <section className="bg-card text-card-foreground flex h-full min-h-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <div className="flex items-center justify-between gap-2 border-b px-5 pt-5 pb-3.5">
        <h2 className="text-base leading-6 font-semibold">Năm báo cáo</h2>
        <span className="text-muted-foreground text-[13px] leading-5">{years.length} năm</span>
      </div>
      <div role="listbox" aria-label="Năm báo cáo" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {yearsState.isLoading && <LoadingState label="Đang tải…" />}
        {!yearsState.isLoading && years.length === 0 && (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có năm báo cáo nào"
            description="Hãy tạo lịch ở màn Lịch và kỳ báo cáo trước."
          />
        )}
        {years.map((item) => {
          const selected = item.year === year;
          const st = yearStatus(item);
          return (
            <button
              key={item.year}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onYearChange(item.year)}
              className={cn(
                "relative flex min-h-14 w-full shrink-0 items-center justify-between gap-2 rounded-md py-2 ps-3.5 pe-2.5 text-left",
                "transition-colors duration-150 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                selected ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              {selected && (
                <span aria-hidden className="bg-primary absolute top-1/2 left-0 h-7 w-0.75 -translate-y-1/2 rounded-sm" />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-foreground truncate text-sm leading-5 font-medium">Năm {item.year}</span>
                <span className="text-muted-foreground truncate text-xs leading-4">01/01 – 31/12/{item.year}</span>
              </span>
              <StatusBadge tone={st.tone} className="shrink-0">
                {st.label}
              </StatusBadge>
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <MasterDetailLayout aside={list}>
      <YearPanel key={year} year={year} />
    </MasterDetailLayout>
  );
}

function YearPanel({ year }: { year: number }) {
  const overviewState = useApiObject<YearOverview>(`${SUMMARY_URL}/year`, { year }, "sheets");
  const overview = overviewState.data;
  const [sheetKey, setSheetKey] = useState("");
  const [dialog, setDialog] = useState<"blocked" | "history" | null>(null);
  const [exporting, setExporting] = useState(false);
  const apiRef = useRef<SpreadWorkbookApi | null>(null);

  const sheets = useMemo(() => overview?.sheets ?? [], [overview]);
  const sheet = sheets.find((s) => String(s.templateId) === sheetKey) ?? sheets[0];
  useEffect(() => {
    apiRef.current = null;
  }, [sheetKey]);

  const sheetState = useApiObject<YearSheet>(
    sheet ? `${SUMMARY_URL}/year_sheet` : null,
    sheet ? { year, templateId: sheet.templateId } : undefined,
    "workbookJson"
  );
  const data = sheetState.data;
  const workbook = useMemo(() => (data ? parseWorkbook(data.workbookJson) : null), [data]);
  const scriptContext = useMemo(() => {
    if (!data) return undefined;
    return {
      mode: "summary",
      rows: data.rows.map((row) => ({ ...row })),
      summaryRows: data.rows.map((row) => ({ ...row })),
      periodId: "",
      sheetCode: data.sheetCode,
      scopeKind: "ALL",
      sourceSheet: "",
      a: data.a,
      b: data.b,
      year: data.year,
      unitName: "Toàn tỉnh Đồng Nai",
      periodName: `Năm ${data.year}`,
      summaryDataUrl: data.summaryDataUrl,
    } satisfies Record<string, unknown>;
  }, [data]);

  if (!overview) {
    return (
      <WorkCard title={`Báo cáo năm ${year}`}>
        {overviewState.error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Chưa tải được số liệu năm"
            description={errorMessage(overviewState.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
            action={
              <Button type="button" variant="outline" onClick={() => void overviewState.refetch()}>
                <RotateCw aria-hidden />
                Thử lại
              </Button>
            }
          />
        ) : (
          <LoadingState label="Đang tải số liệu năm…" />
        )}
      </WorkCard>
    );
  }

  const doExport = async () => {
    const api = apiRef.current;
    if (!api || !data) return;
    setExporting(true);
    try {
      const fileName = summaryExportName(data.shortName, `Nam ${year}`);
      await exportWorkbooksToXlsx(
        [{ sheetCode: data.shortName, sheetName: data.shortName, workbookJson: api.toJSON() }],
        fileName
      );
      toast.success(`Đã xuất Excel biểu ${data.shortName} · Năm ${year}.`);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa xuất được tệp Excel. Bạn thử lại sau ít phút."));
    } finally {
      setExporting(false);
    }
  };

  // ------------------------------------------------------------ nút nộp (báo cáo năm nối tiếp)
  const unfinished = overview.unfinishedSheets;
  let primary: PrimaryAction;
  if (unfinished.length > 0) {
    primary = { label: "Nộp báo cáo năm", icon: Send, onClick: () => setDialog("blocked") };
  } else if (overview.lockReason) {
    primary = { label: "Nộp báo cáo năm", icon: Send, disabled: true, reason: overview.lockReason };
  } else if (overview.savedPeriods === 0) {
    primary = {
      label: "Nộp báo cáo năm",
      icon: Send,
      disabled: true,
      reason: "Năm này chưa có kỳ nào lưu số liệu — chốt đợt báo cáo ở Theo kỳ trước khi nộp.",
    };
  } else {
    // TODO điều phối: agent BÁO CÁO NĂM nối nút này (UC-58) — SubmitYearDialog đã có sẵn ở submit-year-dialog.tsx.
    primary = {
      label: "Nộp báo cáo năm",
      icon: Send,
      disabled: true,
      reason: "Chức năng nộp báo cáo năm đang được hoàn thiện.",
    };
  }

  const items: ActionItem[] = [
    {
      key: "export",
      label: exporting ? "Đang xuất Excel…" : "Xuất Excel",
      icon: Download,
      onSelect: () => void doExport(),
      disabled: !data || exporting,
      reason: !data ? "Chưa có bảng để xuất." : undefined,
    },
    {
      key: "history",
      label: "Lịch sử số liệu năm",
      icon: History,
      onSelect: () => setDialog("history"),
    },
  ];

  const st = yearStatus(overview);
  let meta: ReactNode =
    overview.source === "DEPT"
      ? `Số liệu tổng hợp · Phiên bản ${overview.ledgerVersion} · ${overview.savedPeriods}/${overview.totalPeriods} kỳ đã lưu số liệu`
      : `Tổng hợp trực tiếp từ phiếu đã duyệt · Năm dương lịch ${year} (tháng 1–6 và tháng 7–12)`;
  if (overview.lockReason) meta = `${meta} · ${overview.lockReason}`;
  if (data?.borrowedEarliest) {
    meta = (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{meta}</span>
        <span className="text-info-text truncate">
          Năm {year} trước ngày áp dụng của mẫu — đang dùng phiên bản {data.versionNo} ban hành sớm nhất.
        </span>
      </span>
    );
  }

  let body: ReactNode;
  if (sheets.length === 0) {
    body = (
      <SheetEmpty
        icon={FileSpreadsheet}
        title={`Năm ${year} chưa có biểu tổng hợp năm nào được ban hành`}
        description="Biểu tổng hợp năm được ban hành ở màn Bộ biểu mẫu."
      />
    );
  } else if (sheetState.error) {
    body = (
      <SheetError
        message={errorMessage(sheetState.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
        action={
          <Button type="button" variant="outline" onClick={() => void sheetState.refetch()}>
            <RotateCw aria-hidden />
            Thử lại
          </Button>
        }
      />
    );
  } else if (!data || (sheet && data.templateId !== sheet.templateId)) {
    body = <LoadingState label="Đang tổng hợp số liệu năm…" hint="Năm có nhiều kỳ nên có thể mất vài giây." />;
  } else {
    body = (
      <SheetBody>
        <SpreadWorkbook
          key={`${year}-${data.templateId}-${data.ledgerVersion}`}
          workbook={workbook}
          readOnly
          hideTabs
          scriptText={data.scriptText}
          scriptContext={scriptContext}
          onReady={(api) => {
            apiRef.current = api;
          }}
          onScriptResult={(result) => {
            if (!result.ok) {
              console.warn("Script tổng hợp năm báo lỗi:", result.messages);
              toast.warning(
                `Một số ô của biểu ${data.shortName} chưa đổ được số liệu. Vui lòng báo người quản trị mẫu biểu kiểm tra.`
              );
            }
          }}
          className="h-full min-h-[360px] flex-1"
        />
      </SheetBody>
    );
  }

  return (
    <>
      <SheetFrame
        title={`Báo cáo năm ${year}`}
        badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
        meta={<span className="block truncate">{meta}</span>}
        actions={<HeaderActions primary={primary} items={items} />}
        tabs={sheets.map((s) => ({ key: String(s.templateId), label: s.shortName }))}
        tab={sheet ? String(sheet.templateId) : ""}
        onTabChange={setSheetKey}
      >
        {body}
      </SheetFrame>

      <SubmitBlockedDialog
        open={dialog === "blocked"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        title="Số liệu chưa hoàn tất"
        message={`Còn ${joinVi(unfinished)} đang sửa dở. Hoàn tất các biểu này ở Theo kỳ rồi bấm Nộp báo cáo năm.`}
      />
      <YearHistoryDialog open={dialog === "history"} onOpenChange={(o) => !o && setDialog(null)} year={year} />
    </>
  );
}
