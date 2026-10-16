import { useState } from "react";
import type { ReactNode } from "react";
import {
  CodeXml,
  CopyPlus,
  Eye,
  Lock,
  LockOpen,
  Pencil,
  Send,
  Trash,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  formatDate,
  type ActionItem,
} from "@/shared/components/asxh";

import type { TemplateVersion } from "../fixtures";
import {
  canClone,
  canDelete,
  canLock,
  canPublish,
  isEditable,
  previousLiveVersion,
  versionLabel,
  versionsOf,
} from "../model";
import {
  cloneVersion,
  deleteVersion,
  toggleLock,
  useTemplateState,
} from "../store";
import { PublishDialog } from "./publish-dialog";

/**
 * Các việc trên một phiên bản (menu ⋯ của thẻ phiên bản, nút chân panel, đầu
 * trang Thiết kế mẫu) cùng các hộp xác nhận của chúng — dùng chung cho hai màn
 * để chữ, điều kiện và lý do mờ chỉ viết một lần.
 */
export function useVersionCommands({
  onOpenDesigner,
  onCloned,
  onDeleted,
  onPublished,
}: {
  onOpenDesigner?: (version: TemplateVersion, rules?: boolean) => void;
  onCloned?: (version: TemplateVersion) => void;
  onDeleted?: (version: TemplateVersion) => void;
  onPublished?: (version: TemplateVersion) => void;
}) {
  const state = useTemplateState();
  const [publishing, setPublishing] = useState<TemplateVersion | null>(null);
  const [locking, setLocking] = useState<TemplateVersion | null>(null);
  const [deleting, setDeleting] = useState<TemplateVersion | null>(null);
  // Tên phiên bản trên hộp xác nhận giữ nguyên trong lúc hộp mờ dần khi đóng.
  const [lastLock, setLastLock] = useState<TemplateVersion | null>(null);
  const [lastDelete, setLastDelete] = useState<TemplateVersion | null>(null);
  const askLock = (v: TemplateVersion) => {
    setLastLock(v);
    setLocking(v);
  };
  const askDelete = (v: TemplateVersion) => {
    setLastDelete(v);
    setDeleting(v);
  };

  const chainOf = (v: TemplateVersion) => versionsOf(state.versions, v.formId);

  function clone(version: TemplateVersion) {
    const result = cloneVersion(version.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Đã tạo ${versionLabel(result.value).toLowerCase()} (nháp) từ ${versionLabel(version).toLowerCase()}.`
    );
    onCloned?.(result.value);
  }

  function lockOrUnlock(version: TemplateVersion) {
    if (version.status === "published") {
      askLock(version);
      return;
    }
    // Mở khoá không hỏi lại (UC-15).
    const result = toggleLock(version.id);
    if (!result.ok) toast.error(result.error);
    else toast.success(`Đã mở khoá ${versionLabel(version).toLowerCase()}.`);
  }

  /** Mục menu ⋯ của một phiên bản (khung 311:82742). */
  function itemsFor(version: TemplateVersion): ActionItem[] {
    const chain = chainOf(version);
    const editable = isEditable(version.status);
    const publish = canPublish(version);
    const cloneable = canClone(chain, version);
    const lockable = canLock(chain, version);
    const removable = canDelete(chain, version);
    const locked = version.status === "locked";

    return [
      {
        key: "design",
        label: editable ? "Thiết kế biểu" : "Xem thiết kế",
        icon: editable ? Pencil : Eye,
        onSelect: () => onOpenDesigner?.(version),
      },
      {
        key: "rules",
        label: "Soạn công thức và quy tắc nhập",
        icon: CodeXml,
        disabled: !editable,
        reason: editable ? undefined : "Chỉ sửa được ở phiên bản nháp.",
        onSelect: () => onOpenDesigner?.(version, true),
      },
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
        disabled: !cloneable.ok,
        reason: cloneable.ok ? undefined : cloneable.reason,
        onSelect: () => clone(version),
      },
      {
        key: "lock",
        label: locked ? "Mở khoá phiên bản" : "Khoá phiên bản",
        icon: locked ? LockOpen : Lock,
        disabled: !lockable.ok,
        reason: lockable.ok ? undefined : lockable.reason,
        onSelect: () => lockOrUnlock(version),
      },
      {
        key: "delete",
        label: "Xoá phiên bản",
        icon: Trash,
        destructive: true,
        separatorBefore: true,
        disabled: !removable.ok,
        reason: removable.ok ? undefined : removable.reason,
        onSelect: () => askDelete(version),
      },
    ];
  }

  const previous = publishing
    ? previousLiveVersion(chainOf(publishing), publishing)
    : undefined;

  const dialogs: ReactNode = (
    <>
      <PublishDialog
        version={publishing}
        previousLabel={
          previous?.effectiveFrom
            ? `${versionLabel(previous).toLowerCase()} (${formatDate(previous.effectiveFrom)})`
            : undefined
        }
        onOpenChange={(open) => !open && setPublishing(null)}
        onPublished={onPublished}
      />

      <ConfirmDialog
        open={locking !== null}
        onOpenChange={(open) => !open && setLocking(null)}
        title={`Khoá ${lastLock ? versionLabel(lastLock).toLowerCase() : "phiên bản"}?`}
        description="Sau khi khoá, phiên bản này không còn được chọn cho các đợt báo cáo mới. Phiếu đã lập theo phiên bản này vẫn nhập và duyệt bình thường. Bạn có thể mở khoá lại bất cứ lúc nào."
        confirmLabel="Khoá phiên bản"
        onConfirm={() => {
          if (!locking) return;
          const result = toggleLock(locking.id);
          if (!result.ok) toast.error(result.error);
          else toast.success(`Đã khoá ${versionLabel(locking).toLowerCase()}.`);
          setLocking(null);
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
          const result = deleteVersion(target.id);
          if (!result.ok) toast.error(result.error);
          else {
            toast.success(`Đã xoá ${versionLabel(target).toLowerCase()}.`);
            onDeleted?.(target);
          }
          setDeleting(null);
        }}
      />
    </>
  );

  return {
    itemsFor,
    dialogs,
    requestPublish: (v: TemplateVersion) => setPublishing(v),
    clone,
  };
}
