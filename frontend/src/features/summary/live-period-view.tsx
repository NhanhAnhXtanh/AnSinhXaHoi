import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, FileSpreadsheet, GitCompare, RotateCw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  HeaderActions,
  LoadingState,
  StatusBadge,
  formatDateTime,
} from "@/shared/components/asxh";
import type { ActionItem, PrimaryAction } from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  exportWorkbooksToXlsx,
  type SpreadWorkbookApi,
} from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";

import {
  SUMMARY_URL,
  errorMessage,
  parseWorkbook,
  periodStatusMeta,
  useApiObject,
  type PeriodOverview,
  type PeriodSheet,
} from "./api";
import { borrowedNote, scopeQuery, scriptApiErrorText } from "./period-text";
import { ScopePicker } from "./scope-picker";
import { SheetBody, SheetEmpty, SheetError, SheetFrame } from "./sheet-frame";
import { summaryExportName } from "./utils";

const BLOCK_SCOPE_LABEL: Record<string, string> = {
  "khoi-tinh": "Khối tỉnh",
  "khoi-huyen": "Khối huyện",
  "khoi-xa": "Khối xã",
};

/**
 * Kỳ CHƯA lưu số liệu: bảng tổng hợp trực tiếp từ phiếu đã duyệt (UC-50), chọn
 * được phạm vi đơn vị (UC-51). Script `afterInject` của biểu đổ số vào ô
 * (`ctx.shared.rows`), công thức của mẫu tự cộng; bảng chỉ xem.
 */
export function LivePeriodView({
  overview,
  year,
  primary,
  emptyIcon,
}: {
  overview: PeriodOverview;
  year: number;
  primary?: PrimaryAction;
  emptyIcon: LucideIcon;
}) {
  const period = overview.period;
  // Biểu mở sẵn khi màn khác dẫn tới (`?bieu=`), không có trong kỳ thì về biểu đầu.
  const [params] = useSearchParams();
  const linkedSheet = params.get("bieu");
  const [sheetKey, setSheetKey] = useState(() =>
    overview.sheets.some((s) => String(s.templateId) === linkedSheet)
      ? String(linkedSheet)
      : String(overview.sheets[0]?.templateId ?? "")
  );
  const [scope, setScope] = useState("tinh");
  const apiRef = useRef<SpreadWorkbookApi | null>(null);
  const [exporting, setExporting] = useState(false);

  const sheet = overview.sheets.find((s) => String(s.templateId) === sheetKey) ?? overview.sheets[0];
  const notStarted = !["open", "overdue", "closed", "locked"].includes(period.status);
  const noData = period.approvedUnits === 0;
  const showData = Boolean(sheet) && !notStarted && !noData;

  const query = scopeQuery(scope);
  const sheetState = useApiObject<PeriodSheet>(
    showData && sheet ? `${SUMMARY_URL}/period_sheet` : null,
    showData && sheet ? { periodId: period.id, templateId: sheet.templateId, ...query } : undefined,
    "rows"
  );
  const data = sheetState.data;

  const workbook = useMemo(() => (data ? parseWorkbook(data.workbookJson) : null), [data]);
  const scopeLabel =
    scope === "tinh"
      ? "Toàn tỉnh Đồng Nai"
      : scope.startsWith("khoi-")
        ? (BLOCK_SCOPE_LABEL[scope] ?? "Toàn tỉnh")
        : (overview.units.find((u) => String(u.id) === scope)?.name ?? "Toàn tỉnh");

  // Bản sao: script được map / sửa ctx.shared.rows mà không đụng dữ liệu đã nạp.
  const scriptContext = useMemo(() => {
    if (!data) return undefined;
    const rows = data.rows.map((row) => ({ ...row }));
    return {
      mode: "summary",
      rows,
      summaryRows: data.rows.map((row) => ({ ...row })),
      periodId: String(period.id),
      periodName: period.name,
      sheetCode: data.sheetCode,
      scopeKind: query.scopeKind,
      // Script chỉ ghép `scopeKind` vào đường số liệu; ctx.api bổ sung đơn vị / khối từ đây.
      organizationId: query.organizationId,
      block: query.block,
      sourceSheet: "",
      a: year,
      b: year,
      year,
      unitName: scopeLabel,
      summaryDataUrl: data.summaryDataUrl,
    } satisfies Record<string, unknown>;
  }, [data, period.id, period.name, year, query.scopeKind, query.organizationId, query.block, scopeLabel]);

  const doExport = async () => {
    const api = apiRef.current;
    if (!api || !data) return;
    setExporting(true);
    try {
      const fileName = summaryExportName(data.shortName, period.name);
      await exportWorkbooksToXlsx(
        [{ sheetCode: data.shortName, sheetName: data.shortName, workbookJson: api.toJSON() }],
        fileName
      );
      toast.success(`Đã xuất Excel biểu ${data.shortName} · ${period.name}.`);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa xuất được tệp Excel. Bạn thử lại sau ít phút."));
    } finally {
      setExporting(false);
    }
  };

  const status = periodStatusMeta(period.status);
  const isOpen = period.status === "open" || period.status === "overdue";

  const menu: ActionItem[] = [
    {
      key: "export",
      label: exporting ? "Đang xuất Excel…" : "Xuất Excel",
      icon: Download,
      onSelect: () => void doExport(),
      disabled: !data || exporting,
      reason: !data ? "Chưa có số liệu để xuất." : undefined,
    },
    {
      key: "history",
      label: "Lịch sử và so sánh",
      icon: GitCompare,
      disabled: true,
      reason: "Kỳ này chưa lưu số liệu tổng hợp.",
    },
  ];

  let meta: ReactNode;
  if (notStarted) {
    meta = `Kỳ chưa mở đợt báo cáo nên chưa có số liệu · 0/${period.assignedUnits} đơn vị`;
  } else if (isOpen && noData) {
    meta = `Chưa có phiếu nào được duyệt nên chưa chốt đợt được · 0/${period.assignedUnits} đơn vị`;
  } else if (isOpen && period.approvedUnits < period.assignedUnits) {
    meta = (
      <span className="text-warning-text inline-flex items-center gap-1.5">
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
        Mới có {period.approvedUnits}/{period.assignedUnits} đơn vị được duyệt
        {period.submittedUnits > 0
          ? `, còn ${period.submittedUnits} phiếu chờ duyệt nên số liệu chưa đầy đủ`
          : " nên số liệu chưa đầy đủ"}
      </span>
    );
  } else {
    meta = `Số liệu của ${period.approvedUnits}/${period.assignedUnits} đơn vị đã được duyệt${
      period.lastApprovedAt ? ` · Cập nhật ${formatDateTime(period.lastApprovedAt)}` : ""
    }`;
  }
  if (data?.borrowedEarliest) {
    meta = (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{meta}</span>
        <span className="text-info-text truncate">{borrowedNote(period.name, data.versionNo)}</span>
      </span>
    );
  }

  const scopeDisabledReason = noData || notStarted ? "Chưa có đơn vị nào được duyệt." : undefined;

  const actions = (
    <>
      <ScopePicker
        value={scope}
        onChange={setScope}
        units={overview.units}
        disabled={Boolean(scopeDisabledReason)}
        disabledReason={scopeDisabledReason}
      />
      <HeaderActions primary={primary} items={menu} />
    </>
  );

  let body: ReactNode;
  if (overview.sheets.length === 0) {
    body = (
      <SheetEmpty
        icon={FileSpreadsheet}
        title="Kỳ này chưa được thiết lập biểu mẫu nào"
        description="Kỳ chưa có biểu nào nên chưa có gì để tổng hợp."
      />
    );
  } else if (notStarted || noData) {
    body = (
      <SheetEmpty
        icon={emptyIcon}
        title={notStarted ? "Kỳ này chưa mở đợt báo cáo" : "Chưa có phiếu nào được duyệt"}
        description="Số liệu tổng hợp sẽ hiện ở đây khi phiếu đầu tiên của kỳ này được duyệt."
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
  } else if (!data) {
    body = <LoadingState label="Đang tổng hợp số liệu…" hint="Kỳ có nhiều đơn vị nên có thể mất vài giây." />;
  } else {
    body = (
      <SheetBody>
        <SpreadWorkbook
          key={`${period.id}-${data.templateId}-${scope}`}
          workbook={workbook}
          readOnly
          hideTabs
          scriptText={data.scriptText}
          scriptContext={scriptContext}
          onReady={(api) => {
            apiRef.current = api;
          }}
          onScriptResult={(result) => {
            if (result.apiErrors && result.apiErrors.length > 0) {
              toast.error(scriptApiErrorText(data.shortName, result.apiErrors));
            } else if (!result.ok) {
              console.warn("Script tổng hợp báo lỗi:", result.messages);
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
    <SheetFrame
      title={period.name}
      badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      meta={meta}
      actions={actions}
      tabs={overview.sheets.map((s) => ({ key: String(s.templateId), label: s.shortName }))}
      tab={sheet ? String(sheet.templateId) : ""}
      onTabChange={setSheetKey}
    >
      {body}
    </SheetFrame>
  );
}
