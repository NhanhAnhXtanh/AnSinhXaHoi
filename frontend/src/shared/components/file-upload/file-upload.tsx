import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { CircleX, Download, Eye, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";

import { LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

import { checkFiles, formatFileSize, type FileRejection } from "./file-utils";

/** Một tệp trong danh sách — đã lưu trên máy chủ hoặc mới chọn trên máy (chưa gửi). */
export type FileUploadItem = {
  id: string | number;
  name: string;
  /** Byte. */
  size: number;
  /** Dòng phụ dưới tên; bỏ trống thì hiện cỡ tệp. */
  detail?: ReactNode;
  /** Có nút "Xem" (ảnh, PDF mở được trên trình duyệt) — cần thêm `onPreview`. */
  previewable?: boolean;
};

export type FileUploadProps = {
  files: FileUploadItem[];
  /** Tệp đã qua kiểm tra loại / cỡ / số lượng. Bỏ trống cùng `readOnly` = chỉ xem. */
  onAdd?: (files: File[]) => void | Promise<void>;
  onRemove?: (item: FileUploadItem) => void | Promise<void>;
  onDownload?: (item: FileUploadItem) => void | Promise<void>;
  onPreview?: (item: FileUploadItem) => void | Promise<void>;
  /** Đuôi tệp nhận (không dấu chấm), ví dụ `["pdf", "png"]`. Bỏ trống = nhận mọi loại. */
  accept?: string[];
  /** Cách gọi các loại tệp nhận cho người dùng, ví dụ "ảnh JPG, PNG, PDF, Word hoặc Excel". */
  acceptLabel?: string;
  /** Số tệp tối đa (tính cả tệp đã có trong danh sách). */
  maxFiles?: number;
  /** Cỡ tối đa mỗi tệp, byte. */
  maxFileBytes?: number;
  /**
   * Tệp bị loại. Bỏ trống thì câu giải thích hiện ngay dưới ô chọn tệp;
   * truyền vào để tự báo theo cách khác (thông báo nổi, lỗi của ô trong form…).
   */
  onReject?: (rejections: FileRejection[]) => void;
  /** Đang gửi tệp lên: khoá chọn tệp, đổi chữ ô thả. */
  uploading?: boolean;
  /** Đang lấy danh sách tệp. */
  loading?: boolean;
  loadingLabel?: string;
  /** Không lấy được danh sách tệp — hiện câu này kèm nút Thử lại (nếu có `onRetry`). */
  loadError?: ReactNode;
  onRetry?: () => void;
  /** Khoá mọi thao tác (ví dụ trong lúc gửi cả form). */
  disabled?: boolean;
  /** Chỉ xem: không có ô chọn tệp, không có nút Gỡ. */
  readOnly?: boolean;
  /** "dropzone" = ô kéo thả lớn; "button" = chỉ một nút chọn tệp (gọn trong form). */
  variant?: "dropzone" | "button";
  /** Chữ nút chọn tệp. */
  pickLabel?: string;
  /** Dòng gợi ý thay cho câu mặc định về cỡ / loại tệp. */
  hint?: ReactNode;
  /** Câu hiện khi chỉ xem mà chưa có tệp nào. */
  emptyText?: ReactNode;
  /**
   * Danh sách gọn cho hộp thoại nhiều tệp: mỗi tệp một dòng thấp trong một khung chung,
   * dòng đếm số tệp + tổng dung lượng, cao tối đa khoảng 4 dòng rồi cuộn trong khung.
   */
  compact?: boolean;
  className?: string;
};

/**
 * Ô tải tệp dùng chung: kéo thả hoặc chọn tệp, danh sách tệp (Xem / Tải về / Gỡ),
 * giới hạn số tệp và cỡ tệp, trạng thái đang tải / lỗi, chế độ chỉ xem.
 *
 * Component không tự gửi tệp đi đâu: `onAdd` nhận các tệp đã qua kiểm tra, màn gọi
 * tự quyết lưu ngay lên máy chủ (xác nhận Kho bạc) hay giữ lại gửi cùng form
 * (phiếu nộp báo cáo năm). Máy chủ vẫn phải kiểm lại — kiểm ở đây chỉ để báo sớm.
 */
export function FileUpload({
  files,
  onAdd,
  onRemove,
  onDownload,
  onPreview,
  accept,
  acceptLabel,
  maxFiles,
  maxFileBytes,
  onReject,
  uploading = false,
  loading = false,
  loadingLabel = "Đang tải tệp đính kèm…",
  loadError,
  onRetry,
  disabled = false,
  readOnly = false,
  variant = "dropzone",
  pickLabel = "Chọn tệp",
  hint,
  emptyText = "Chưa có tệp nào.",
  compact = false,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejectMessages, setRejectMessages] = useState<string[]>([]);

  const canAdd = !readOnly && onAdd !== undefined;
  const locked = disabled || uploading;
  const maxSize = maxFileBytes ? formatFileSize(maxFileBytes) : null;

  const defaultHint = [
    maxFiles !== undefined ? `Tối đa ${maxFiles} tệp` : null,
    maxSize !== null ? `${maxFiles !== undefined ? "mỗi tệp" : "Mỗi tệp"} không quá ${maxSize}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const hintText =
    hint ??
    [defaultHint ? `${defaultHint}.` : null, acceptLabel ? `Nhận ${acceptLabel}.` : null]
      .filter(Boolean)
      .join(" ");

  const add = async (list: FileList | null) => {
    if (!canAdd || locked || !list || list.length === 0) return;
    const { accepted, rejected } = checkFiles(Array.from(list), {
      existing: files.length,
      accept,
      acceptLabel,
      maxFiles,
      maxFileBytes,
    });
    if (onReject) {
      if (rejected.length > 0) onReject(rejected);
    } else {
      setRejectMessages(rejected.map((r) => r.message));
    }
    if (accepted.length > 0) await onAdd?.(accepted);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void add(e.dataTransfer.files);
  };

  const fileInput = canAdd && (
    <input
      ref={inputRef}
      type="file"
      multiple={maxFiles === undefined || maxFiles > 1}
      hidden
      accept={accept?.map((x) => `.${x}`).join(",")}
      onChange={(e) => {
        const input = e.target;
        void add(input.files).finally(() => {
          input.value = "";
        });
      }}
    />
  );

  const pickButton = (
    <Button
      type="button"
      variant="outline"
      size={variant === "dropzone" ? "sm" : "default"}
      disabled={locked}
      onClick={() => inputRef.current?.click()}
    >
      {uploading && variant === "button" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
      {pickLabel}
    </Button>
  );

  if (loading) return <LoadingState label={loadingLabel} className={className} />;

  if (loadError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border px-4 py-6 text-center text-sm",
          className
        )}
      >
        <p className="text-muted-foreground">{loadError}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {canAdd &&
        (variant === "dropzone" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!locked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "bg-surface-subtle"
            )}
          >
            <span className="bg-card text-muted-foreground flex size-9 items-center justify-center rounded-full border">
              {uploading ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden className="size-4" />
              )}
            </span>
            <p className="text-sm font-medium">{uploading ? "Đang tải tệp lên…" : "Kéo thả tệp vào đây"}</p>
            {hintText && <p className="text-muted-foreground text-xs">{hintText}</p>}
            {pickButton}
            {fileInput}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div>
              {pickButton}
              {fileInput}
            </div>
            {hintText && rejectMessages.length === 0 && (
              <p className="text-muted-foreground text-xs leading-4">{hintText}</p>
            )}
          </div>
        ))}

      {rejectMessages.length > 0 && (
        <ul className="flex flex-col gap-1">
          {rejectMessages.map((m, i) => (
            <li key={i} className="text-destructive-text flex items-start gap-1.5 text-xs leading-4">
              <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
              {m}
            </li>
          ))}
        </ul>
      )}

      {files.length === 0 ? (
        !canAdd && (
          <p className="bg-surface-subtle text-muted-foreground rounded-md px-4 py-10 text-center text-sm">
            {emptyText}
          </p>
        )
      ) : compact ? (
        <div className="overflow-hidden rounded-md border">
          <p className="bg-surface-subtle text-muted-foreground border-b px-3 py-1.5 text-xs">
            {files.length} file · {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
          </p>
          <ul className="max-h-40 divide-y overflow-y-auto">
            {files.map((f) => (
              <li key={f.id} className="flex h-9 items-center gap-2 pr-1 pl-3">
                <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                {/* w-0: tên dài không kéo rộng hộp thoại (lưới tự co theo nội dung), chỉ cắt "…". */}
                <span className="w-0 flex-1 truncate text-sm" title={f.name}>
                  {f.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {f.detail ?? formatFileSize(f.size)}
                </span>
                {onPreview && f.previewable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Xem tệp ${f.name}`}
                    title="Xem"
                    onClick={() => void onPreview(f)}
                  >
                    <Eye aria-hidden />
                  </Button>
                )}
                {onDownload && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Tải về tệp ${f.name}`}
                    title="Tải về"
                    onClick={() => void onDownload(f)}
                  >
                    <Download aria-hidden />
                  </Button>
                )}
                {!readOnly && onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={`Gỡ tệp ${f.name}`}
                    title="Gỡ"
                    onClick={() => {
                      setRejectMessages([]);
                      void onRemove(f);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.name}>
                  {f.name}
                </p>
                <p className="text-muted-foreground text-xs">{f.detail ?? formatFileSize(f.size)}</p>
              </div>
              {onPreview && f.previewable && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void onPreview(f)}>
                  <Eye aria-hidden />
                  Xem
                </Button>
              )}
              {onDownload && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void onDownload(f)}>
                  <Download aria-hidden />
                  Tải về
                </Button>
              )}
              {!readOnly && onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Gỡ tệp ${f.name}`}
                  onClick={() => {
                    setRejectMessages([]);
                    void onRemove(f);
                  }}
                >
                  <Trash2 aria-hidden />
                  Gỡ
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
