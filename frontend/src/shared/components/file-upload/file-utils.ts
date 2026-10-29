// Kiểm tra và hiển thị cỡ tệp — tách khỏi file-upload.tsx để file component chỉ export component.

export type FileRejectionReason = "type" | "size" | "count";

/** Một tệp không nhận, kèm câu giải thích sẵn để hiện cho người dùng. */
export type FileRejection = { file: File; reason: FileRejectionReason; message: string };

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** "1,2 MB" / "850 KB" */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`;
}

/**
 * Kiểm tra tệp mới chọn theo thứ tự chọn: sai loại, quá cỡ, rồi vượt số lượng
 * (gặp tệp vượt số lượng đầu tiên thì dừng — các tệp sau cũng không vào được).
 */
export function checkFiles(
  picked: File[],
  {
    existing,
    accept,
    acceptLabel,
    maxFiles,
    maxFileBytes,
  }: {
    existing: number;
    accept?: string[];
    acceptLabel?: string;
    maxFiles?: number;
    maxFileBytes?: number;
  }
): { accepted: File[]; rejected: FileRejection[] } {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  const allowed = accept?.map((x) => x.toLowerCase());
  const maxSize = maxFileBytes ? formatFileSize(maxFileBytes) : "";
  for (const file of picked) {
    if (allowed && allowed.length > 0 && !allowed.includes(extOf(file.name))) {
      rejected.push({
        file,
        reason: "type",
        message: `Chưa tải lên được tệp ${file.name}: chỉ nhận ${acceptLabel ?? allowed.map((x) => x.toUpperCase()).join(", ")}.`,
      });
      continue;
    }
    if (maxFileBytes && file.size > maxFileBytes) {
      rejected.push({
        file,
        reason: "size",
        message: `Chưa tải lên được tệp ${file.name} vì lớn hơn ${maxSize}. Bạn hãy thu nhỏ hoặc chụp lại rồi tải lên.`,
      });
      continue;
    }
    if (maxFiles !== undefined && existing + accepted.length >= maxFiles) {
      rejected.push({
        file,
        reason: "count",
        message: `Chỉ đính kèm được tối đa ${maxFiles} tệp. Bạn hãy gỡ bớt tệp cũ rồi tải lên lại.`,
      });
      break;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

