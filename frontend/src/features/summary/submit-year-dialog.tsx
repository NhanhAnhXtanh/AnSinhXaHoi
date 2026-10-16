import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Calendar, CircleX, FileText, Upload, X } from "lucide-react";

import { formatNumber } from "@/shared/components/asxh";
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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

import type { AttachedFile } from "./fixtures";
import { parseViDate, todayVi } from "./utils";

const MAX_FILES = 10;
const MAX_FILE_KB = 10 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx";

export type SubmitYearInput = { docNo: string; docDate: string; files: AttachedFile[] };

type Errors = Partial<Record<"docNo" | "docDate" | "files" | "confirm", string>>;

/**
 * Hộp "Nộp báo cáo năm N lên UBND?" — chỉ giữ đúng thứ phải điền: số văn bản,
 * ngày văn bản, file phiếu nộp (không bắt buộc) và ô xác nhận. Bấm nút khi còn
 * thiếu thì báo lỗi dưới từng ô, không làm mờ nút.
 */
export function SubmitYearDialog({
  open,
  onOpenChange,
  year,
  resubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  /** Gửi lại sau khi UBND trả lại: đổi chữ trên tiêu đề và nút. */
  resubmit: boolean;
  onSubmit: (input: SubmitYearInput) => void;
}) {
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(todayVi());
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const docNoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDocNo("");
    setDocDate(todayVi());
    setFiles([]);
    setConfirmed(false);
    setErrors({});
  }, [open]);

  const verb = resubmit ? "Gửi lại" : "Nộp";

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter((f) => f.size / 1024 > MAX_FILE_KB);
    const ok = picked
      .filter((f) => f.size / 1024 <= MAX_FILE_KB)
      .map((f) => ({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }));
    const merged = [...files, ...ok];
    let message: string | undefined;
    if (tooBig.length > 0) {
      message = `File ${tooBig.map((f) => f.name).join(", ")} lớn hơn 10 MB nên chưa được thêm.`;
    }
    if (merged.length > MAX_FILES) {
      message = `Chỉ đính kèm được tối đa ${MAX_FILES} file. Hãy bỏ bớt file rồi thêm lại.`;
    }
    setFiles(merged.slice(0, MAX_FILES));
    setErrors((e) => ({ ...e, files: message }));
  };

  const submit = () => {
    const next: Errors = {};
    const parsed = parseViDate(docDate);
    if (!docNo.trim()) next.docNo = "Hãy nhập số văn bản, ví dụ 12/TTr-STC.";
    else if (docNo.trim().length > 50) next.docNo = "Số văn bản dài quá 50 ký tự.";
    if (!parsed) next.docDate = "Hãy nhập ngày văn bản theo dạng ngày/tháng/năm, ví dụ 06/01/2027.";
    if (!confirmed) next.confirm = `Hãy tích xác nhận trước khi ${verb.toLowerCase()} báo cáo.`;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      if (next.docNo) docNoInput.current?.focus();
      return;
    }
    onSubmit({ docNo: docNo.trim(), docDate: parsed ?? "", files });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {verb} báo cáo năm {year} lên UBND?
          </DialogTitle>
          <DialogDescription>
            Sau khi {verb.toLowerCase()}, số liệu năm {year} không sửa được cho tới khi UBND trả
            lại.
          </DialogDescription>
        </DialogHeader>

        <form
          id="submit-year-form"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submit-doc-no">
              Số văn bản <span className="text-destructive-text">*</span>
            </Label>
            <Input
              ref={docNoInput}
              id="submit-doc-no"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder="12/TTr-STC"
              aria-invalid={Boolean(errors.docNo)}
            />
            <FieldNote error={errors.docNo}>
              Số ghi trên văn bản trình UBND, ví dụ 12/TTr-STC.
            </FieldNote>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submit-doc-date">
              Ngày văn bản <span className="text-destructive-text">*</span>
            </Label>
            <div className="relative">
              <Calendar
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                id="submit-doc-date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                className="ps-9"
                aria-invalid={Boolean(errors.docDate)}
              />
            </div>
            {errors.docDate && <FieldNote error={errors.docDate} />}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>File phiếu nộp (bản ký, đóng dấu)</Label>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
              >
                <Upload aria-hidden />
                Tải file lên
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <FieldNote error={errors.files}>
              Không bắt buộc. Tối đa 10 file, mỗi file không quá 10 MB (ảnh, PDF, Word, Excel).
            </FieldNote>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="bg-surface-subtle flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <FileText aria-hidden className="text-muted-foreground size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatNumber(f.sizeKb)} KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      aria-label={`Bỏ file ${f.name}`}
                      onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="submit-confirm"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                aria-invalid={Boolean(errors.confirm)}
              />
              <Label htmlFor="submit-confirm" className="font-normal">
                Tôi xác nhận gửi báo cáo năm {year} lên UBND
              </Label>
            </div>
            {errors.confirm && <FieldNote error={errors.confirm} />}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button type="submit" form="submit-year-form">
            {verb} báo cáo năm {year}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldNote({ error, children }: { error?: string; children?: ReactNode }) {
  if (error) {
    return (
      <p className="text-destructive-text flex items-start gap-1.5 text-xs leading-4">
        <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
        {error}
      </p>
    );
  }
  if (!children) return null;
  return <p className={cn("text-muted-foreground text-xs leading-4")}>{children}</p>;
}
