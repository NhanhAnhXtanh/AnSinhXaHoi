import { CircleAlert, FileSpreadsheet, FileText, Paperclip } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { SheetIssue } from "./report-text";

/**
 * Hộp "Còn N chỗ chưa đúng trong số liệu" (UC-35 2a, Figma 310:61141).
 * Một nút duy nhất đưa người dùng về sửa; số liệu đã nhập không mất.
 */
export function CheckErrorsDialog({
  sheetCode,
  issues,
  open,
  onOpenChange,
}: {
  sheetCode: string;
  issues: SheetIssue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Còn {issues.length} chỗ chưa đúng trong số liệu</DialogTitle>
          <DialogDescription>
            Biểu {sheetCode} chưa được đánh dấu là nhập xong. Số liệu bạn nhập vẫn còn nguyên. Hãy sửa rồi bấm
            Kiểm tra &amp; hoàn tất lại.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {issues.map((issue) => (
            <li
              key={`${issue.sheet}-${issue.row}-${issue.message}`}
              className="flex gap-2 rounded-md bg-destructive-subtle px-3 py-2 text-sm"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive-text" />
              <div>
                <p className="font-semibold text-destructive-text">
                  Biểu {issue.sheet}, dòng {issue.row}
                </p>
                <p className="text-foreground">{issue.message}</p>
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Quay lại sửa số liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hộp xác nhận nộp phiếu (Figma 310:62650): câu hỏi lặp lại tên kỳ, thân nói
 * hậu quả (không sửa được nữa) + tóm tắt những gì sẽ gửi.
 */
export function SubmitConfirmDialog({
  periodName,
  summary,
  open,
  onOpenChange,
  onConfirm,
}: {
  periodName: string;
  summary: { sheets: string; total: string | null; files: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const lines: { icon: LucideIcon; text: string }[] = [
    { icon: FileSpreadsheet, text: summary.sheets },
    ...(summary.total ? [{ icon: FileText, text: summary.total }] : []),
    { icon: Paperclip, text: summary.files },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nộp phiếu {periodName}?</DialogTitle>
          <DialogDescription>
            Sau khi nộp, đơn vị không sửa được số liệu cho đến khi Sở duyệt hoặc trả lại phiếu.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2.5 rounded-md border bg-surface-subtle px-4 py-3 text-sm">
          {lines.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              {text}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button type="button" onClick={onConfirm}>
            Nộp phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
