import { useCallback, useEffect, useMemo, useState } from "react";
import type { FocusEvent, FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  CodeXml,
  CopyPlus,
  Eye,
  FileX,
  Italic,
  Maximize,
  Minimize,
  PaintBucket,
  Pencil,
  Percent,
  Redo2,
  Save,
  Send,
  Sigma,
  SquareFunction,
  Table,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Undo2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  HeaderActions,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  formatDate,
  formatNumber,
  type ActionItem,
  type PrimaryAction,
  type SheetCell,
  type SheetData,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { SAMPLE_RULE, type TemplateForm, type TemplateSet, type TemplateVersion } from "./fixtures";
import {
  KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  buildSheet,
  canClone,
  formLabel,
  isEditable,
  versionLabel,
  versionsOf,
} from "./model";
import { saveDesign, useTemplateState } from "./store";
import { RulesPanel, type RuleDraft } from "./components/rules-panel";
import { useVersionCommands } from "./components/use-version-commands";

/**
 * Thiết kế mẫu (UC-11, UC-12; khung 311:87785, xem trước 311:88607, quy tắc
 * 311:88923). Đường dẫn /templates/designer/:id với id là phiên bản mẫu.
 *
 * Phiên bản nháp: bảng sửa được, có thanh định dạng, Lưu / Xem trước / Ban hành.
 * Phiên bản đã ban hành / khoá / thu hồi: chỉ xem (BR-11.2).
 */
export function TemplateDesigner() {
  const { id } = useParams<{ id: string }>();
  const state = useTemplateState();

  const version = state.versions.find((v) => v.id === id);
  const form = version && state.forms.find((f) => f.id === version.formId);
  const set = form && state.sets.find((s) => s.id === form.setId);

  if (!version || !form || !set) {
    return (
      <AsxhPage title="Thiết kế mẫu" backTo="/templates" fill>
        <div className="bg-card flex min-h-0 flex-1 rounded-lg border shadow-e1">
          <EmptyState
            icon={FileX}
            title="Không tìm thấy phiên bản mẫu"
            description="Phiên bản này có thể đã bị xoá. Hãy quay lại Bộ biểu mẫu để chọn phiên bản khác."
            action={
              <Button asChild variant="outline">
                <Link to="/templates">Về Bộ biểu mẫu</Link>
              </Button>
            }
          />
        </div>
      </AsxhPage>
    );
  }

  // Đổi biểu (tab dưới) là đổi phiên bản: dựng lại vùng làm việc từ đầu.
  return <DesignerWorkspace key={version.id} version={version} form={form} set={set} />;
}

/* ------------------------------------------------------------------ */

type Mode = "design" | "preview";

/** Dòng nhập trong bảng thiết kế sửa được mọi cột trừ STT. */
function designSheet(form: TemplateForm): SheetData {
  const sheet = buildSheet(form);
  return {
    ...sheet,
    rows: sheet.rows.map((row) =>
      row.editable ? { ...row, editableCols: [1, 2, 3, 4, 5, 6] } : row
    ),
  };
}

const num = (v: SheetCell | undefined) => (typeof v === "number" ? v : null);

/** Quy tắc "Tự tính kinh phí": D = C × E × F / 1.000.000 trên mỗi dòng nhập, dòng Cộng = tổng C và D. */
function applyRule(sheet: SheetData, onlyRow?: number): { sheet: SheetData; rows: number } {
  let touched = 0;
  const rows = sheet.rows.map((row, r) => {
    if (!row.editable || (onlyRow !== undefined && r !== onlyRow)) return row;
    const c = num(row.cells[2]);
    const e = num(row.cells[4]);
    const f = num(row.cells[5]);
    if (c === null || e === null || f === null) return row;
    touched += 1;
    const cells = [...row.cells];
    cells[3] = Math.round((c * e * f) / 1_000_000);
    return { ...row, cells };
  });
  const totalIndex = rows.findIndex((r) => r.kind === "total");
  if (totalIndex >= 0) {
    const data = rows.filter((r) => r.editable);
    const cells = [...rows[totalIndex].cells];
    cells[2] = data.reduce((s, r) => s + (num(r.cells[2]) ?? 0), 0);
    cells[3] = data.reduce((s, r) => s + (num(r.cells[3]) ?? 0), 0);
    rows[totalIndex] = { ...rows[totalIndex], cells };
  }
  return { sheet: { ...sheet, rows }, rows: touched };
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function DesignerWorkspace({
  version,
  form,
  set,
}: {
  version: TemplateVersion;
  form: TemplateForm;
  set: TemplateSet;
}) {
  const navigate = useNavigate();
  const state = useTemplateState();
  const [params] = useSearchParams();

  const editable = isEditable(version.status);
  const chain = useMemo(() => versionsOf(state.versions, form.id), [state.versions, form.id]);

  const [mode, setMode] = useState<Mode>("design");
  const [rulesOpen, setRulesOpen] = useState(params.get("rules") === "1" && editable);
  const [fullscreen, setFullscreen] = useState(false);

  // Bảng + lịch sử để Hoàn tác / Làm lại.
  const [history, setHistory] = useState<SheetData[]>(() => [designSheet(form)]);
  const [step, setStep] = useState(0);
  const sheet = history[step];

  const [rule, setRule] = useState<RuleDraft>({
    name: SAMPLE_RULE.name,
    scope: "form",
    enabled: true,
    code: SAMPLE_RULE.code,
  });
  const [log, setLog] = useState<{ time: string; text: string }[]>([]);
  const [dirty, setDirty] = useState(false);

  // Ô đang chọn cho thanh công thức.
  const [cell, setCell] = useState<{ ref: string; text: string }>(() => {
    const b6 = sheet.rows[5]?.cells[1];
    return { ref: "B6", text: b6 === null || b6 === undefined ? "" : String(b6) };
  });

  const [format, setFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: "start" as "start" | "center" | "end",
  });

  const backTo = `/templates?set=${set.id}&form=${form.id}&version=${version.id}`;
  const readOnly = mode === "preview" || !editable;

  /* ---------------- sửa bảng ---------------- */

  function pushSheet(next: SheetData) {
    setHistory((h) => [...h.slice(0, step + 1), next]);
    setStep((s) => s + 1);
    setDirty(true);
  }

  function onCellChange(r: number, c: number, value: SheetCell) {
    if (r >= sheet.rows.length) return;
    const rows = sheet.rows.map((row, i) => {
      if (i !== r) return row;
      const cells = [...row.cells];
      while (cells.length <= c) cells.push(null);
      cells[c] = value;
      return { ...row, cells };
    });
    let next: SheetData = { ...sheet, rows };
    if (rule.enabled && [2, 4, 5].includes(c)) next = applyRule(next, r).sheet;
    pushSheet(next);
  }

  const canUndo = step > 0;
  const canRedo = step < history.length - 1;

  /* ---------------- thanh công thức ---------------- */

  function cellInfo(target: EventTarget | null) {
    if (!(target instanceof HTMLInputElement)) return null;
    const label = target.getAttribute("aria-label") ?? "";
    const m = /^Ô ([A-Z]+)(\d+)$/.exec(label);
    if (!m) return null;
    const ref = `${m[1]}${m[2]}`;
    const row = sheet.rows[Number(m[2]) - 1];
    // Ô kinh phí của dòng nhập là ô có công thức.
    if (m[1] === "D" && row?.editable && rule.enabled) {
      return { ref, text: `=C${m[2]}*E${m[2]}*F${m[2]}/1.000.000` };
    }
    return { ref, text: target.value };
  }

  const onFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const info = cellInfo(e.target);
    if (info) setCell(info);
  };
  const onInputCapture = (e: FormEvent<HTMLDivElement>) => {
    const info = cellInfo(e.target);
    if (info) {
      setCell(info);
      setDirty(true);
    }
  };

  /* ---------------- lưu / phím tắt / rời trang ---------------- */

  const save = useCallback(() => {
    if (!editable) return;
    if (!dirty) {
      toast.info("Chưa có thay đổi nào để lưu.");
      return;
    }
    const result = saveDesign(version.id, "design");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDirty(false);
    toast.success(
      `Đã lưu thiết kế và quy tắc của ${formLabel(form).toLowerCase()}, ${versionLabel(version).toLowerCase()}.`
    );
  }, [dirty, editable, form, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, fullscreen]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* ---------------- quy tắc ---------------- */

  function recalcTotals() {
    pushSheet(applyRule(sheet).sheet);
    toast.info("Đã tính lại kinh phí từng dòng và dòng Cộng.");
  }

  function runRule() {
    if (!rule.enabled) {
      setLog((l) => [
        ...l,
        { time: clock(), text: `Quy tắc “${rule.name}” đang tắt — bật lên rồi chạy thử.` },
      ]);
      return;
    }
    const result = applyRule(sheet);
    const total = result.sheet.rows.find((r) => r.kind === "total");
    if (editable) pushSheet(result.sheet);
    const time = clock();
    setLog((l) => [
      ...l,
      { time, text: `Chạy quy tắc “${rule.name}” trên ${formLabel(form).toLowerCase()}.` },
      { time, text: `Đã tính lại ${result.rows} dòng, không có lỗi.` },
      ...(total
        ? [{ time, text: `Dòng cộng: ${formatNumber(num(total.cells[3]))} triệu đồng.` }]
        : []),
    ]);
  }

  /* ---------------- việc trên phiên bản ---------------- */

  const commands = useVersionCommands({
    onCloned: (v) => navigate(`/templates/designer/${v.id}`),
    onPublished: () => setMode("design"),
  });

  const cloneable = canClone(chain, version);

  const publishAction: PrimaryAction | undefined = editable
    ? {
        label: "Ban hành",
        icon: Send,
        disabled: dirty,
        reason: dirty ? "Lưu thay đổi trước đã." : undefined,
        onClick: () => commands.requestPublish(version),
      }
    : version.status === "published" && cloneable.ok
      ? {
          label: "Tạo phiên bản kế tiếp",
          icon: CopyPlus,
          onClick: () => commands.clone(version),
        }
      : undefined;

  const secondary: PrimaryAction[] =
    mode === "preview"
      ? [{ label: "Quay lại thiết kế", icon: Pencil, onClick: () => setMode("design") }]
      : editable
        ? [
            { label: "Lưu", icon: Save, onClick: save },
            { label: "Xem trước", icon: Eye, onClick: () => setMode("preview") },
          ]
        : [];

  const menu: ActionItem[] = [
    ...(mode === "design"
      ? [
          {
            key: "rules",
            label: rulesOpen ? "Đóng khung quy tắc" : "Soạn công thức và quy tắc nhập",
            icon: CodeXml,
            onSelect: () => setRulesOpen((o) => !o),
          },
        ]
      : []),
    {
      key: "fullscreen",
      label: fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình",
      icon: fullscreen ? Minimize : Maximize,
      onSelect: () => setFullscreen((f) => !f),
    },
  ];

  /* ---------------- chữ đầu trang ---------------- */

  const title =
    mode === "preview"
      ? `Xem trước — ${formLabel(form)}, ${versionLabel(version)}`
      : `${formLabel(form)} — ${versionLabel(version)}`;

  const description =
    mode === "preview"
      ? "Chế độ chỉ xem, không sửa được ở đây. Muốn sửa, bấm Quay lại thiết kế."
      : [
          set.name,
          KIND_LABEL[form.kind],
          editable
            ? version.effectiveFrom
              ? `Dự kiến áp dụng từ ${formatDate(version.effectiveFrom)}`
              : "Chưa đặt ngày áp dụng"
            : version.status === "published"
              ? `Áp dụng từ ${formatDate(version.effectiveFrom ?? "")} · chỉ xem, muốn sửa hãy tạo phiên bản kế tiếp`
              : `${STATUS_LABEL[version.status]} · chỉ xem`,
          dirty ? "Có thay đổi chưa lưu" : null,
        ]
          .filter(Boolean)
          .join(" · ");

  /* ---------------- tab biểu ---------------- */

  const tabs = state.forms
    .filter((f) => f.setId === set.id)
    .map((f) => ({ key: f.id, label: f.name }));

  function switchForm(formId: string) {
    if (formId === form.id) return;
    if (dirty) {
      toast.warning("Hãy lưu thay đổi trước khi chuyển sang biểu khác.");
      return;
    }
    const target = versionsOf(state.versions, formId)[0];
    if (!target) {
      toast.info("Biểu này chưa có phiên bản nào.");
      return;
    }
    navigate(`/templates/designer/${target.id}`);
  }

  const fullscreenButton = (
    <IconTool
      icon={fullscreen ? Minimize : Maximize}
      label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
      onClick={() => setFullscreen((f) => !f)}
    />
  );

  return (
    <AsxhPage
      title={title}
      badge={
        <StatusBadge tone={STATUS_TONE[version.status]}>
          {STATUS_LABEL[version.status]}
        </StatusBadge>
      }
      description={description}
      backTo={backTo}
      fill
      actions={
        <HeaderActions primary={publishAction} secondary={secondary} items={menu} />
      }
    >
      <div
        className={cn(
          "bg-card flex min-h-0 flex-1 overflow-hidden border shadow-e1",
          fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : "rounded-lg"
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {mode === "design" && (
            <div
              role="toolbar"
              aria-label="Định dạng bảng"
              className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5"
            >
              <IconTool icon={Undo2} label="Hoàn tác" disabled={readOnly || !canUndo} onClick={() => { setStep((s) => s - 1); setDirty(true); }} />
              <IconTool icon={Redo2} label="Làm lại" disabled={readOnly || !canRedo} onClick={() => { setStep((s) => s + 1); setDirty(true); }} />
              <ToolDivider />
              <IconTool icon={Bold} label="Chữ đậm" disabled={readOnly} pressed={format.bold} onClick={() => { setFormat((f) => ({ ...f, bold: !f.bold })); setDirty(true); }} />
              <IconTool icon={Italic} label="Chữ nghiêng" disabled={readOnly} pressed={format.italic} onClick={() => { setFormat((f) => ({ ...f, italic: !f.italic })); setDirty(true); }} />
              <IconTool icon={Underline} label="Gạch chân" disabled={readOnly} pressed={format.underline} onClick={() => { setFormat((f) => ({ ...f, underline: !f.underline })); setDirty(true); }} />
              <ToolDivider />
              <IconTool icon={TextAlignStart} label="Canh trái" disabled={readOnly} pressed={format.align === "start"} onClick={() => { setFormat((f) => ({ ...f, align: "start" })); setDirty(true); }} />
              <IconTool icon={TextAlignCenter} label="Canh giữa" disabled={readOnly} pressed={format.align === "center"} onClick={() => { setFormat((f) => ({ ...f, align: "center" })); setDirty(true); }} />
              <IconTool icon={TextAlignEnd} label="Canh phải" disabled={readOnly} pressed={format.align === "end"} onClick={() => { setFormat((f) => ({ ...f, align: "end" })); setDirty(true); }} />
              <ToolDivider />
              <IconTool icon={Table} label="Kẻ khung ô" disabled={readOnly} onClick={() => setDirty(true)} />
              <IconTool icon={PaintBucket} label="Tô màu nền ô" disabled={readOnly} onClick={() => setDirty(true)} />
              <ToolDivider />
              <IconTool icon={Sigma} label="Tính lại dòng Cộng" disabled={readOnly} onClick={recalcTotals} />
              <IconTool icon={Percent} label="Định dạng phần trăm" disabled={readOnly} onClick={() => setDirty(true)} />
              <div className="ms-auto flex items-center">{fullscreenButton}</div>
            </div>
          )}

          {/* Thanh công thức: tên ô + nội dung ô đang chọn. */}
          <div className="flex h-9 shrink-0 items-center gap-2 border-b px-2 text-sm">
            <span
              aria-label="Ô đang chọn"
              className="text-muted-foreground w-10 shrink-0 text-center text-xs font-medium tabular-nums"
            >
              {cell.ref}
            </span>
            <SquareFunction aria-hidden className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate" title={cell.text}>
              {cell.text}
            </span>
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col"
            onFocusCapture={onFocusCapture}
            onInputCapture={onInputCapture}
          >
            <SpreadsheetView
              sheet={sheet}
              readOnly={readOnly}
              minRows={40}
              onCellChange={readOnly ? undefined : onCellChange}
            />
          </div>

          <div className="shrink-0 border-t px-2 py-1.5">
            <SheetTabs
              tabs={tabs}
              value={form.id}
              onChange={switchForm}
              maxVisible={6}
              trailing={mode === "preview" ? fullscreenButton : undefined}
            />
          </div>
        </div>

        {mode === "design" && rulesOpen && (
          <RulesPanel
            formName={form.name}
            rule={rule}
            readOnly={!editable}
            log={log}
            onChange={(next) => {
              setRule(next);
              setDirty(true);
            }}
            onRun={runRule}
            onClose={() => setRulesOpen(false)}
            className="w-[min(520px,45%)] shrink-0"
          />
        )}
      </div>

      {commands.dialogs}
    </AsxhPage>
  );
}

/* ------------------------------------------------------------------ */

function ToolDivider() {
  return <span aria-hidden className="bg-border mx-1 h-5 w-px shrink-0" />;
}

/** Nút chỉ có icon trên thanh công cụ: có tên đọc được và gợi ý khi rê chuột. */
function IconTool({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn(pressed && "bg-accent text-accent-foreground")}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
