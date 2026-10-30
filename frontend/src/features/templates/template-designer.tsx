import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CodeXml,
  CopyPlus,
  Eye,
  FileDown,
  FileUp,
  FileX,
  FlaskConical,
  Maximize,
  Minimize,
  Pencil,
  Save,
  Send,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useCan, useWarnAboutChange } from "@refinedev/core";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  HeaderActions,
  LoadingState,
  SheetTabs,
  StatusBadge,
  formatDate,
  type ActionItem,
  type PrimaryAction,
} from "@/shared/components/asxh";
import {
  SpreadDesigner,
  SpreadWorkbook,
  runClientScript,
  type SpreadWorkbookApi,
  type WorkbookJson,
} from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import {
  useDesignerContext,
  useTemplateActions,
  useTemplateVersion,
} from "./api";
import type { ApiTemplateVersion } from "./types";
import {
  KIND_LABEL,
  MAX_WORKBOOK_BYTES,
  STATUS_LABEL,
  STATUS_TONE,
  byteLength,
  canClone,
  formLabel,
  formOfVersion,
  isEditable,
  parseWorkbook,
  toVersion,
  versionLabel,
} from "./model";
import { RulesPanel } from "./components/rules-panel";
import { useVersionCommands } from "./components/use-version-commands";

const TITLE = "Thiết kế mẫu";

/**
 * Thiết kế mẫu (UC-11, UC-12; khung 311:87785, xem trước 311:88607, quy tắc
 * 311:88923). Đường dẫn /templates/designer/:id với id là phiên bản mẫu.
 *
 * Phiên bản nháp / đang thử nghiệm: SpreadJS Designer (ribbon) sửa được, Lưu
 * (workbook + quy tắc trong một lần), Xem trước, nhập file Excel, Ban hành.
 * Phiên bản đã ban hành / khoá / thu hồi: chỉ xem (BR-11.2, BR-12.4).
 */
export function TemplateDesigner() {
  const { id } = useParams<{ id: string }>();
  const { version, isLoading, isError, statusCode } = useTemplateVersion(id);
  // Người chỉ có quyền xem (vd. cán bộ duyệt) mở thiết kế ở chế độ chỉ xem — không Lưu / Ban hành.
  // Chờ câu trả lời quyền rồi mới dựng: đổi giữa Designer và bảng chỉ xem là dựng lại cả bảng tính.
  const { data: canWriteData, isLoading: canLoading } = useCan({ resource: "template_versions", action: "edit" });

  if (isLoading || canLoading) {
    return (
      <AsxhPage title={TITLE} backTo="/templates" fill>
        <div className="bg-card flex min-h-0 flex-1 rounded-lg border shadow-e1">
          <LoadingState label="Đang mở thiết kế…" hint="Biểu lớn có thể mất vài giây." />
        </div>
      </AsxhPage>
    );
  }

  if (isError || !version) {
    const missing = statusCode === 404 || (!isError && !version);
    return (
      <AsxhPage title={TITLE} backTo="/templates" fill>
        <div className="bg-card flex min-h-0 flex-1 rounded-lg border shadow-e1">
          <EmptyState
            icon={missing ? FileX : TriangleAlert}
            title={missing ? "Không tìm thấy phiên bản mẫu" : "Không mở được thiết kế"}
            description={
              missing
                ? "Phiên bản này có thể đã bị xoá. Hãy quay lại Bộ biểu mẫu để chọn phiên bản khác."
                : "Kiểm tra kết nối mạng rồi mở lại."
            }
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
  return <DesignerWorkspace key={version.id} data={version} canWrite={canWriteData?.can === true} />;
}

/* ------------------------------------------------------------------ */

type Mode = "design" | "preview";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function DesignerWorkspace({ data, canWrite }: { data: ApiTemplateVersion; canWrite: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const actions = useTemplateActions();

  const version = useMemo(() => toVersion(data), [data]);
  const form = useMemo(() => formOfVersion(data), [data]);
  const setName = data.template.set.name;
  const editable = canWrite && isEditable(version.status);

  const context = useDesignerContext(form.setId, form.id);
  const chain = context.chain.length > 0 ? context.chain : [version];

  /* ---------------- bảng tính ---------------- */

  // Nội dung nạp vào Designer — chỉ đặt khi mở và khi quay lại từ xem trước,
  // để lưu xong không nạp lại (mất lịch sử hoàn tác, vị trí ô đang chọn).
  const [seed, setSeed] = useState<WorkbookJson | null>(() => parseWorkbook(data.workbookJson));
  // Bản đã lưu gần nhất — cho chế độ chỉ xem sau khi ban hành.
  const [saved, setSaved] = useState<WorkbookJson | null>(seed);
  const [previewJson, setPreviewJson] = useState<WorkbookJson | null>(null);
  const spreadRef = useRef<SpreadWorkbookApi | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<Mode>("design");
  const [fullscreen, setFullscreen] = useState(false);
  const [workbookDirty, setWorkbookDirty] = useState(false);
  /** Đếm lần sửa (bảng + quy tắc) — sửa thêm trong lúc đang lưu không bị coi là đã lưu. */
  const editSeq = useRef(0);
  const [saving, setSaving] = useState(false);

  /* ---------------- quy tắc nhập ---------------- */

  const [rulesOpen, setRulesOpen] = useState(params.get("rules") === "1");
  const [script, setScript] = useState(data.scriptText ?? "");
  const [scriptDirty, setScriptDirty] = useState(false);
  const [hook, setHook] = useState("onLoad");
  const [log, setLog] = useState<{ time: string; text: string; error?: boolean }[]>([]);
  const [running, setRunning] = useState(false);

  const dirty = editable && (workbookDirty || scriptDirty);
  const backTo = `/templates?set=${form.setId}&form=${form.id}&version=${version.id}`;

  // Rời màn khi còn thay đổi chưa lưu: hộp hỏi của ứng dụng (UC-11 4c).
  const { setWarnWhen } = useWarnAboutChange();
  useEffect(() => {
    setWarnWhen(dirty);
    return () => setWarnWhen(false);
  }, [dirty, setWarnWhen]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* ---------------- lưu ---------------- */

  const save = useCallback(async () => {
    if (!editable || saving) return;
    if (!dirty) {
      toast.info("Chưa có thay đổi nào để lưu.");
      return;
    }
    const api = spreadRef.current;
    const values: { workbookJson?: string; scriptText?: string } = {};
    let json: WorkbookJson | null = null;
    if (workbookDirty || mode === "preview") {
      json = mode === "preview" ? previewJson : (api?.toJSON() ?? null);
      if (!json) {
        toast.error("Bảng tính chưa mở xong, vui lòng thử lại.");
        return;
      }
      const text = JSON.stringify(json);
      if (byteLength(text) > MAX_WORKBOOK_BYTES) {
        toast.error(
          "Bảng tính quá lớn (quá 20MB). Hãy xoá bớt vùng trống, dòng hoặc cột thừa rồi lưu lại."
        );
        return;
      }
      values.workbookJson = text;
    }
    if (scriptDirty) values.scriptText = script;

    const seq = editSeq.current;
    setSaving(true);
    const result = await actions.saveVersion(version.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (json) setSaved(json);
    // Sửa thêm trong lúc chờ máy chủ: phần đó chưa có trong bản vừa lưu → giữ cờ "chưa lưu".
    if (editSeq.current === seq) {
      setWorkbookDirty(false);
      setScriptDirty(false);
    }
    toast.success(
      `Đã lưu thiết kế và quy tắc của ${formLabel(form).toLowerCase()}, ${versionLabel(version).toLowerCase()}.`
    );
  }, [
    actions,
    dirty,
    editable,
    form,
    mode,
    previewJson,
    saving,
    script,
    scriptDirty,
    version,
    workbookDirty,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, fullscreen]);

  /* ---------------- xem trước ---------------- */

  function openPreview() {
    const json = spreadRef.current?.toJSON() ?? seed;
    setPreviewJson(json);
    setMode("preview");
  }

  function closePreview() {
    // Designer được dựng lại từ đúng nội dung đang xem — không mất phần chưa lưu.
    setSeed(previewJson);
    setMode("design");
  }

  /* ---------------- nhập / xuất file ---------------- */

  async function importFile(file: File) {
    const api = spreadRef.current;
    if (!api) {
      toast.error("Bảng tính chưa mở xong, vui lòng thử lại.");
      return;
    }
    try {
      await api.importFile(file);
      editSeq.current += 1;
      setWorkbookDirty(true);
      const sheets = api.getSheetNames().length;
      if (sheets > 1) {
        toast.warning(
          `Đã nhập file “${file.name}”. File có ${sheets} trang — mỗi biểu chỉ dùng một trang, hãy xoá trang thừa trước khi ban hành.`
        );
      } else {
        toast.success(`Đã nhập file “${file.name}”. Bấm Lưu để giữ lại.`);
      }
    } catch {
      toast.error(`Không đọc được file “${file.name}”. Hãy chọn file Excel (.xlsx).`);
    }
  }

  async function exportFile() {
    const api = spreadRef.current;
    if (!api) return;
    try {
      await api.exportXlsx(`${formLabel(form)} - ${versionLabel(version)}.xlsx`);
    } catch {
      toast.error("Không tải được file Excel. Hãy thử lại.");
    }
  }

  /* ---------------- chạy thử quy tắc ---------------- */

  async function runRule() {
    const api = spreadRef.current;
    if (!api) {
      toast.error("Bảng tính chưa mở xong, vui lòng thử lại.");
      return;
    }
    setRunning(true);
    const time = clock();
    const result = await runClientScript(api, script, hook, {
      mode: "designer",
      unitName: "Đơn vị chạy thử",
      year: new Date().getFullYear(),
    });
    setRunning(false);
    setLog((l) => [
      ...l,
      ...result.messages.map((text) => ({ time, text, error: !result.ok })),
      {
        time,
        text: result.ok ? "Chạy xong, không có lỗi." : "Chạy xong, có lỗi — xem các dòng trên.",
        error: !result.ok,
      },
    ]);
  }

  /* ---------------- việc trên phiên bản ---------------- */

  const commands = useVersionCommands({
    actions,
    chainOf: () => chain,
    onCloned: (v) => navigate(`/templates/designer/${v.id}`),
    onDeleted: () => navigate(backTo),
    onPublished: () => setMode("design"),
  });

  const cloneable = canClone(chain, version);
  const testing = version.status === "testing";

  const primary: PrimaryAction | undefined = editable
    ? {
        label: "Ban hành",
        icon: Send,
        disabled: dirty || saving,
        reason: dirty ? "Lưu thay đổi trước đã." : undefined,
        onClick: () => commands.requestPublish(version),
      }
    : canWrite && version.status === "published" && cloneable.ok
      ? {
          label: "Tạo phiên bản kế tiếp",
          icon: CopyPlus,
          loading: commands.busy,
          onClick: () => commands.clone(version),
        }
      : undefined;

  const secondary: PrimaryAction[] = !editable
    ? []
    : mode === "preview"
      ? [{ label: "Quay lại thiết kế", icon: Pencil, onClick: closePreview }]
      : [
          { label: "Lưu", icon: Save, loading: saving, onClick: () => void save() },
          { label: "Xem trước", icon: Eye, onClick: openPreview },
        ];

  const versionItems = commands.itemsFor(version);
  const testingItem = versionItems.find((i) => i.key === "testing");
  const lockItem = versionItems.find((i) => i.key === "lock");

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
    ...(editable && mode === "design"
      ? [
          {
            key: "import",
            label: "Nhập file Excel",
            icon: FileUp,
            onSelect: () => fileRef.current?.click(),
          },
        ]
      : []),
    {
      key: "export",
      label: "Tải về file Excel",
      icon: FileDown,
      disabled: mode === "preview",
      onSelect: () => void exportFile(),
    },
    ...(testingItem
      ? [
          {
            ...testingItem,
            icon: testing ? Undo2 : FlaskConical,
            disabled: testingItem.disabled || dirty,
            reason: dirty ? "Lưu thay đổi trước đã." : testingItem.reason,
            separatorBefore: true,
          },
        ]
      : []),
    ...(lockItem && !editable ? [{ ...lockItem, separatorBefore: true }] : []),
    {
      key: "fullscreen",
      label: fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình",
      icon: fullscreen ? Minimize : Maximize,
      separatorBefore: true,
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
      ? "Chế độ chỉ xem, giống màn nhập liệu của đơn vị. Muốn sửa, bấm Quay lại thiết kế."
      : [
          setName,
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

  const tabs = context.forms.length > 0
    ? context.forms.map((f) => ({ key: f.id, label: f.name }))
    : [{ key: form.id, label: form.name }];

  function switchForm(formId: string) {
    if (formId === form.id) return;
    if (dirty) {
      toast.warning("Hãy lưu thay đổi trước khi chuyển sang biểu khác.");
      return;
    }
    const target = context.forms.find((f) => f.id === formId)?.latestVersionId;
    if (!target) {
      toast.info("Biểu này chưa có phiên bản nào.");
      return;
    }
    navigate(`/templates/designer/${target}`);
  }

  const fullscreenButton = (
    <IconTool
      icon={fullscreen ? Minimize : Maximize}
      label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
      onClick={() => setFullscreen((f) => !f)}
    />
  );

  /* ---------------- vùng bảng tính ---------------- */

  let sheetArea: ReactNode;
  if (!editable) {
    sheetArea = (
      <SpreadWorkbook
        workbook={saved}
        readOnly
        className="min-h-0 flex-1"
        onReady={(api) => {
          spreadRef.current = api;
        }}
      />
    );
  } else if (mode === "preview") {
    sheetArea = (
      <SpreadWorkbook
        workbook={previewJson}
        scriptText={script}
        scriptContext={{
          mode: "input",
          unitName: "Đơn vị xem trước",
          year: new Date().getFullYear(),
        }}
        stampInputLocks
        className="min-h-0 flex-1"
        onReady={(api) => {
          spreadRef.current = api;
        }}
      />
    );
  } else {
    sheetArea = (
      <SpreadDesigner
        workbook={seed}
        className="min-h-0 flex-1"
        onReady={(api) => {
          spreadRef.current = api;
        }}
        onDirtyChange={(d) => {
          if (!d) return;
          editSeq.current += 1;
          setWorkbookDirty(true);
        }}
      />
    );
  }

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
      actions={<HeaderActions primary={primary} secondary={secondary} items={menu} />}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.ssjson,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />

      <div
        className={cn(
          "bg-card flex min-h-0 flex-1 overflow-hidden border shadow-e1",
          fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : "rounded-lg"
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{sheetArea}</div>

          <div className="shrink-0 border-t px-2 py-1.5">
            <SheetTabs
              tabs={tabs}
              value={form.id}
              onChange={switchForm}
              trailing={fullscreenButton}
            />
          </div>
        </div>

        {mode === "design" && rulesOpen && (
          <RulesPanel
            script={script}
            readOnly={!editable}
            onChange={(next) => {
              setScript(next);
              editSeq.current += 1;
              setScriptDirty(true);
            }}
            hook={hook}
            onHookChange={setHook}
            log={log}
            running={running}
            onRun={() => void runRule()}
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

/** Nút chỉ có icon: có tên đọc được và gợi ý khi rê chuột. */
function IconTool({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
