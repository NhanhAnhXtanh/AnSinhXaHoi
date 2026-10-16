import { useId, useRef, useState, type DragEvent } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

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

import type { TreasuryFile } from "./model";

/** BR-38.2 */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
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
 * Tệp và ô tích được giữ lại khi bấm "Để sau".
 */
export function TreasurySubmitDialog({
  open,
  onOpenChange,
  files,
  onFilesChange,
  confirmed,
  onConfirmedChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: TreasuryFile[];
  onFilesChange: (files: TreasuryFile[]) => void;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const checkboxId = useId();

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = extOf(f.name);
      if (!ACCEPTED.includes(ext)) {
        toast.error(`Chưa tải lên được tệp ${f.name}: chỉ nhận ảnh JPG, PNG, tệp PDF, Word hoặc Excel.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`Chưa tải lên được tệp ${f.name} vì lớn hơn 10 MB. Bạn hãy thu nhỏ hoặc chụp lại rồi tải lên.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`Mỗi phiếu đính kèm tối đa ${MAX_FILES} tệp. Bạn hãy gỡ bớt tệp cũ rồi tải lên lại.`);
        break;
      }
      next.push({ id: `${Date.now()}-${next.length}-${f.name}`, name: f.name, size: f.size, file: f });
      if (OFFICE.includes(ext)) {
        toast.info(
          `Tệp ${f.name} là Word/Excel nên không xem trước được trên trình duyệt — Sở sẽ phải tải về mới mở được.`
        );
      }
    }
    if (next.length !== files.length) onFilesChange(next);
  };

  const download = (f: TreasuryFile) => {
    if (!f.file) {
      toast.info(`Tệp ${f.name} chưa tải về được trong bản thử nghiệm này.`);
      return;
    }
    const url = URL.createObjectURL(f.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const ready = files.length > 0 && confirmed;
  const missing =
    files.length === 0 && !confirmed
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
            <Upload className="size-4" />
          </span>
          <p className="text-sm font-medium">Kéo thả tệp vào đây</p>
          <p className="text-xs text-muted-foreground">
            Tối đa 10 MB mỗi tệp. Nhận ảnh JPG, PNG, PDF, Word hoặc Excel.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
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
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => download(f)}>
                  Tải về
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilesChange(files.filter((x) => x.id !== f.id))}
                >
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
            onCheckedChange={(v) => onConfirmedChange(v === true)}
          />
          <Label htmlFor={checkboxId} className="font-normal">
            Đã có phiếu xác nhận của Kho bạc
          </Label>
        </div>

        <DialogFooter className="items-center">
          {missing && <p className="me-auto text-xs text-muted-foreground">{missing}</p>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button type="button" disabled={!ready} onClick={onSubmit}>
            Nộp phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
