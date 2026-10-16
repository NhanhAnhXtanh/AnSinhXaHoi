import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

import { LoadingState, formatDateTime } from "@/shared/components/asxh";
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

/** "1,2 MB" / "850 KB" */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`;
}

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

  const show = async (f: AttachmentRecord, mode: "view" | "download") => {
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

        {failed ? (
          <div className="flex flex-col items-center gap-2 rounded-md border px-4 py-8 text-center text-sm">
            <p className="text-muted-foreground">Chưa tải được tệp đính kèm của phiếu.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Thử lại
            </Button>
          </div>
        ) : files === null ? (
          <LoadingState label="Đang tải tệp đính kèm…" />
        ) : files.length === 0 ? (
          <p className="bg-surface-subtle text-muted-foreground rounded-md px-4 py-10 text-center text-sm">
            Đơn vị chưa đính kèm file xác nhận của Kho bạc.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={f.fileName}>
                    {f.fileName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(f.fileSize)} · Tải lên {formatDateTime(f.createdAt)}
                  </p>
                </div>
                {f.previewable && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void show(f, "view")}>
                    <Eye />
                    Xem
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => void show(f, "download")}>
                  <Download />
                  Tải về
                </Button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
