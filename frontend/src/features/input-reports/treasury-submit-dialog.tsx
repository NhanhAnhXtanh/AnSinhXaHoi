import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import { FileText, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";

import { LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
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

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** "1,2 MB" / "850 KB" */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
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

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0 || uploading) return;
    setUploading(true);
    let count = files.length;
    try {
      for (const f of Array.from(list)) {
        const ext = extOf(f.name);
        if (!ACCEPTED.includes(ext)) {
          toast.error(`Chưa tải lên được tệp ${f.name}: chỉ nhận ảnh JPG, PNG, tệp PDF, Word hoặc Excel.`);
          continue;
        }
        if (f.size > maxBytes) {
          toast.error(`Chưa tải lên được tệp ${f.name} vì lớn hơn ${maxMb} MB. Bạn hãy thu nhỏ hoặc chụp lại rồi tải lên.`);
          continue;
        }
        if (count >= maxFiles) {
          toast.error(`Mỗi phiếu đính kèm tối đa ${maxFiles} tệp. Bạn hãy gỡ bớt tệp cũ rồi tải lên lại.`);
          break;
        }
        try {
          const saved = await uploadAttachment(reportId, f);
          count += 1;
          setFiles((prev) => [...prev, saved]);
          if (OFFICE.includes(ext)) {
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

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

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

        {loading && !confirmation ? (
          <LoadingState label="Đang tải tệp đã đính kèm…" />
        ) : loadFailed ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-6 text-center text-sm">
            <p className="text-muted-foreground">Chưa tải được tệp đã đính kèm của phiếu.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                dragging ? "border-primary bg-accent" : "bg-surface-subtle"
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground">
                {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              </span>
              <p className="text-sm font-medium">{uploading ? "Đang tải tệp lên…" : "Kéo thả tệp vào đây"}</p>
              <p className="text-xs text-muted-foreground">
                Tối đa {maxMb} MB mỗi tệp. Nhận ảnh JPG, PNG, PDF, Word hoặc Excel.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload />
                Chọn tệp
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={ACCEPTED.map((x) => `.${x}`).join(",")}
                onChange={(e) => {
                  const picked = e.target.files;
                  void addFiles(picked).finally(() => {
                    e.target.value = "";
                  });
                }}
              />
            </div>

            {files.length > 0 && (
              <ul className="flex flex-col gap-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={f.fileName}>
                        {f.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.fileSize)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void download(f)}>
                      Tải về
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void remove(f)}>
                      Gỡ
                    </Button>
                  </li>
                ))}
              </ul>
            )}

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
          </>
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
