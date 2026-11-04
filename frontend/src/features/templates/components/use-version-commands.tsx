import { useState } from "react";
import type { ReactNode } from "react";
import {
  Ban,
  CodeXml,
  CopyPlus,
  Eye,
  Pencil,
  Send,
  Trash,
} from "lucide-react";
import { useCan } from "@refinedev/core";
import { toast } from "sonner";

import {
  ConfirmDialog,
  formatDate,
  type ActionItem,
} from "@/shared/components/asxh";

import type { TemplateActions } from "../api";
import type { TemplateVersion } from "../types";
import {
  canClone,
  canDelete,
  canPublish,
  canRevoke,
  FORM_LOCKED_REASON,
  isEditable,
  previousLiveVersion,
  versionLabel,
} from "../model";
import { PublishDialog } from "./publish-dialog";

/**
 * Các việc trên một phiên bản (menu ⋯ của thẻ phiên bản, nút chân panel, đầu
 * trang Thiết kế mẫu) cùng các hộp xác nhận của chúng — dùng chung cho hai màn
 * để chữ, điều kiện và lý do mờ chỉ viết một lần. Điều kiện ở đây chỉ để làm
 * mờ nút kèm lý do; máy chủ kiểm lại, câu báo của máy chủ hiện thành toast.
 */
export function useVersionCommands({
  actions,
  chainOf,
  onOpenDesigner,
  onCloned,
  onDeleted,
  onPublished,
  onChanged,
  isFormLocked,
}: {
  actions: TemplateActions;
  /** Chuỗi phiên bản của biểu chứa phiên bản này, mới nhất trước. */
  chainOf: (version: TemplateVersion) => TemplateVersion[];
  onOpenDesigner?: (version: TemplateVersion, rules?: boolean) => void;
  onCloned?: (version: TemplateVersion) => void;
  onDeleted?: (version: TemplateVersion) => void;
  onPublished?: (version: TemplateVersion) => void;
  /** Sau mọi thao tác đổi trạng thái thành công (thu hồi). */
  onChanged?: (version: TemplateVersion) => void;
  /** Biểu chứa phiên bản đang khoá cả biểu — làm mờ Ban hành / Thu hồi. */
  isFormLocked?: (version: TemplateVersion) => boolean;
}) {
  const [publishing, setPublishing] = useState<TemplateVersion | null>(null);
  const [revoking, setRevoking] = useState<TemplateVersion | null>(null);
  const [deleting, setDeleting] = useState<TemplateVersion | null>(null);
  // Tên phiên bản trên hộp xác nhận giữ nguyên trong lúc hộp mờ dần khi đóng.
  const [lastRevoke, setLastRevoke] = useState<TemplateVersion | null>(null);
  const [lastDelete, setLastDelete] = useState<TemplateVersion | null>(null);
  const [busy, setBusy] = useState(false);
  // Người chỉ có quyền xem: menu ⋯ chỉ còn "Xem thiết kế", không ban hành / tạo / khoá / xoá.
  const { data: canWriteData } = useCan({ resource: "template_versions", action: "edit" });
  const { data: canDeleteData } = useCan({ resource: "template_versions", action: "delete" });
  const canWrite = canWriteData?.can === true;
  const canDeleteVersion = canDeleteData?.can === true;

  async function clone(version: TemplateVersion) {
    if (busy || !canWrite) return;
    setBusy(true);
    const result = await actions.nextVersion(version.formId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Đã tạo ${versionLabel(result.value).toLowerCase()} (nháp) từ ${versionLabel(version).toLowerCase()}.`
    );
    onCloned?.(result.value);
  }

  async function change(
    version: TemplateVersion,
    action: "revoke",
    done: string
  ) {
    if (busy) return;
    setBusy(true);
    const result = await actions.versionAction(version.id, action);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(done);
    onChanged?.(result.value);
  }

  /** Mục menu ⋯ của một phiên bản (khung 311:82742). */
  function itemsFor(version: TemplateVersion): ActionItem[] {
    if (!canWrite) {
      return [
        {
          key: "design",
          label: "Xem thiết kế",
          icon: Eye,
          onSelect: () => onOpenDesigner?.(version),
        },
      ];
    }
    const chain = chainOf(version);
    const editable = isEditable(version.status);
    // Biểu đang khoá để sửa: vẫn thiết kế, tạo / xoá bản nháp; không ban hành, không thu hồi.
    const formLocked = isFormLocked?.(version) === true;
    const lockedOut = { ok: false as const, reason: FORM_LOCKED_REASON };
    const publish = formLocked && isEditable(version.status) ? lockedOut : canPublish(version);
    const cloneable = canClone(chain, version);
    const revocable = formLocked && version.status === "published" ? lockedOut : canRevoke(chain, version);
    const removable = canDelete(chain, version);
    const items: ActionItem[] = [
      {
        key: "design",
        label: editable ? "Thiết kế biểu" : "Xem thiết kế",
        icon: editable ? Pencil : Eye,
        onSelect: () => onOpenDesigner?.(version),
      },
      {
        key: "rules",
        label: editable ? "Soạn kịch bản của biểu" : "Xem kịch bản của biểu",
        icon: CodeXml,
        onSelect: () => onOpenDesigner?.(version, true),
      },
    ];
    items.push(
      {
        key: "publish",
        label: "Ban hành",
        icon: Send,
        disabled: !publish.ok,
        reason: publish.ok ? undefined : publish.reason,
        onSelect: () => setPublishing(version),
      },
      {
        key: "clone",
        label: "Tạo phiên bản kế tiếp",
        icon: CopyPlus,
        disabled: !cloneable.ok || busy,
        reason: cloneable.ok ? undefined : cloneable.reason,
        onSelect: () => void clone(version),
      },
      {
        key: "revoke",
        label: "Thu hồi phiên bản",
        icon: Ban,
        destructive: true,
        separatorBefore: true,
        disabled: !revocable.ok || busy,
        reason: revocable.ok ? undefined : revocable.reason,
        onSelect: () => {
          setLastRevoke(version);
          setRevoking(version);
        },
      },
      ...(canDeleteVersion ? [{
        key: "delete",
        label: "Xoá phiên bản",
        icon: Trash,
        destructive: true,
        disabled: !removable.ok || busy,
        reason: removable.ok ? undefined : removable.reason,
        onSelect: () => {
          setLastDelete(version);
          setDeleting(version);
        },
      } satisfies ActionItem] : [])
    );
    return items;
  }

  const previous = publishing
    ? previousLiveVersion(chainOf(publishing), publishing)
    : undefined;

  const dialogs: ReactNode = (
    <>
      <PublishDialog
        version={publishing}
        previous={previous}
        onOpenChange={(open) => !open && setPublishing(null)}
        onSubmit={async (version, iso) => {
          const result = await actions.versionAction(version.id, "publish", {
            effectiveFrom: iso,
          });
          if (!result.ok) return result.error;
          toast.success(
            `Đã ban hành ${versionLabel(version).toLowerCase()}, áp dụng từ ${formatDate(iso)}.`
          );
          setPublishing(null);
          onPublished?.(result.value);
          return null;
        }}
      />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Thu hồi ${lastRevoke ? versionLabel(lastRevoke).toLowerCase() : "phiên bản"}?`}
        description="Thu hồi là VĨNH VIỄN: phiên bản này không dùng lại được và không ban hành lại được. Hệ thống tự dùng lại phiên bản đã ban hành liền trước. Phiếu đã lập theo phiên bản này vẫn giữ nguyên số liệu. Chỉ thu hồi khi phiên bản bị ban hành nhầm."
        confirmLabel="Thu hồi phiên bản"
        destructive
        onConfirm={() => {
          if (!revoking) return;
          const target = revoking;
          setRevoking(null);
          void change(target, "revoke", `Đã thu hồi ${versionLabel(target).toLowerCase()}.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xoá ${lastDelete ? versionLabel(lastDelete).toLowerCase() : "phiên bản"}?`}
        description="Toàn bộ biểu mẫu đã thiết kế trong phiên bản này sẽ bị xoá và không khôi phục được."
        confirmLabel="Xoá phiên bản"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          setDeleting(null);
          void (async () => {
            setBusy(true);
            const result = await actions.deleteVersion(target.id);
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`Đã xoá ${versionLabel(target).toLowerCase()}.`);
            onDeleted?.(target);
          })();
        }}
      />
    </>
  );

  return {
    itemsFor,
    dialogs,
    busy,
    /** Có quyền sửa phiên bản (ban hành, tạo phiên bản kế tiếp, khoá biểu…). */
    canWrite,
    requestPublish: (v: TemplateVersion) => {
      if (!canWrite) return;
      if (isFormLocked?.(v)) {
        toast.error(FORM_LOCKED_REASON);
        return;
      }
      setPublishing(v);
    },
    clone: (v: TemplateVersion) => void clone(v),
  };
}
