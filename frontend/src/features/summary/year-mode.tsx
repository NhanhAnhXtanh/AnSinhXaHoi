import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCan } from "@refinedev/core";
import {
  Download,
  Eye,
  FileClock,
  FileSpreadsheet,
  History,
  RotateCw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  EmptyState,
  HeaderActions,
  LoadingState,
  StatusBadge,
  WorkCard,
  formatDate,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction, StatusTone } from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  exportWorkbooksToXlsx,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import { ASXH_FILL_HEIGHT, useAsxhFill } from "@/shared/components/asxh/asxh-page";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  SUMMARY_URL,
  errorMessage,
  parseWorkbook,
  useApiObject,
  type YearOverview,
  type YearSheet,
} from "./api";
import { SheetBody, SheetEmpty, SheetError, SheetFrame } from "./sheet-frame";
import {
  ANNUAL_YEAR_STATUS_URL,
  SubmitYearDialog,
  submitAnnualReport,
  type AnnualLatest,
  type AnnualYearStatus,
  type SubmitYearInput,
} from "./submit-year-dialog";
import { scriptApiErrorText } from "./period-text";
import { joinVi, summaryExportName } from "./utils";
import { SubmitBlockedDialog, YearHistoryDialog } from "./year-dialogs";

/** Nhãn của phiếu năm mới nhất — thay nhãn "Đã khoá" khi năm đã nộp UBND. */
function annualStatus(latest: AnnualLatest): { label: string; tone: StatusTone } {
  switch (latest.status) {
    case "submitted":
      return { label: "Chờ UBND duyệt", tone: "warning" };
    case "approved":
      return { label: "UBND đã duyệt", tone: "success" };
    default:
      return { label: "UBND trả lại", tone: "destructive" };
  }
}

function yearStatus(item: { ledgerVersion: number; lockReason: string | null }): { label: string; tone: StatusTone } {
  if (item.lockReason) return { label: "Đã khoá", tone: "locked" };
  if (item.ledgerVersion > 0) return { label: "Đang soạn", tone: "info" };
  return { label: "Chưa lưu số liệu", tone: "outline" };
}

/**
 * Chế độ "Theo năm" (UC-52): biểu tổng hợp năm (01 và các phụ lục, phiên bản theo mốc 01/07) của
 * NĂM ĐANG CHỌN ở ô năm đầu trang, rộng hết màn — không còn cột danh sách mọi năm (trùng ô năm;
 * trạng thái năm đã hiện ở đầu khung). Năm đã có số liệu tổng hợp lưu ở các kỳ thì script đọc số
 * liệu đó ở phiên bản mới nhất; chưa có thì tổng hợp trực tiếp theo năm dương lịch (T1–T6, T7–T12).
 */
export function YearMode({ year }: { year: number }) {
  const inFill = useAsxhFill();
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col [&>*]:min-h-0 [&>*:only-child]:flex-1",
        inFill ? "min-h-0 flex-1" : ASXH_FILL_HEIGHT
      )}
    >
      <YearPanel key={year} year={year} />
    </div>
  );
}

function YearPanel({ year }: { year: number }) {
  const navigate = useNavigate();
  const overviewState = useApiObject<YearOverview>(`${SUMMARY_URL}/year`, { year }, "sheets");
  const overview = overviewState.data;
  const [sheetKey, setSheetKey] = useState("");
  const [dialog, setDialog] = useState<"blocked" | "history" | "submit" | null>(null);

  // Báo cáo năm (UC-58..66): tình trạng nộp của năm — chỉ hỏi khi tài khoản xem được báo cáo năm.
  const { data: canReadAnnualData } = useCan({ resource: "annual_review", action: "list" });
  const { data: canSubmitAnnualData } = useCan({ resource: "annual_review", action: "create" });
  const canReadAnnual = canReadAnnualData?.can === true;
  const canSubmitAnnual = canSubmitAnnualData?.can === true;
  const annualState = useApiObject<AnnualYearStatus>(
    canReadAnnual ? ANNUAL_YEAR_STATUS_URL : null,
    canReadAnnual ? { year } : undefined,
    "year"
  );
  const annual = annualState.data;
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

  // ------------------------------------------------------------ một nút đổi vai (UC-59, UC-62, UC-66)
  // Chưa nộp → "Nộp báo cáo năm"; đang chờ / đã duyệt → "Xem phiếu"; bị trả lại → "Gửi lại báo cáo năm".
  const unfinished = overview.unfinishedSheets;
  const latest = annual?.latest ?? null;
  const active = latest !== null && latest.status !== "returned";
  const resubmit = latest !== null && latest.status === "returned";
  const verb = resubmit ? "Gửi lại báo cáo năm" : "Nộp báo cáo năm";
  const openLatest = () => {
    if (latest) navigate(`/annual-review/${latest.id}?from=summary`);
  };

  const doSubmit = async (input: SubmitYearInput): Promise<string | null> => {
    try {
      const report = await submitAnnualReport(year, input);
      toast.success(`Đã ${resubmit ? "gửi lại" : "nộp"} Phiếu ${report.revisionNo} báo cáo năm ${year} lên UBND.`);
      await Promise.all([overviewState.refetch(), annualState.refetch()]);
      return null;
    } catch (error) {
      return errorMessage(error, "Chưa nộp được báo cáo năm. Bạn thử lại sau ít phút.");
    }
  };

  let primary: PrimaryAction;
  if (active) {
    primary = { label: "Xem phiếu", icon: Eye, onClick: openLatest };
  } else if (unfinished.length > 0) {
    primary = { label: verb, icon: Send, onClick: () => setDialog("blocked") };
  } else if (overview.lockReason) {
    primary = { label: verb, icon: Send, disabled: true, reason: overview.lockReason };
  } else if (overview.savedPeriods === 0) {
    primary = {
      label: verb,
      icon: Send,
      disabled: true,
      reason: "Năm này chưa có kỳ nào lưu số liệu — chốt đợt báo cáo ở Theo kỳ trước khi nộp.",
    };
  } else if (!canSubmitAnnual) {
    primary = {
      label: verb,
      icon: Send,
      disabled: true,
      reason: "Tài khoản của bạn chưa được cấp quyền nộp báo cáo năm.",
    };
  } else if (!annual) {
    primary = {
      label: verb,
      icon: Send,
      disabled: true,
      loading: annualState.isLoading,
      reason: annualState.error
        ? errorMessage(annualState.error, "Chưa kiểm tra được số liệu năm. Bạn tải lại trang sau ít phút.")
        : "Đang kiểm tra số liệu năm…",
    };
  } else if (annual.blocker) {
    primary = { label: verb, icon: Send, disabled: true, reason: annual.blocker };
  } else {
    primary = { label: verb, icon: Send, onClick: () => setDialog("submit") };
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
    ...(resubmit && latest
      ? [
          {
            key: "latest",
            label: `Xem Phiếu ${latest.revisionNo} đã bị trả lại`,
            icon: Eye,
            onSelect: openLatest,
          } satisfies ActionItem,
        ]
      : []),
    ...(canReadAnnual
      ? [
          {
            key: "submissions",
            label: "Lịch sử nộp báo cáo năm",
            icon: FileClock,
            onSelect: () => navigate(`/annual-review/history?nam=${year}`),
          } satisfies ActionItem,
        ]
      : []),
  ];

  const st = latest ? annualStatus(latest) : yearStatus(overview);
  let meta: ReactNode =
    overview.source === "DEPT"
      ? `Số liệu tổng hợp · Phiên bản ${overview.ledgerVersion} · ${overview.savedPeriods}/${overview.totalPeriods} kỳ đã lưu số liệu`
      : `Tổng hợp trực tiếp từ phiếu đã duyệt · Năm dương lịch ${year} (tháng 1–6 và tháng 7–12)`;
  if (overview.lockReason) meta = `${meta} · ${overview.lockReason}`;
  if (resubmit && latest) {
    meta = `${meta} · UBND ${latest.reopened ? "mở lại" : "trả lại"} ${formatDate(latest.decidedAt ?? "")} · Lý do: ${latest.returnReason ?? "—"}`;
  }
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
          // Biểu tổng hợp năm (01-TongHop) gồm nhiều trang 1a, 1b, 1c… — phải thấy thanh trang để chuyển.
          scriptText={data.scriptText}
          scriptContext={scriptContext}
          onReady={(api) => {
            apiRef.current = api;
          }}
          onScriptResult={(result) => {
            if (result.apiErrors && result.apiErrors.length > 0) {
              toast.error(scriptApiErrorText(data.shortName, result.apiErrors));
            } else if (!result.ok) {
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
        // Năm thường chỉ có biểu 01-TongHop — các trang 1a, 1b… nằm ở thanh trang của bảng.
        hideSingleTab
        tab={sheet ? String(sheet.templateId) : ""}
        onTabChange={setSheetKey}
      >
        {body}
      </SheetFrame>

      <SubmitBlockedDialog
        open={dialog === "blocked"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        title="Còn số liệu chưa Lưu"
        message={`Còn ${joinVi(unfinished)} đang sửa dở, chưa Lưu. Lưu hoặc bỏ các số đang sửa ở Theo kỳ rồi bấm Nộp báo cáo năm.`}
      />
      <YearHistoryDialog open={dialog === "history"} onOpenChange={(o) => !o && setDialog(null)} year={year} />
      <SubmitYearDialog
        open={dialog === "submit"}
        onOpenChange={(o) => !o && setDialog(null)}
        year={year}
        resubmit={resubmit}
        warnings={annual?.warnings ?? []}
        onSubmit={doSubmit}
      />
    </>
  );
}
