import { useEffect, useMemo, useState } from "react";
import { FolderPen, FolderPlus, Inbox, Plus, RotateCw, Trash, TriangleAlert } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  type ActionItem,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/ui/sheet";

import { useSetContent, useTemplateActions, useTemplateSets } from "./api";
import type { TemplateForm, TemplateSet, TemplateVersion } from "./types";
import { buildChangeLog, currentVersion, formLabel, versionsOf } from "./model";
import { CreateFormDialog } from "./components/create-form-dialog";
import { FormsPanel, type FormRow } from "./components/forms-panel";
import { SetDialog } from "./components/set-dialog";
import { SetListPanel } from "./components/set-list-panel";
import { useMediaQuery } from "./components/use-media-query";
import { useVersionCommands } from "./components/use-version-commands";
import { VersionPanel } from "./components/version-panel";

/** Từ bề rộng cửa sổ này trở lên mới đủ chỗ cho ba cột; hẹp hơn thì cột phải thành ngăn trượt. */
const THREE_COLUMNS = "(min-width: 1600px)";

const TITLE = "Bộ biểu mẫu";
const DESCRIPTION = "Quản lý các bộ mẫu báo cáo và biểu mẫu thành phần.";

/**
 * Bộ biểu mẫu (UC-09..17; khung Figma 310:72834 và các khung 311:*).
 *
 * Ba cột: danh sách bộ mẫu | biểu của bộ (tab Biểu mẫu / Lịch sử thay đổi) |
 * lịch sử phiên bản của biểu đang chọn. Bộ / biểu / phiên bản đang chọn nằm
 * trên địa chỉ trang (?set=&form=&version=) để màn Thiết kế mẫu quay về đúng chỗ.
 * Dữ liệu từ /api/template_sets, /api/templates, /api/template_versions.
 */
export function TemplateSets() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery(THREE_COLUMNS);
  const actions = useTemplateActions();

  const setsQuery = useTemplateSets();
  const sets = setsQuery.sets;

  const [setDialog, setSetDialog] = useState<{ open: boolean; editing: TemplateSet | null }>({
    open: false,
    editing: null,
  });
  const [createFormIn, setCreateFormIn] = useState<TemplateSet | null>(null);
  const [deletingSet, setDeletingSet] = useState<TemplateSet | null>(null);
  const [lastDeletingSet, setLastDeletingSet] = useState<TemplateSet | null>(null);
  const [deletingForm, setDeletingForm] = useState<TemplateForm | null>(null);
  const [lastDeletingForm, setLastDeletingForm] = useState<TemplateForm | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ---------------- chọn bộ / biểu / phiên bản ---------------- */

  const selectedSet = sets.find((s) => s.id === params.get("set")) ?? sets[0] ?? null;
  const content = useSetContent(selectedSet?.id ?? null);

  const rows: FormRow[] = useMemo(
    () =>
      content.forms.map((form) => {
        const chain = versionsOf(content.versions, form.id);
        return { form, chain, current: currentVersion(chain) };
      }),
    [content.forms, content.versions]
  );

  const selectedRow =
    rows.find((r) => r.form.id === params.get("form")) ?? rows[0] ?? null;
  const chain = selectedRow?.chain ?? [];
  const selectedVersionId =
    chain.find((v) => v.id === params.get("version"))?.id ?? chain[0]?.id ?? null;

  const logs = useMemo(
    () => (selectedSet ? buildChangeLog(selectedSet, content.forms, content.versions) : []),
    [selectedSet, content.forms, content.versions]
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

  function designerPath(versionId: string, rules = false) {
    return `/templates/designer/${versionId}${rules ? "?rules=1" : ""}`;
  }

  const commands = useVersionCommands({
    actions,
    chainOf: (v) => versionsOf(content.versions, v.formId),
    onOpenDesigner: (version, rules) => navigate(designerPath(version.id, rules)),
    onCloned: (version) => select({ version: version.id }),
    onDeleted: () => select({ version: null }),
    onPublished: (version) => select({ version: version.id }),
  });

  /* ---------------- đầu trang ---------------- */

  const templateCount = selectedSet?.templateCount ?? 0;
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
      disabled: !selectedSet || templateCount > 0,
      reason:
        templateCount > 0
          ? `Còn ${templateCount} biểu — xoá từng biểu trước.`
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
        actions={actions}
        open={setDialog.open}
        editing={setDialog.editing}
        onOpenChange={(open) => setSetDialog((s) => ({ ...s, open }))}
        onSaved={(set) => select({ set: set.id })}
      />

      <CreateFormDialog
        actions={actions}
        set={createFormIn}
        onOpenChange={(open) => !open && setCreateFormIn(null)}
        onCreated={({ form, firstVersionId }, openDesigner) => {
          if (openDesigner && firstVersionId) {
            navigate(designerPath(firstVersionId));
            return;
          }
          const p = new URLSearchParams(params);
          p.set("set", form.setId);
          p.set("form", form.id);
          if (firstVersionId) p.set("version", firstVersionId);
          else p.delete("version");
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
          setDeletingSet(null);
          void actions.deleteSet(target.id).then((result) => {
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`Đã xoá bộ mẫu “${target.name}”.`);
            setParams(new URLSearchParams(), { replace: true });
          });
        }}
      />

      <ConfirmDialog
        open={deletingForm !== null}
        onOpenChange={(open) => !open && setDeletingForm(null)}
        title={`Xoá ${lastDeletingForm ? formLabel(lastDeletingForm).toLowerCase() : "biểu"}?`}
        description="Biểu và các phiên bản nháp của biểu sẽ bị xoá, không khôi phục được."
        confirmLabel="Xoá biểu"
        destructive
        onConfirm={() => {
          if (!deletingForm) return;
          const target = deletingForm;
          setDeletingForm(null);
          void actions.deleteForm(target.id).then((result) => {
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`Đã xoá ${formLabel(target).toLowerCase()}.`);
            select({ form: null });
          });
        }}
      />

      {commands.dialogs}
    </>
  );

  /* ---------------- đang tải / lỗi ---------------- */

  if (setsQuery.isLoading) {
    return (
      <AsxhPage title={TITLE} description={DESCRIPTION} fill>
        <div className="bg-card flex min-h-0 flex-1 rounded-lg border shadow-e1">
          <LoadingState label="Đang tải bộ mẫu…" />
        </div>
      </AsxhPage>
    );
  }

  if (setsQuery.isError) {
    return (
      <AsxhPage title={TITLE} description={DESCRIPTION} fill>
        <div className="bg-card flex min-h-0 flex-1 rounded-lg border shadow-e1">
          <EmptyState
            icon={TriangleAlert}
            title="Không tải được danh sách bộ mẫu"
            description="Kiểm tra kết nối mạng rồi thử lại."
            action={
              <Button variant="outline" onClick={() => void setsQuery.refetch()}>
                <RotateCw aria-hidden />
                Thử lại
              </Button>
            }
          />
        </div>
      </AsxhPage>
    );
  }

  /* ---------------- chưa có bộ mẫu nào (khung 311:90290) ---------------- */

  if (!selectedSet) {
    return (
      <AsxhPage title={TITLE} description={DESCRIPTION} fill>
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
      onOpenDesigner={(v: TemplateVersion) => navigate(designerPath(v.id))}
      onPublish={commands.requestPublish}
      onClone={commands.clone}
      className={className}
    />
  );

  const middle = content.isLoading ? (
    <section className="bg-card flex min-h-0 min-w-0 flex-col rounded-lg border shadow-e1">
      <LoadingState label="Đang tải biểu mẫu…" />
    </section>
  ) : content.isError ? (
    <section className="bg-card flex min-h-0 min-w-0 flex-col rounded-lg border shadow-e1">
      <EmptyState
        icon={TriangleAlert}
        title="Không tải được biểu của bộ mẫu"
        description="Kiểm tra kết nối mạng rồi thử lại."
        action={
          <Button variant="outline" onClick={content.refetch}>
            <RotateCw aria-hidden />
            Thử lại
          </Button>
        }
      />
    </section>
  ) : (
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
      onOpenDesigner={(v) => navigate(designerPath(v.id))}
      onPublish={commands.requestPublish}
      onClone={commands.clone}
      onDeleteForm={(form) => {
        setLastDeletingForm(form);
        setDeletingForm(form);
      }}
    />
  );

  return (
    <AsxhPage
      title={TITLE}
      description={DESCRIPTION}
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
          sets={sets}
          formCount={(id) => sets.find((s) => s.id === id)?.templateCount ?? 0}
          selectedId={selectedSet.id}
          onSelect={(id) => select({ set: id })}
        />

        {middle}

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
