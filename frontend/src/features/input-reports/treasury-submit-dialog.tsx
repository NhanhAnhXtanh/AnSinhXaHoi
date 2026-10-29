import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { FileUpload, type FileUploadItem } from "@/shared/components/file-upload";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";

import { errorMessage } from "./api";
import {
  deleteAttachment,
  downloadAttachment,
  getTreasuryConfirmation,
  listAttachments,
  setTreasuryConfirmation,
  uploadAttachment,
  type AttachmentRecord,
  type TreasuryConfirmation,
} from "./treasury-api";

/** BR-38.2 — máy chủ kiểm lại cả cỡ, số tệp lẫn nội dung thật của tệp. */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 10;
const ACCEPTED = ["jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx"];
const OFFICE = ["doc", "docx", "xls", "xlsx"];
const ACCEPT_LABEL = "ảnh JPG, PNG, tệp PDF, Word hoặc Excel";

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Hộp "Nộp phiếu lên Sở Tài chính" (UC-38, Figma 310:62145): vùng thả tệp,
 * danh sách tệp (Tải về / Gỡ), ô tích "Đã có phiếu xác nhận của Kho bạc",
 * nút Để sau / Nộp phiếu. Nộp phiếu chỉ sáng khi có tệp VÀ đã tích (BR-38.1).
 *
 * Tệp lưu lên máy chủ ngay khi chọn, ô tích ghi ngay khi bấm — nên bấm "Để sau"
 * rồi mở lại vẫn còn nguyên (UC-38 bước 6). Phiếu bị trả lại phải tải lại tệp và
 * tích lại vì chứng từ cũ không được chép sang phiên bản mới (UC-43).
 */
export function TreasurySubmitDialog({
  reportId,
  open,
  onOpenChange,
  onSubmit,
}: {
  reportId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const checkboxId = useId();

  const [files, setFiles] = useState<AttachmentRecord[]>([]);
  const [confirmation, setConfirmation] = useState<TreasuryConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [list, status] = await Promise.all([listAttachments(reportId), getTreasuryConfirmation(reportId)]);
      setFiles(list);
      setConfirmation(status);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const maxBytes = confirmation?.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = confirmation?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  const confirmed = confirmation?.confirmed ?? false;
  const required = confirmation?.required ?? true;

  /** Tệp đã qua kiểm tra loại / cỡ / số lượng ở `FileUpload`; gửi lần lượt, lỗi tệp nào báo tệp đó. */
  const addFiles = async (picked: File[]) => {
    if (uploading) return;
    setUploading(true);
    try {
      for (const f of picked) {
        try {
          const saved = await uploadAttachment(reportId, f);
          setFiles((prev) => [...prev, saved]);
          if (OFFICE.includes(extOf(f.name))) {
            toast.info(
              `Tệp ${f.name} là Word/Excel nên không xem trước được trên trình duyệt — Sở sẽ phải tải về mới mở được.`
            );
          }
        } catch (error) {
          toast.error(errorMessage(error, `Chưa tải lên được tệp ${f.name}. Bạn thử lại sau ít phút.`));
        }
      }
    } finally {
      setUploading(false);
      // Số tệp và trạng thái "đủ điều kiện" do máy chủ tính lại.
      getTreasuryConfirmation(reportId)
        .then(setConfirmation)
        .catch(() => undefined);
    }
  };

  const remove = async (f: AttachmentRecord) => {
    try {
      await deleteAttachment(reportId, f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      setConfirmation(await getTreasuryConfirmation(reportId));
    } catch (error) {
      toast.error(errorMessage(error, `Chưa gỡ được tệp ${f.fileName}. Bạn thử lại sau ít phút.`));
    }
  };

  const download = async (f: AttachmentRecord) => {
    try {
      await downloadAttachment(reportId, f);
    } catch (error) {
      toast.error(errorMessage(error, `Chưa tải về được tệp ${f.fileName}. Bạn thử lại sau ít phút.`));
    }
  };

  const toggleConfirmed = async (value: boolean) => {
    setSaving(true);
    try {
      setConfirmation(await setTreasuryConfirmation(reportId, value));
    } catch (error) {
      toast.error(errorMessage(error, "Chưa ghi được ô xác nhận. Bạn thử lại sau ít phút."));
    } finally {
      setSaving(false);
    }
  };

  const byId = (item: FileUploadItem) => files.find((f) => f.id === item.id);
  const items: FileUploadItem[] = files.map((f) => ({ id: f.id, name: f.fileName, size: f.fileSize }));

  const ready = !required || (files.length > 0 && confirmed);
  const missing = !required
    ? null
    : files.length === 0 && !confirmed
      ? "Cần tải lên xác nhận của Kho bạc và tích ô xác nhận."
      : files.length === 0
        ? "Cần tải lên xác nhận của Kho bạc."
        : !confirmed
          ? "Cần tích ô xác nhận."
          : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nộp phiếu lên Sở Tài chính</DialogTitle>
          <DialogDescription>Đơn vị cần gửi kèm xác nhận của Kho bạc.</DialogDescription>
        </DialogHeader>

        <FileUpload
          files={items}
          loading={loading && !confirmation}
          loadingLabel="Đang tải tệp đã đính kèm…"
          loadError={loadFailed ? "Chưa tải được tệp đã đính kèm của phiếu." : undefined}
          onRetry={() => void load()}
          uploading={uploading}
          accept={ACCEPTED}
          acceptLabel={ACCEPT_LABEL}
          maxFiles={maxFiles}
          maxFileBytes={maxBytes}
          hint={`Tối đa ${maxMb} MB mỗi tệp. Nhận ảnh JPG, PNG, PDF, Word hoặc Excel.`}
          onReject={(rejections) => {
            for (const r of rejections) {
              toast.error(
                r.reason === "count"
                  ? `Mỗi phiếu đính kèm tối đa ${maxFiles} tệp. Bạn hãy gỡ bớt tệp cũ rồi tải lên lại.`
                  : r.message
              );
            }
          }}
          onAdd={addFiles}
          onDownload={(item) => {
            const f = byId(item);
            if (f) return download(f);
          }}
          onRemove={(item) => {
            const f = byId(item);
            if (f) return remove(f);
          }}
        />

        {!(loading && !confirmation) && !loadFailed && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={checkboxId}
              checked={confirmed}
              disabled={saving}
              onCheckedChange={(v) => void toggleConfirmed(v === true)}
            />
            <Label htmlFor={checkboxId} className="font-normal">
              Đã có phiếu xác nhận của Kho bạc
            </Label>
          </div>
        )}

        <DialogFooter className="items-center">
          {missing && !loading && <p className="me-auto text-xs text-muted-foreground">{missing}</p>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button type="button" disabled={!ready || loading || loadFailed || uploading || saving} onClick={onSubmit}>
            Nộp phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
