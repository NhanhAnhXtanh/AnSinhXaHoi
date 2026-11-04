import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CodeXml,
  CopyPlus,
  Eye,
  FileDown,
  FileX,
  Maximize,
  Minimize,
  Pencil,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useCan, useWarnAboutChange } from "@refinedev/core";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  HeaderActions,
  LoadingState,
  StatusBadge,
  formatDate,
  type ActionItem,
  type PrimaryAction,
} from "@/shared/components/asxh";
import {
  SpreadDesigner,
  SpreadWorkbook,
  declaredHooksOf,
  type SpreadWorkbookApi,
  type WorkbookJson,
} from "@/shared/components/spreadsheet";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import {
  useDesignerContext,
  useTemplateActions,
  useTemplateScripts,
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
import { ScriptEditorPanel, type ScriptPanelMode } from "./components/script-editor-panel";
import { useVersionCommands } from "./components/use-version-commands";
import {
  applySavedIds,
  runtimeScriptText,
  toDraft,
  toPayloads,
  type DraftScript,
} from "./script-drafts";

const TITLE = "Thiết kế mẫu";

/**
 * Thiết kế mẫu (UC-11, UC-12; khung 311:87785, xem trước 311:88607, quy tắc
 * 311:88923). Đường dẫn /templates/designer/:id với id là phiên bản mẫu.
 *
 * Phiên bản nháp: SpreadJS Designer (ribbon) sửa được, Lưu
 * (workbook + cả danh sách kịch bản trong một lần, như bản Jmix), Xem trước,
 * nhập file Excel, Ban hành. Phiên bản đã ban hành / khoá / thu hồi: chỉ xem
 * (BR-11.2, BR-12.4) — riêng kịch bản tổng hợp (getSummaryData) của bản đã ban
 * hành / đang khoá vẫn sửa được và lưu riêng, như bản Jmix.
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

function DesignerWorkspace({ data, canWrite }: { data: ApiTemplateVersion; canWrite: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const actions = useTemplateActions();

  const version = useMemo(() => toVersion(data), [data]);
  const form = useMemo(() => formOfVersion(data), [data]);
  const setName = data.template.set.name;
  const editable = canWrite && isEditable(version.status);

  const context = useDesignerContext(form.id);
  const chain = context.chain.length > 0 ? context.chain : [version];

  /* ---------------- bảng tính ---------------- */

  // Nội dung nạp vào Designer — chỉ đặt khi mở và khi quay lại từ xem trước,
  // để lưu xong không nạp lại (mất lịch sử hoàn tác, vị trí ô đang chọn).
  const [seed, setSeed] = useState<WorkbookJson | null>(() => parseWorkbook(data.workbookJson));
  // Bản đã lưu gần nhất — cho chế độ chỉ xem sau khi ban hành.
  const [saved, setSaved] = useState<WorkbookJson | null>(seed);
  const [previewJson, setPreviewJson] = useState<WorkbookJson | null>(null);
  const spreadRef = useRef<SpreadWorkbookApi | null>(null);
  // Bảng đang thiết kế cho khung kịch bản (Chạy / Dừng) — state để khung biết khi nào bảng sẵn sàng.
  const [designApi, setDesignApi] = useState<SpreadWorkbookApi | null>(null);

  const [mode, setMode] = useState<Mode>("design");
  const [fullscreen, setFullscreen] = useState(false);
  const [workbookDirty, setWorkbookDirty] = useState(false);
  /** Đếm lần sửa (bảng + quy tắc) — sửa thêm trong lúc đang lưu không bị coi là đã lưu. */
  const editSeq = useRef(0);
  const [saving, setSaving] = useState(false);

  /* ---------------- kịch bản ---------------- */

  const [rulesOpen, setRulesOpen] = useState(params.get("rules") === "1");
  const scriptsQuery = useTemplateScripts(String(data.id));
  // Bản soạn tại chỗ — null tới khi tải xong. Chỉ nạp một lần; sau khi lưu chỉ ghép id mới vào.
  const [drafts, setDrafts] = useState<DraftScript[] | null>(null);
  const [scriptsDirty, setScriptsDirty] = useState(false);
  useEffect(() => {
    if (drafts == null && scriptsQuery.scripts) setDrafts(scriptsQuery.scripts.map(toDraft));
  }, [drafts, scriptsQuery.scripts]);

  // Chỉ bản Nháp sửa được kịch bản; bản đã ban hành trở đi chỉ xem (kể cả
  // kịch bản tổng hợp — khác Jmix, người dùng chốt: muốn đổi thì tạo phiên bản kế tiếp).
  const scriptMode: ScriptPanelMode = editable ? "edit" : "read";

  const dirty = editable && (workbookDirty || scriptsDirty);
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
    const values: Parameters<typeof actions.saveVersion>[1] = {};
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
    // Cả danh sách kịch bản, thay toàn bộ ở máy chủ trong cùng lần lưu với bảng tính.
    const sentDrafts = scriptsDirty && drafts ? drafts : null;
    if (sentDrafts) {
      if (sentDrafts.some((d) => d.name.trim() === "")) {
        toast.error("Có kịch bản chưa đặt tên — hãy đặt tên rồi lưu lại.");
        return;
      }
      values.scripts = toPayloads(sentDrafts, declaredHooksOf);
    }

    const seq = editSeq.current;
    setSaving(true);
    const result = await actions.saveVersion(version.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (json) setSaved(json);
    if (sentDrafts) {
      // Lấy id máy chủ cấp cho kịch bản mới (lần lưu sau sửa tại chỗ thay vì tạo lại).
      const fresh = await scriptsQuery.refetch();
      const saved = Array.isArray(fresh.data?.data) ? fresh.data.data : null;
      if (saved) setDrafts((current) => (current ? applySavedIds(current, saved) : current));
    }
    // Sửa thêm trong lúc chờ máy chủ: phần đó chưa có trong bản vừa lưu → giữ cờ "chưa lưu".
    if (editSeq.current === seq) {
      setWorkbookDirty(false);
      setScriptsDirty(false);
    }
    toast.success(
      `Đã lưu thiết kế và kịch bản của ${formLabel(form).toLowerCase()}, ${versionLabel(version).toLowerCase()}.`
    );
  }, [
    actions,
    dirty,
    drafts,
    editable,
    form,
    mode,
    previewJson,
    saving,
    scriptsDirty,
    scriptsQuery,
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

  /* ---------------- tải file (bản chỉ xem) ---------------- */

  async function exportFile() {
    const api = spreadRef.current;
    if (!api) return;
    try {
      await api.exportXlsx(`${formLabel(form)} - ${versionLabel(version)}.xlsx`);
    } catch {
      toast.error("Không tải được file Excel. Hãy thử lại.");
    }
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
  const lockItem = versionItems.find((i) => i.key === "lock");

  const menu: ActionItem[] = [
    ...(mode === "design"
      ? [
          {
            key: "rules",
            label: rulesOpen ? "Đóng khung kịch bản" : editable ? "Soạn kịch bản của biểu" : "Xem kịch bản của biểu",
            icon: CodeXml,
            onSelect: () => setRulesOpen((o) => !o),
          },
        ]
      : []),
    // Bản sửa được: nhập / xuất file dùng menu FILE của bảng tính (Import / Export), không
    // lặp lại ở đây. Bản chỉ xem không có thanh công cụ đó nên vẫn giữ mục tải về.
    ...(!editable
      ? [
          {
            key: "export",
            label: "Tải về file Excel",
            icon: FileDown,
            onSelect: () => void exportFile(),
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
          setDesignApi(api);
        }}
      />
    );
  } else if (mode === "preview") {
    sheetArea = (
      <SpreadWorkbook
        workbook={previewJson}
        scriptText={runtimeScriptText(drafts ?? [])}
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
          setDesignApi(api);
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
      <div
        className={cn(
          "bg-card flex min-h-0 flex-1 overflow-hidden border shadow-e1",
          fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : "rounded-lg"
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{sheetArea}</div>

          {/* Màn thiết kế chỉ mở đúng một biểu; đổi biểu thì quay về Bộ biểu mẫu. */}
          <div className="flex shrink-0 justify-end border-t px-2 py-1.5">{fullscreenButton}</div>
        </div>

        {mode === "design" && rulesOpen && (
          <ScriptEditorPanel
            drafts={drafts}
            loadFailed={scriptsQuery.isError && drafts == null}
            onReload={() => void scriptsQuery.refetch()}
            onChange={(next) => {
              setDrafts(next);
              editSeq.current += 1;
              setScriptsDirty(true);
            }}
            mode={scriptMode}
            sheetCode={data.template.code}
            sheetLabel={data.template.shortName}
            workbook={designApi}
            onClose={() => setRulesOpen(false)}
            className="w-[min(760px,58%)] shrink-0"
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
