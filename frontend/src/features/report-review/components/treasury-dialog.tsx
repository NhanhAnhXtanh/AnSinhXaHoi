import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/shared/components/asxh";
import { FileUpload, formatFileSize, type FileUploadItem } from "@/shared/components/file-upload";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { errorMessage } from "../api";
import { listAttachments, openAttachment, type AttachmentRecord } from "../treasury-api";

/**
 * Xem file xác nhận của Kho bạc đơn vị đính kèm khi nộp (UC-40 bước 3): ảnh / PDF
 * mở xem ở thẻ mới, Word / Excel tải về máy.
 */
export function TreasuryDialog({
  reportId,
  periodName,
  unitName,
  open,
  onOpenChange,
}: {
  reportId: number;
  periodName: string;
  unitName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [files, setFiles] = useState<AttachmentRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setFiles(await listAttachments(reportId));
    } catch {
      setFailed(true);
    }
  }, [reportId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const show = async (item: FileUploadItem, mode: "view" | "download") => {
    const f = files?.find((x) => x.id === item.id);
    if (!f) return;
    try {
      await openAttachment(reportId, f, mode);
    } catch (error) {
      toast.error(errorMessage(error, `Chưa mở được tệp ${f.fileName}. Bạn thử lại sau ít phút.`));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader className="text-left">
          <DialogTitle>Xác nhận của Kho bạc</DialogTitle>
          <DialogDescription>
            Phiếu {periodName} · {unitName}
          </DialogDescription>
        </DialogHeader>

        <FileUpload
          readOnly
          files={(files ?? []).map((f) => ({
            id: f.id,
            name: f.fileName,
            size: f.fileSize,
            detail: `${formatFileSize(f.fileSize)} · Tải lên ${formatDateTime(f.createdAt)}`,
            previewable: f.previewable,
          }))}
          loading={files === null && !failed}
          loadError={failed ? "Chưa tải được tệp đính kèm của phiếu." : undefined}
          onRetry={() => void load()}
          emptyText="Đơn vị chưa đính kèm file xác nhận của Kho bạc."
          onPreview={(item) => show(item, "view")}
          onDownload={(item) => show(item, "download")}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
