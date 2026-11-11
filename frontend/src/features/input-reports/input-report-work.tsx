import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useCustom,
  useCustomMutation,
  useDataProvider,
  useInvalidate,
  useList,
  useOne,
  useUpdate,
  useWarnAboutChange,
  type HttpError,
} from "@refinedev/core";
import {
  CircleOff,
  Download,
  Maximize,
  Minimize,
  Pencil,
  RotateCcwClock,
  Save,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  SheetTabs,
  StatusBadge,
  WorkCard,
  type ActionItem,
  type PrimaryAction,
} from "@/shared/components/asxh";
import {
  SpreadWorkbook,
  runClientScript,
  type SpreadWorkbookApi,
  type WorkbookJson,
} from "@/shared/components/spreadsheet";
import { customResult } from "@/shared/hooks/use-custom-result";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  JSON_HEADERS,
  REPORTS_RESOURCE,
  dataUnitsUrl,
  SHEETS_RESOURCE,
  errorMessage,
  errorStatus,
  parseWorkbook,
  reportActionUrl,
  sheetActionUrl,
  type InputReportRecord,
  type InputReportSheetRecord,
  type ReportDataUnits,
} from "./api";
import { useExportReport } from "./export-report";
import { STATUS_META, displayStatus, firstSheetToOpen, isEditable, isSheetDone } from "./model";
import { LIST_PATH, readOnlyReason, statusLine, workPath } from "./report-text";
import { RevisionHistoryDialog } from "./revision-history-dialog";
import { SheetValidator, type ValidationJob } from "./sheet-validator";
import { TreasurySubmitDialog } from "./treasury-submit-dialog";
import { CheckErrorsDialog, SubmitConfirmDialog, type SheetIssue } from "./work-dialogs";

/** Đủ rộng cho mọi biểu của một phiếu (bộ mẫu thật ≈10 biểu). */
const MAX_SHEETS = 200;

/**
 * Màn nhập số liệu một phiếu (UC-34..38, 43..45; Figma 310:31610 và các khung
 * trạng thái 310:44251 · 47614 · 48786 · 50333 · 53871 · 56441 · 58133).
 * Thao tác theo nguyên tắc §4 Ví dụ 3. Không có đường dẫn trang — theo Figma,
 * nút mũi tên ở đầu thẻ đưa về danh sách.
 */
export function InputReportWork() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const numericId = id && /^\d+$/.test(id) ? Number(id) : null;

  const { result: report, query } = useOne<InputReportRecord>({
    resource: REPORTS_RESOURCE,
    id: numericId ?? 0,
    queryOptions: { enabled: numericId !== null },
    errorNotification: false,
  });

  const notFound = numericId === null || (query.isError && errorStatus(query.error) === 404);

  if (notFound) {
    return (
      <AsxhPage title="Không tìm thấy phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={SearchX}
          title="Không tìm thấy phiếu"
          description="Phiếu có thể đã được Sở thu hồi cùng kỳ báo cáo, hoặc đường dẫn không đúng. Bạn quay lại danh sách để chọn phiếu khác."
          action={
            <Button type="button" onClick={() => navigate(LIST_PATH)}>
              Về danh sách phiếu
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (query.isError) {
    return (
      <AsxhPage title="Chưa mở được phiếu" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa mở được phiếu"
          description={errorMessage(query.error, "Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây.")}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }
  if (!report) {
    return <LoadingState variant="page" label="Đang mở phiếu…" />;
  }
  // key: đổi phiếu (kể cả sang phiên bản khác) thì dựng lại toàn bộ trạng thái màn.
  return <WorkScreen key={report.id} report={report} />;
}

/** Bảng tính đang hiện: biểu nào, nạp từ JSON nào, có đóng dấu khoá ô của khung mẫu không. */
/**
 * `corrupt`: biểu CÓ số liệu đã lưu nhưng không đọc được. Không được lặng lẽ mở khung mẫu trống —
 * người dùng tưởng mất số, bấm Lưu là ghi đè số cũ; màn báo lỗi và khoá các nút ghi.
 */
type Pane = { sheetId: number; workbook: WorkbookJson | null; stampLocks: boolean; corrupt?: boolean };

type Busy = "save" | "complete" | "no-data" | "reopen" | "validate" | "submit" | null;

function WorkScreen({ report }: { report: InputReportRecord }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const dataProvider = useDataProvider();
  const { setWarnWhen } = useWarnAboutChange();
  const { exportReport, exporting } = useExportReport();
  const { mutateAsync: updateSheet } = useUpdate<
    InputReportSheetRecord,
    HttpError,
    { dataJson: string; version: number | null }
  >();
  const { mutateAsync: postAction } = useCustomMutation<InputReportRecord>();
  const { mutateAsync: postSheetAction } = useCustomMutation<InputReportSheetRecord>();

  // ------------------------------------------------------------ dữ liệu

  const { result: sheetsResult, query: sheetsQuery } = useList<InputReportSheetRecord>({
    resource: SHEETS_RESOURCE,
    pagination: { currentPage: 1, pageSize: MAX_SHEETS, mode: "server" },
    filters: [{ field: "report.id", operator: "eq", value: report.id }],
    errorNotification: false,
  });
  const sheets = sheetsResult.data;

  // Biểu nhập hộ (1g, UC-46): phiếu mang số liệu của những đơn vị nào — đọc từ số đã lưu.
  const { result: dataUnitsResult, query: dataUnitsQuery } = useCustom<ReportDataUnits>({
    url: dataUnitsUrl(report.id),
    method: "get",
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const onBehalfSheets = customResult(dataUnitsResult?.data, "sheets")?.sheets ?? [];
  const onBehalfText = onBehalfSheets
    .map((s) => {
      const names = s.units.map((u) => (u.known ? (u.name ?? u.budgetCode) : `mã ${u.budgetCode}`));
      const shown = names.slice(0, 3).join(", ");
      const rest = names.length > 3 ? ` và ${names.length - 3} đơn vị khác` : "";
      return `Biểu ${s.templateShortName} nhập hộ cho ${s.units.length} đơn vị: ${shown}${rest}`;
    })
    .join(". ");

  const [sheetId, setSheetId] = useState<number | undefined>(undefined);
  if (sheetId === undefined && sheets.length > 0) {
    setSheetId(firstSheetToOpen(report, sheets));
  }
  const sheet = sheets.find((s) => s.id === sheetId);

  const { result: content, query: contentQuery } = useOne<InputReportSheetRecord>({
    resource: SHEETS_RESOURCE,
    id: sheetId ?? 0,
    queryOptions: { enabled: sheetId !== undefined },
    errorNotification: false,
  });

  // Số trên màn còn chưa lưu: bản nháp của các biểu đã rời tab, bản vừa lưu, số hiệu bản lưu.
  const drafts = useRef(new Map<number, WorkbookJson>());
  const saved = useRef(new Map<number, WorkbookJson>());
  const versions = useRef(new Map<number, number>());
  const apiRef = useRef<SpreadWorkbookApi | null>(null);
  /**
   * Chế độ (nhập / chỉ xem) của workbook mà `apiRef` đang trỏ tới. Đổi chế độ — vd. vừa
   * "Kiểm tra & hoàn tất" — thì SpreadWorkbook huỷ workbook cũ và dựng lại; trong lúc chờ
   * `onReady` của bản mới, `apiRef` vẫn trỏ bản đã huỷ và gọi vào là lỗi "Bảng tính đã đóng".
   */
  const apiEditableRef = useRef<boolean | null>(null);
  /** Đếm lần sửa trên bảng tính — số gõ thêm trong lúc đang lưu không bị coi là đã lưu. */
  const editSeq = useRef(0);

  const [dirty, setDirty] = useState<ReadonlySet<number>>(new Set());
  const [pane, setPane] = useState<Pane | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [noDataOpen, setNoDataOpen] = useState(false);
  const [issues, setIssues] = useState<{ purpose: "complete" | "submit"; list: SheetIssue[] } | null>(null);
  const [validationJobs, setValidationJobs] = useState<ValidationJob[] | null>(null);
  const pendingIssues = useRef<SheetIssue[]>([]);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const anyDialogOpen =
    historyOpen || noDataOpen || issues !== null || treasuryOpen || confirmOpen;

  // Số hiệu bản lưu chỉ tăng — lấy số lớn nhất từng thấy (bản đọc trong bộ đệm có thể cũ hơn bản vừa lưu).
  if (content && sheetId !== undefined && content.id === sheetId) {
    const known = versions.current.get(content.id);
    if (known === undefined || content.version > known) versions.current.set(content.id, content.version);
  }

  // Mở biểu: ưu tiên bản nháp chưa lưu → bản vừa lưu ở màn này → số liệu đã lưu → khung mẫu.
  if (content && content.id === sheetId && pane?.sheetId !== sheetId) {
    const draft = drafts.current.get(sheetId) ?? saved.current.get(sheetId);
    const data = draft ?? parseWorkbook(content.dataJson);
    const corrupt = data === null && (content.dataJson ?? "").trim() !== "";
    if (corrupt) {
      console.error(`Số liệu đã lưu của biểu (sheet ${sheetId}) không đọc được.`);
      setPane({ sheetId, workbook: null, stampLocks: false, corrupt: true });
    } else {
      setPane({
        sheetId,
        workbook: data ?? parseWorkbook(content.templateWorkbookJson),
        stampLocks: data === null,
      });
    }
  }

  // ------------------------------------------------------------ trạng thái màn

  const status = displayStatus(report);
  const editable = isEditable(report);
  const sheetDone = sheet ? isSheetDone(sheet.completion) : false;
  const sheetEditable = editable && sheet !== undefined && !sheetDone;
  const done = sheets.filter((s) => isSheetDone(s.completion)).length;
  const remaining = sheets.filter((s) => !isSheetDone(s.completion));
  const isDirty = sheetId !== undefined && dirty.has(sheetId);
  const scriptText = content?.id === sheetId ? (content?.scriptText ?? "") : "";
  const paneReady = pane !== null && pane.sheetId === sheetId && !pane.corrupt;
  const paneCorrupt = pane !== null && pane.sheetId === sheetId && pane.corrupt === true;

  const scriptContext = useMemo(
    () => ({
      unitName: report.unit.name,
      periodName: report.period.name,
      year: report.period.year ?? Number(report.period.fromDate.slice(0, 4)),
      report: {
        reportId: String(report.id),
        sheetCode: sheet?.template.shortName ?? "",
        status: report.status,
        organizationCode: report.unit.budgetCode,
      },
    }),
    [report, sheet?.template.shortName]
  );

  // Rời màn khi còn số chưa lưu: hộp hỏi chung của ứng dụng (UnsavedChangesGuard).
  useEffect(() => {
    setWarnWhen(dirty.size > 0);
  }, [dirty, setWarnWhen]);
  useEffect(() => () => setWarnWhen(false), [setWarnWhen]);

  const markDirty = useCallback((id: number, on: boolean) => {
    setDirty((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const refreshAfterChange = useCallback(
    () =>
      Promise.all([
        invalidate({ resource: SHEETS_RESOURCE, invalidates: ["list"] }),
        invalidate({ resource: REPORTS_RESOURCE, invalidates: ["detail", "list"], id: report.id }),
      ]),
    [invalidate, report.id]
  );

  /** Giữ đúng số đang thấy trên màn khi bảng tính sắp nạp lại vì đổi chế độ sửa / chỉ xem. */
  const freezePane = () => {
    const api = apiRef.current;
    if (!api || sheetId === undefined) return;
    const json = api.toJSON();
    saved.current.set(sheetId, json);
    setPane({ sheetId, workbook: json, stampLocks: false });
  };

  // ------------------------------------------------------------ thao tác

  const selectSheet = (next: string) => {
    const nextId = Number(next);
    if (nextId === sheetId) return;
    // Số đang gõ dở ở tab cũ được giữ trong bộ nhớ (UC-34 bước 2).
    if (sheetId !== undefined && dirty.has(sheetId) && apiRef.current) {
      drafts.current.set(sheetId, apiRef.current.toJSON());
    }
    apiRef.current = null;
    setSheetId(nextId);
  };

  /** Lưu dữ liệu (nút viền + Ctrl+S): chỉ lưu bản nháp của biểu, không đổi trạng thái (UC-34). */
  const save = async (quiet = false): Promise<boolean> => {
    const api = apiRef.current;
    if (!api || !sheetEditable || sheetId === undefined || !sheet) return false;
    const seq = editSeq.current;
    const json = api.toJSON();
    setBusy("save");
    try {
      const { data } = await updateSheet({
        resource: SHEETS_RESOURCE,
        id: sheetId,
        values: { dataJson: JSON.stringify(json), version: versions.current.get(sheetId) ?? null },
        meta: { method: "put" },
        mutationMode: "pessimistic",
        invalidates: ["list"],
        successNotification: false,
        errorNotification: false,
      });
      versions.current.set(sheetId, Math.max(data.version, versions.current.get(sheetId) ?? 0));
      saved.current.set(sheetId, json);
      drafts.current.delete(sheetId);
      // Gõ thêm trong lúc chờ máy chủ: phần đó chưa có trong bản vừa lưu → giữ cờ "chưa lưu".
      if (editSeq.current === seq) markDirty(sheetId, false);
      if (!quiet) toast.success(`Đã lưu số liệu biểu ${sheet.template.shortName}.`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Chưa lưu được số liệu. Bạn thử lại sau ít phút."));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const runSheetAction = async (action: "complete" | "no_data" | "reopen"): Promise<boolean> => {
    if (sheetId === undefined) return false;
    try {
      const { data } = await postSheetAction({
        url: sheetActionUrl(sheetId, action),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      // Đổi đánh dấu cũng tăng số hiệu bản lưu ở máy chủ (@Version) — không cập nhật thì lần
      // "Lưu dữ liệu" sau "Sửa lại" bị từ chối là "đã lưu ở phiên làm việc khác".
      if (data && typeof data.version === "number" && data.id === sheetId) {
        versions.current.set(sheetId, Math.max(data.version, versions.current.get(sheetId) ?? 0));
      }
      await refreshAfterChange();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Chưa đổi được đánh dấu của biểu. Bạn thử lại sau ít phút."));
      await refreshAfterChange();
      return false;
    }
  };

  /**
   * Kiểm tra & hoàn tất biểu đang mở (UC-35): chạy bước kiểm tra của mẫu ngay
   * trên trình duyệt, lưu, rồi đánh dấu xong. Không tự nộp — kể cả phiếu bị trả lại:
   * xong hết các biểu thì người dùng bấm Nộp lại phiếu riêng.
   */
  const complete = async () => {
    const api = apiRef.current;
    if (!api || !sheet || busy) return;
    const code = sheet.template.shortName;
    setBusy("complete");
    try {
      const check = await runClientScript(api, scriptText, "validate", scriptContext);
      if (!check.ok) {
        // Tô đỏ những ô kiểm tra chỉ ra để người dùng sửa ngay tại chỗ; số đã nhập giữ nguyên.
        api.markInvalidCells(check.cells ?? []);
        setIssues({ purpose: "complete", list: check.messages.map((message) => ({ sheet: code, message })) });
        return;
      }
      api.clearInvalidCells();
      // Bản lưu rỗng (workbook không có sheet) coi như chưa lưu: lưu khung đang thấy trên màn.
      const hasData = parseWorkbook(content?.dataJson) !== null || saved.current.has(sheet.id);
      if ((isDirty || !hasData) && !(await save(true))) return;
      freezePane();
      if (!(await runSheetAction("complete"))) return;

      const left = remaining.filter((s) => s.id !== sheet.id);
      const submitLabel = report.status === "RETURNED" ? "Nộp lại phiếu" : "Nộp phiếu";
      toast.success(
        left.length === 0
          ? `Biểu ${code} đã nhập xong (chỉ xem). Mọi biểu đã xong, bạn bấm ${submitLabel} để gửi Sở.`
          : `Biểu ${code} đã nhập xong (chỉ xem).`
      );
    } finally {
      setBusy((b) => (b === "complete" ? null : b));
    }
  };

  /** Không phát sinh số liệu (UC-36): không kiểm tra; số đã gõ dở được lưu lại rồi giữ nguyên. */
  const markNoData = async () => {
    if (!sheet || busy) return;
    const code = sheet.template.shortName;
    setNoDataOpen(false);
    setBusy("no-data");
    try {
      if (isDirty && !(await save(true))) return;
      freezePane();
      if (await runSheetAction("no_data")) {
        toast.success(`Đã ghi nhận: kỳ này biểu ${code} không phát sinh số liệu.`);
      }
    } finally {
      setBusy((b) => (b === "no-data" ? null : b));
    }
  };

  /** Sửa lại (UC-37): bỏ đánh dấu để nhập tiếp. */
  const reopen = async () => {
    if (!sheet || busy) return;
    setBusy("reopen");
    try {
      // KHÔNG freezePane ở đây: bảng đang chỉ xem đã khoá MỌI ô và gỡ nút ＋/✕ trong ô —
      // chụp lại rồi nạp vào chế độ sửa thì không gõ được ô nào. Số liệu không đổi khi chỉ
      // xem, nên nạp lại từ đúng bản đang dùng (`pane.workbook`, chụp lúc còn sửa được).
      if (await runSheetAction("reopen")) {
        toast.success(`Đã mở lại biểu ${sheet.template.shortName} để nhập tiếp.`);
      }
    } finally {
      setBusy((b) => (b === "reopen" ? null : b));
    }
  };

  /**
   * Nộp phiếu, bước 1: chạy lại bước kiểm tra của mẫu trên MỌI biểu đã nhập xong
   * (biểu "Không phát sinh số liệu" không kiểm — BR-36.2). Biểu đang mở kiểm ngay
   * trên màn; các biểu khác nạp vào bảng tính ẩn (`SheetValidator`).
   */
  const startSubmit = async () => {
    setBusy("validate");
    const issuesHere: SheetIssue[] = [];
    try {
      const provider = dataProvider();
      const contextOf = (code: string) => ({
        ...scriptContext,
        report: { ...scriptContext.report, sheetCode: code },
      });
      const others: typeof sheets = [];
      for (const s of sheets) {
        if (s.completion !== "COMPLETED") continue;
        const code = s.template.shortName;
        // Bảng đang hiện chỉ dùng được khi đã dựng xong ở đúng chế độ hiện tại; chưa xong
        // (bấm Nộp ngay sau Kiểm tra & hoàn tất) thì kiểm bản đã lưu như các biểu khác.
        if (s.id === sheetId && apiRef.current && apiEditableRef.current === sheetEditable) {
          const result = await runClientScript(apiRef.current, scriptText, "validate", contextOf(code));
          if (!result.ok) issuesHere.push(...result.messages.map((message) => ({ sheet: code, message })));
          continue;
        }
        others.push(s);
      }
      // Tải số liệu các biểu khác cùng lúc (trước đây tải lần lượt từng biểu); thứ tự kiểm
      // và thứ tự lỗi vẫn theo thứ tự biểu.
      const loaded = await Promise.all(
        others.map((s) => provider.getOne<InputReportSheetRecord>({ resource: SHEETS_RESOURCE, id: s.id }))
      );
      const jobs: ValidationJob[] = [];
      others.forEach((s, index) => {
        const { data } = loaded[index];
        const script = data.scriptText ?? "";
        if (script.trim() === "") return;
        const code = s.template.shortName;
        jobs.push({
          sheetId: s.id,
          code,
          workbook: parseWorkbook(data.dataJson) ?? parseWorkbook(data.templateWorkbookJson),
          scriptText: script,
          context: contextOf(code),
        });
      });
      if (jobs.length === 0) {
        finishValidation(issuesHere);
        return;
      }
      pendingIssues.current = issuesHere;
      setValidationJobs(jobs);
    } catch (error) {
      setBusy(null);
      toast.error(errorMessage(error, "Chưa kiểm tra được số liệu của phiếu. Bạn thử lại sau ít phút."));
    }
  };

  const finishValidation = (found: SheetIssue[]) => {
    setValidationJobs(null);
    setBusy(null);
    if (found.length > 0) {
      setIssues({ purpose: "submit", list: found });
      return;
    }
    setTreasuryOpen(true);
  };

  /** Nộp phiếu, bước cuối (UC-38, UC-43): cả phiếu một lần. */
  const submit = async () => {
    setBusy("submit");
    try {
      await postAction({
        url: reportActionUrl(report.id, "submit"),
        method: "post",
        values: {},
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setConfirmOpen(false);
      void dataUnitsQuery.refetch();
      drafts.current.clear();
      setDirty(new Set());
      setWarnWhen(false);
      toast.success(
        `Đã nộp phiếu ${report.period.name}; đang chờ Sở duyệt. Số liệu chỉ được ghi nhận khi phiếu được phê duyệt.`
      );
      await refreshAfterChange();
    } catch (error) {
      setConfirmOpen(false);
      toast.error(errorMessage(error, "Chưa nộp được phiếu. Bạn thử lại sau ít phút."));
      await refreshAfterChange();
    } finally {
      setBusy(null);
    }
  };

  const exportExcel = () => {
    const overrides = new Map(drafts.current);
    if (sheetId !== undefined && apiRef.current) overrides.set(sheetId, apiRef.current.toJSON());
    void exportReport(report, overrides);
  };

  // ------------------------------------------------------------ phím tắt

  // Ctrl+S = Lưu, chặn hộp "Lưu trang" của trình duyệt (nguyên tắc §11).
  const editableRef = useRef(sheetEditable);
  const busyRef = useRef<Busy>(busy);
  busyRef.current = busy;
  editableRef.current = sheetEditable && paneReady && busy === null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editableRef.current) void saveRef.current();
        else if (busyRef.current === null) toast.info("Biểu này đang ở chế độ chỉ xem nên không có gì để lưu.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc thoát toàn màn hình — nhường cho hộp thoại đang mở.
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !anyDialogOpen) exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, anyDialogOpen, exitFullscreen]);

  // ------------------------------------------------------------ nút theo trạng thái

  const commonItems: ActionItem[] = [
    {
      key: "excel",
      label: "Xuất Excel",
      icon: Download,
      onSelect: exportExcel,
      disabled: exporting || sheets.length === 0,
    },
    { key: "history", label: "Lịch sử phiên bản", icon: RotateCcwClock, onSelect: () => setHistoryOpen(true) },
  ];

  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] = [];
  let items: ActionItem[] = commonItems;
  let blockedReason: string | undefined;
  const code = sheet?.template.shortName ?? "";

  if (sheetEditable) {
    // Biểu đang mở chưa xong: [Lưu dữ liệu] [Kiểm tra & hoàn tất] ⋯ — phiếu bị trả lại cũng vậy:
    // sửa xong từng biểu thì kiểm tra & hoàn tất, xong hết mới có nút Nộp lại phiếu (không gộp).
    secondary = [{ label: "Lưu dữ liệu", icon: Save, onClick: () => void save(), loading: busy === "save" }];
    primary = { label: "Kiểm tra & hoàn tất", onClick: () => void complete(), loading: busy === "complete" };
    items = [
      { key: "no-data", label: "Không phát sinh số liệu", icon: CircleOff, onSelect: () => setNoDataOpen(true) },
      ...commonItems,
    ];
  } else if (editable && sheet) {
    // Biểu đang mở đã xong: nút chính là Nộp phiếu (mờ + lý do nếu còn biểu chưa xong).
    blockedReason =
      remaining.length > 0
        ? `Chưa nhập xong tất cả các biểu: còn biểu ${remaining.map((s) => s.template.shortName).join(", ")}.`
        : undefined;
    primary = {
      label: report.status === "RETURNED" ? "Nộp lại phiếu" : "Nộp phiếu",
      onClick: () => void startSubmit(),
      disabled: remaining.length > 0,
      reason: blockedReason,
      loading: busy === "validate" || busy === "submit",
    };
    // "Sửa lại biểu" là nút ngoài cạnh nút chính, không giấu trong menu ⋯.
    secondary = [{ label: `Sửa lại biểu ${code}`, icon: Pencil, onClick: () => void reopen() }];
  }

  if (!paneReady || busy !== null) {
    // Đang mở biểu / đang gửi: các nút hiện nhưng mờ (Figma 310:56441).
    primary = primary && { ...primary, disabled: true, reason: undefined };
    secondary = secondary.map((a) => ({ ...a, disabled: true }));
    items = items.map((i) => ({ ...i, disabled: true }));
  }

  // ------------------------------------------------------------ đầu thẻ

  const metaParts: string[] = [report.period.name, `Phiên bản ${report.revisionNo}`];
  metaParts.push(`${done}/${sheets.length} biểu`);
  if (status !== "draft") metaParts.push(statusLine(report));
  const lockedReason = readOnlyReason(report);
  if (lockedReason) metaParts.push(lockedReason);
  if (blockedReason) metaParts.push(blockedReason);
  if (sheet?.completion === "NO_DATA") metaParts.push(`Biểu ${code}: không phát sinh số liệu`);
  // Phiếu đã nộp trở đi: nhắc phiếu này nhập hộ cho bao nhiêu đơn vị (số đã chốt, không đổi nữa).
  if (report.status === "SUBMITTED" || report.status === "APPROVED" || report.status === "LOCKED") {
    for (const s of onBehalfSheets) metaParts.push(`Biểu ${s.templateShortName} nhập hộ cho ${s.units.length} đơn vị`);
  }

  const meta = (
    <span>
      {metaParts.join(" · ")}
      {isDirty && <span className="font-medium text-warning-text"> · Có thay đổi chưa lưu</span>}
    </span>
  );

  const fullscreenButton = fullscreen ? (
    <>
      <span className="hidden text-xs text-muted-foreground sm:inline">Nhấn Esc để thoát toàn màn hình</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label="Thoát toàn màn hình" onClick={exitFullscreen}>
            <Minimize />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Thoát toàn màn hình (Esc)</TooltipContent>
      </Tooltip>
    </>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Toàn màn hình" onClick={() => setFullscreen(true)}>
          <Maximize />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toàn màn hình</TooltipContent>
    </Tooltip>
  );

  const renderBody = () => {
    if (sheetsQuery.isError || contentQuery.isError) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa mở được biểu"
          description="Mạng có thể đang chập chờn. Bạn bấm Thử lại sau ít giây."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void sheetsQuery.refetch();
                void contentQuery.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      );
    }
    if (!sheetsQuery.isLoading && sheets.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title="Phiếu chưa có biểu nào"
          description="Sở Tài chính chưa giao biểu nào cho đơn vị trong phiếu này."
        />
      );
    }
    if (paneCorrupt) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Không mở được bảng tính"
          description={`Số liệu đã lưu của biểu ${code} bị lỗi nên chưa mở được; biểu không mở khung trống để tránh ghi đè số cũ. Vui lòng tải lại trang. Nếu vẫn không được, hãy báo cho quản trị hệ thống.`}
          action={
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
          }
        />
      );
    }
    if (!paneReady || !pane || sheetId === undefined) {
      return <LoadingState label="Đang mở phiếu…" />;
    }
    const paneSheetId = pane.sheetId;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SpreadWorkbook
          key={paneSheetId}
          workbook={pane.workbook}
          readOnly={!sheetEditable}
          hideTabs
          stampInputLocks={pane.stampLocks}
          scriptText={scriptText}
          scriptContext={scriptContext}
          onDirtyChange={(d) => {
            if (!d) return;
            editSeq.current += 1;
            markDirty(paneSheetId, true);
          }}
          onReady={(api) => {
            apiRef.current = api;
            apiEditableRef.current = sheetEditable;
          }}
          className="h-full min-h-[360px] flex-1"
        />
      </div>
    );
  };

  const card = (
    <WorkCard
      title={`${report.period.name} — ${report.unit.name}`}
      badge={<StatusBadge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</StatusBadge>}
      meta={meta}
      backTo={LIST_PATH}
      fill={!fullscreen}
      className={cn(fullscreen && "h-full rounded-none border-0 shadow-none")}
      actions={<HeaderActions primary={primary} secondary={secondary} items={items} />}
      footer={
        sheets.length > 0 && sheetId !== undefined ? (
          <SheetTabs
            tabs={sheets.map((s) => ({
              key: String(s.id),
              label: s.template.shortName,
              done: isSheetDone(s.completion),
            }))}
            value={String(sheetId)}
            onChange={selectSheet}
            trailing={fullscreenButton}
          />
        ) : undefined
      }
    >
      {renderBody()}
    </WorkCard>
  );

  const doneSheets = sheets.filter((s) => isSheetDone(s.completion));
  const confirmSummary = {
    sheets: `Số biểu: ${sheets.length} biểu, đã nhập xong hết`,
    total:
      doneSheets.filter((s) => s.completion === "NO_DATA").length > 0
        ? `Biểu không phát sinh số liệu: ${doneSheets
            .filter((s) => s.completion === "NO_DATA")
            .map((s) => s.template.shortName)
            .join(", ")}`
        : null,
    files: "Xác nhận của Kho bạc: đã đính kèm tệp và tích xác nhận",
    onBehalf: onBehalfText || null,
  };

  return (
    <>
      {fullscreen ? <div className="fixed inset-0 z-40 flex flex-col bg-background">{card}</div> : card}

      {validationJobs && (
        <SheetValidator
          jobs={validationJobs}
          onDone={(found) => finishValidation([...pendingIssues.current, ...found])}
        />
      )}

      <RevisionHistoryDialog
        report={report}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onView={(revisionId) => {
          setHistoryOpen(false);
          navigate(workPath(revisionId));
        }}
      />

      <ConfirmDialog
        open={noDataOpen}
        onOpenChange={setNoDataOpen}
        title={`Khai biểu ${code} không phát sinh số liệu?`}
        description={`Biểu ${code} sẽ được tính là đã xong và chuyển sang chỉ xem. Số liệu bạn đã gõ dở vẫn được giữ lại nhưng sẽ không được kiểm tra khi nộp. Bạn có thể bấm Sửa lại để nhập tiếp.`}
        confirmLabel="Không phát sinh số liệu"
        cancelLabel="Quay lại"
        onConfirm={() => void markNoData()}
      />

      <CheckErrorsDialog
        purpose={issues?.purpose === "submit" ? { kind: "submit" } : { kind: "complete", sheetCode: code }}
        issues={issues?.list ?? []}
        open={issues !== null}
        onOpenChange={(o) => !o && setIssues(null)}
      />

      <TreasurySubmitDialog
        reportId={report.id}
        open={treasuryOpen}
        onOpenChange={setTreasuryOpen}
        onSubmit={() => {
          setTreasuryOpen(false);
          // Số vừa lưu ở bước hoàn tất: đọc lại để hộp xác nhận nêu đúng các đơn vị được nhập hộ.
          void dataUnitsQuery.refetch();
          setConfirmOpen(true);
        }}
      />

      <SubmitConfirmDialog
        periodName={report.period.name}
        summary={confirmSummary}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void submit()}
        pending={busy === "submit"}
      />
    </>
  );
}
