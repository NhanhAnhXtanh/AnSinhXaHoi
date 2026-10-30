import { useState } from "react";
import type { ReactNode } from "react";
import {
  Ban,
  CodeXml,
  CopyPlus,
  Eye,
  FlaskConical,
  Lock,
  LockOpen,
  Pencil,
  Send,
  Trash,
  Undo2,
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
  canLock,
  canPublish,
  canRevoke,
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
}: {
  actions: TemplateActions;
  /** Chuỗi phiên bản của biểu chứa phiên bản này, mới nhất trước. */
  chainOf: (version: TemplateVersion) => TemplateVersion[];
  onOpenDesigner?: (version: TemplateVersion, rules?: boolean) => void;
  onCloned?: (version: TemplateVersion) => void;
  onDeleted?: (version: TemplateVersion) => void;
  onPublished?: (version: TemplateVersion) => void;
  /** Sau mọi thao tác đổi trạng thái thành công (khoá, mở khoá, thu hồi, thử nghiệm). */
  onChanged?: (version: TemplateVersion) => void;
}) {
  const [publishing, setPublishing] = useState<TemplateVersion | null>(null);
  const [locking, setLocking] = useState<TemplateVersion | null>(null);
  const [revoking, setRevoking] = useState<TemplateVersion | null>(null);
  const [deleting, setDeleting] = useState<TemplateVersion | null>(null);
  // Tên phiên bản trên hộp xác nhận giữ nguyên trong lúc hộp mờ dần khi đóng.
  const [lastLock, setLastLock] = useState<TemplateVersion | null>(null);
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
    action: "lock" | "unlock" | "revoke" | "start_testing" | "stop_testing",
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

  function lockOrUnlock(version: TemplateVersion) {
    if (version.status === "published") {
      setLastLock(version);
      setLocking(version);
      return;
    }
    // Mở khoá không hỏi lại (UC-15).
    void change(version, "unlock", `Đã mở khoá ${versionLabel(version).toLowerCase()}.`);
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
    const publish = canPublish(version);
    const cloneable = canClone(chain, version);
    const lockable = canLock(chain, version);
    const revocable = canRevoke(chain, version);
    const removable = canDelete(chain, version);
    const locked = version.status === "locked";
    const testing = version.status === "testing";

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
    if (editable) {
      items.push({
        key: "testing",
        label: testing ? "Trả về nháp" : "Chuyển sang thử nghiệm",
        icon: testing ? Undo2 : FlaskConical,
        disabled: busy,
        onSelect: () =>
          void change(
            version,
            testing ? "stop_testing" : "start_testing",
            testing
              ? `Đã trả ${versionLabel(version).toLowerCase()} về nháp.`
              : `Đã chuyển ${versionLabel(version).toLowerCase()} sang thử nghiệm.`
          ),
      });
    }
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
        key: "lock",
        label: locked ? "Mở khoá phiên bản" : "Khoá phiên bản",
        icon: locked ? LockOpen : Lock,
        disabled: !lockable.ok || busy,
        reason: lockable.ok ? undefined : lockable.reason,
        onSelect: () => lockOrUnlock(version),
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
        open={locking !== null}
        onOpenChange={(open) => !open && setLocking(null)}
        title={`Khoá ${lastLock ? versionLabel(lastLock).toLowerCase() : "phiên bản"}?`}
        description="Sau khi khoá, phiên bản này không còn được chọn cho các đợt báo cáo mới. Phiếu đã lập theo phiên bản này vẫn nhập và duyệt bình thường. Bạn có thể mở khoá lại bất cứ lúc nào."
        confirmLabel="Khoá phiên bản"
        onConfirm={() => {
          if (!locking) return;
          const target = locking;
          setLocking(null);
          void change(target, "lock", `Đã khoá ${versionLabel(target).toLowerCase()}.`);
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
    /** Có quyền sửa phiên bản (ban hành, tạo phiên bản kế tiếp, khoá…). */
    canWrite,
    requestPublish: (v: TemplateVersion) => {
      if (canWrite) setPublishing(v);
    },
    clone: (v: TemplateVersion) => void clone(v),
  };
}
