import { useEffect, useMemo, useState } from "react";
import { FolderPen, FolderPlus, Inbox, Plus, Trash } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  type ActionItem,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/ui/sheet";

import type { TemplateSet, TemplateVersion } from "./fixtures";
import { currentVersion, formLabel, versionsOf } from "./model";
import { deleteSet, useTemplateState, versionCountOfSet } from "./store";
import { CreateFormDialog } from "./components/create-form-dialog";
import { FormsPanel, type FormRow } from "./components/forms-panel";
import { SetDialog } from "./components/set-dialog";
import { SetListPanel } from "./components/set-list-panel";
import { useMediaQuery } from "./components/use-media-query";
import { useVersionCommands } from "./components/use-version-commands";
import { VersionPanel } from "./components/version-panel";

/** Từ bề rộng cửa sổ này trở lên mới đủ chỗ cho ba cột; hẹp hơn thì cột phải thành ngăn trượt. */
const THREE_COLUMNS = "(min-width: 1600px)";

/**
 * Bộ biểu mẫu (UC-09..16; khung Figma 310:72834 và các khung 311:*).
 *
 * Ba cột: danh sách bộ mẫu | biểu của bộ (tab Biểu mẫu / Lịch sử thay đổi) |
 * lịch sử phiên bản của biểu đang chọn. Bộ / biểu / phiên bản đang chọn nằm
 * trên địa chỉ trang (?set=&form=&version=) để màn Thiết kế mẫu quay về đúng chỗ.
 */
export function TemplateSets() {
  const navigate = useNavigate();
  const state = useTemplateState();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery(THREE_COLUMNS);

  const [setDialog, setSetDialog] = useState<{ open: boolean; editing: TemplateSet | null }>({
    open: false,
    editing: null,
  });
  const [createFormIn, setCreateFormIn] = useState<TemplateSet | null>(null);
  const [deletingSet, setDeletingSet] = useState<TemplateSet | null>(null);
  const [lastDeletingSet, setLastDeletingSet] = useState<TemplateSet | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ---------------- chọn bộ / biểu / phiên bản ---------------- */

  const selectedSet =
    state.sets.find((s) => s.id === params.get("set")) ?? state.sets[0] ?? null;

  const rows: FormRow[] = useMemo(() => {
    if (!selectedSet) return [];
    return state.forms
      .filter((f) => f.setId === selectedSet.id)
      .map((form) => {
        const chain = versionsOf(state.versions, form.id);
        return { form, chain, current: currentVersion(chain) };
      });
  }, [state.forms, state.versions, selectedSet]);

  const selectedRow =
    rows.find((r) => r.form.id === params.get("form")) ?? rows[0] ?? null;
  const chain = selectedRow?.chain ?? [];
  const selectedVersionId =
    chain.find((v) => v.id === params.get("version"))?.id ?? chain[0]?.id ?? null;

  const logs = useMemo(
    () => (selectedSet ? state.logs.filter((l) => l.setId === selectedSet.id) : []),
    [state.logs, selectedSet]
  );

  function select(next: { set?: string; form?: string | null; version?: string | null }) {
    const p = new URLSearchParams(params);
    if (next.set !== undefined) {
      p.set("set", next.set);
      p.delete("form");
      p.delete("version");
    }
    if (next.form !== undefined) {
      if (next.form) p.set("form", next.form);
      else p.delete("form");
      p.delete("version");
    }
    if (next.version !== undefined) {
      if (next.version) p.set("version", next.version);
      else p.delete("version");
    }
    setParams(p, { replace: true });
  }

  // Màn rộng ra đủ ba cột thì đóng ngăn trượt.
  useEffect(() => {
    if (wide) setDetailOpen(false);
  }, [wide]);

  /* ---------------- việc trên phiên bản ---------------- */

  function designerPath(version: TemplateVersion, rules = false) {
    return `/templates/designer/${version.id}${rules ? "?rules=1" : ""}`;
  }

  const commands = useVersionCommands({
    onOpenDesigner: (version, rules) => navigate(designerPath(version, rules)),
    onCloned: (version) => select({ version: version.id }),
    onDeleted: () => select({ version: null }),
    onPublished: (version) => select({ version: version.id }),
  });

  /* ---------------- đầu trang ---------------- */

  const versionCount = selectedSet ? versionCountOfSet(selectedSet.id) : 0;
  const headerItems: ActionItem[] = [
    {
      key: "create-set",
      label: "Tạo bộ mẫu",
      icon: FolderPlus,
      onSelect: () => setSetDialog({ open: true, editing: null }),
    },
    {
      key: "edit-set",
      label: "Sửa bộ mẫu",
      icon: FolderPen,
      disabled: !selectedSet,
      onSelect: () => selectedSet && setSetDialog({ open: true, editing: selectedSet }),
    },
    {
      key: "delete-set",
      label: "Xoá bộ mẫu",
      icon: Trash,
      destructive: true,
      separatorBefore: true,
      disabled: !selectedSet || versionCount > 0,
      reason:
        versionCount > 0
          ? `Còn ${versionCount} phiên bản — xoá từng phiên bản trước.`
          : undefined,
      onSelect: () => {
        if (!selectedSet) return;
        setLastDeletingSet(selectedSet);
        setDeletingSet(selectedSet);
      },
    },
  ];

  const dialogs = (
    <>
      <SetDialog
        open={setDialog.open}
        editing={setDialog.editing}
        onOpenChange={(open) => setSetDialog((s) => ({ ...s, open }))}
        onSaved={(set) => select({ set: set.id })}
      />

      <CreateFormDialog
        set={createFormIn}
        onOpenChange={(open) => !open && setCreateFormIn(null)}
        onCreated={({ form, version }, openDesigner) => {
          if (openDesigner) {
            navigate(designerPath(version));
            return;
          }
          const p = new URLSearchParams(params);
          p.set("set", form.setId);
          p.set("form", form.id);
          p.set("version", version.id);
          setParams(p, { replace: true });
          if (!wide) setDetailOpen(true);
        }}
      />

      <ConfirmDialog
        open={deletingSet !== null}
        onOpenChange={(open) => !open && setDeletingSet(null)}
        title={`Xoá bộ mẫu “${lastDeletingSet?.name ?? ""}”?`}
        description="Bộ mẫu sẽ bị xoá khỏi danh sách và không khôi phục được."
        confirmLabel="Xoá bộ mẫu"
        destructive
        onConfirm={() => {
          if (!deletingSet) return;
          const target = deletingSet;
          const result = deleteSet(target.id);
          if (!result.ok) toast.error(result.error);
          else {
            toast.success(`Đã xoá bộ mẫu “${target.name}”.`);
            const p = new URLSearchParams();
            setParams(p, { replace: true });
          }
          setDeletingSet(null);
        }}
      />

      {commands.dialogs}
    </>
  );

  /* ---------------- chưa có bộ mẫu nào (khung 311:90290) ---------------- */

  if (!selectedSet) {
    return (
      <AsxhPage
        title="Bộ biểu mẫu"
        description="Quản lý các bộ mẫu báo cáo và biểu mẫu thành phần."
        fill
      >
        <div className="bg-card flex min-h-0 flex-1 items-center justify-center rounded-lg border p-6 shadow-e1">
          <div className="w-full max-w-md rounded-lg border border-dashed">
            <EmptyState
              icon={Inbox}
              title="Chưa có bộ mẫu nào"
              description="Tạo bộ mẫu đầu tiên, rồi thêm các biểu mẫu vào bộ."
              action={
                <Button onClick={() => setSetDialog({ open: true, editing: null })}>
                  <Plus aria-hidden />
                  Tạo bộ mẫu
                </Button>
              }
            />
          </div>
        </div>
        {dialogs}
      </AsxhPage>
    );
  }

  /* ---------------- ba cột ---------------- */

  const versionPanel = (className?: string) => (
    <VersionPanel
      form={selectedRow?.form ?? null}
      chain={chain}
      selectedId={selectedVersionId}
      onSelect={(id) => select({ version: id })}
      itemsFor={commands.itemsFor}
      onOpenDesigner={(v) => navigate(designerPath(v))}
      onPublish={commands.requestPublish}
      onClone={commands.clone}
      className={className}
    />
  );

  return (
    <AsxhPage
      title="Bộ biểu mẫu"
      description="Quản lý các bộ mẫu báo cáo và biểu mẫu thành phần."
      fill
      actions={
        <HeaderActions
          primary={{
            label: "Tạo biểu mẫu",
            icon: Plus,
            onClick: () => setCreateFormIn(selectedSet),
          }}
          items={headerItems}
        />
      }
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] grid-cols-[minmax(240px,280px)_minmax(0,1fr)] gap-4 min-[1600px]:grid-cols-[280px_minmax(0,1fr)_400px]">
        <SetListPanel
          sets={state.sets}
          formCount={(id) => state.forms.filter((f) => f.setId === id).length}
          selectedId={selectedSet.id}
          onSelect={(id) => select({ set: id })}
        />

        <FormsPanel
          set={selectedSet}
          rows={rows}
          logs={logs}
          selectedFormId={selectedRow?.form.id ?? null}
          onSelectForm={(formId) => {
            select({ form: formId });
            if (!wide) setDetailOpen(true);
          }}
          onCreateForm={() => setCreateFormIn(selectedSet)}
          onOpenDesigner={(v) => navigate(designerPath(v))}
          onPublish={commands.requestPublish}
          onClone={commands.clone}
        />

        {wide && versionPanel()}
      </div>

      {!wide && (
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right" className="w-[400px] gap-0 p-0 sm:max-w-[400px]">
            <SheetTitle className="sr-only">
              {selectedRow ? `Phiên bản của ${formLabel(selectedRow.form)}` : "Chi tiết biểu"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Lịch sử phiên bản và các việc trên từng phiên bản.
            </SheetDescription>
            {versionPanel("h-full rounded-none border-0 shadow-none")}
          </SheetContent>
        </Sheet>
      )}

      {dialogs}
    </AsxhPage>
  );
}
