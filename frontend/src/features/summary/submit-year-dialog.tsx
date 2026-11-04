import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Calendar, CircleAlert, CircleX, LoaderCircle } from "lucide-react";

import { API_URL } from "@/shared/api/constants";
import { getAccessToken, refreshSession } from "@/shared/api/session";
import { FileUpload } from "@/shared/components/file-upload";
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

import { parseViDate, todayVi } from "./utils";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx"];

// ---------------------------------------------------------------- báo cáo năm (API)

/**
 * Tình trạng nộp báo cáo năm của một năm — `GET /api/annual_reports/year_status?year=`
 * (quyền `annual_reports:read`). Màn Tổng hợp dùng để đổi vai nút: Nộp báo cáo năm →
 * Xem phiếu → Gửi lại.
 */
export type AnnualYearStatus = {
  year: number;
  ledgerVersion: number;
  savedPeriods: number;
  totalPeriods: number;
  lockReason: string | null;
  /** Lý do chưa nộp được; null = nộp được (nếu có quyền). */
  blocker: string | null;
  /** Kỳ chưa lưu số liệu / thiếu biểu — chỉ cảnh báo, vẫn nộp được. */
  warnings: string[];
  unfinishedSheets: string[];
  sheetCount: number;
  canSubmit: boolean;
  latest: AnnualLatest | null;
};

/** Phiếu năm mới nhất của năm (phần màn Tổng hợp cần). */
export type AnnualLatest = {
  id: number;
  year: number;
  revisionNo: number;
  status: "submitted" | "approved" | "returned";
  statusLabel: string;
  submittedAt: string;
  decidedAt: string | null;
  returnReason: string | null;
  reopened: boolean;
};

export const ANNUAL_YEAR_STATUS_URL = `${API_URL}/annual_reports/year_status`;

export type SubmitYearInput = { docNo: string; docDate: string; files: File[] };

/**
 * Nộp (hoặc gửi lại) báo cáo năm: `POST /api/annual_reports` multipart (`year`, `docNo`,
 * `docDate` yyyy-MM-dd, `files`). Gọi bằng `fetch` vì bộ ky của data provider gắn sẵn kiểu nội
 * dung JSON. Lỗi ném theo dạng `HttpError` của Refine để `errorMessage` đọc được câu máy chủ.
 */
export async function submitAnnualReport(year: number, input: SubmitYearInput): Promise<AnnualLatest> {
  const build = () => {
    const form = new FormData();
    form.append("year", String(year));
    form.append("docNo", input.docNo);
    form.append("docDate", input.docDate);
    for (const file of input.files) form.append("files", file, file.name);
    return form;
  };
  const send = (token: string | null) => {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}/annual_reports`, { method: "POST", headers, body: build() });
  };
  let response = await send(getAccessToken());
  if (response.status === 401) {
    const token = await refreshSession(API_URL);
    if (token) response = await send(token);
  }
  if (!response.ok) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { message?: string } | null;
    const message =
      response.status === 413
        ? "Tổng dung lượng các file quá lớn. Hãy bớt file hoặc nén nhỏ lại rồi nộp lại."
        : body?.message || response.statusText;
    throw { message, statusCode: response.status };
  }
  return (await response.json()) as AnnualLatest;
}

// ---------------------------------------------------------------- hộp nộp

type Errors = Partial<Record<"docNo" | "docDate" | "confirm", string>>;

/**
 * Hộp "Nộp báo cáo năm N lên UBND?" — chỉ giữ đúng thứ phải điền: số văn bản,
 * ngày văn bản, file phiếu nộp (không bắt buộc) và ô xác nhận. Bấm nút khi còn
 * thiếu thì báo lỗi dưới từng ô, không làm mờ nút.
 *
 * `onSubmit` gửi lên máy chủ: trả `null` khi xong (hộp tự đóng), hoặc câu lỗi để
 * hiện ngay trong hộp (giữ nguyên những gì đã điền).
 */
export function SubmitYearDialog({
  open,
  onOpenChange,
  year,
  resubmit,
  warnings = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  /** Gửi lại sau khi UBND trả lại: đổi chữ trên tiêu đề và nút. */
  resubmit: boolean;
  /** Kỳ chưa lưu số liệu / thiếu biểu — nhắc, vẫn nộp được. */
  warnings?: string[];
  onSubmit: (input: SubmitYearInput) => Promise<string | null>;
}) {
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(todayVi());
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const docNoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDocNo("");
    setDocDate(todayVi());
    setFiles([]);
    setConfirmed(false);
    setErrors({});
    setServerError(null);
    setBusy(false);
  }, [open]);

  const verb = resubmit ? "Gửi lại" : "Nộp";

  const submit = async () => {
    const next: Errors = {};
    const parsed = parseViDate(docDate);
    if (!docNo.trim()) next.docNo = "Hãy nhập số văn bản, ví dụ 12/TTr-STC.";
    else if (docNo.trim().length > 50) next.docNo = "Số văn bản dài quá 50 ký tự.";
    if (!parsed) next.docDate = "Hãy nhập ngày văn bản theo dạng ngày/tháng/năm, ví dụ 06/01/2027.";
    if (!confirmed) next.confirm = `Hãy tích xác nhận trước khi ${verb.toLowerCase()} báo cáo.`;
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) {
      if (next.docNo) docNoInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const failure = await onSubmit({ docNo: docNo.trim(), docDate: parsed ?? "", files });
      if (failure) {
        setServerError(failure);
        return;
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
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

        {warnings.length > 0 && (
          <div className="bg-warning-subtle text-warning-text flex gap-2.5 rounded-lg px-3.5 py-3 text-sm">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {/* Chỉ một câu tóm tắt — không liệt kê từng kỳ chưa lưu số liệu (người dùng chốt). */}
            <p className="min-w-0 font-medium">Chưa đủ số liệu cả năm</p>
          </div>
        )}

        <form
          id="submit-year-form"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submit();
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
              disabled={busy}
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
                disabled={busy}
                aria-invalid={Boolean(errors.docDate)}
              />
            </div>
            {errors.docDate && <FieldNote error={errors.docDate} />}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>File phiếu nộp (bản ký, đóng dấu)</Label>
            <FileUpload
              variant="button"
              pickLabel="Tải file lên"
              disabled={busy}
              accept={ACCEPT}
              acceptLabel="ảnh, PDF, Word hoặc Excel"
              maxFiles={MAX_FILES}
              maxFileBytes={MAX_FILE_BYTES}
              hint="Không bắt buộc. Tối đa 10 file, mỗi file không quá 10 MB (ảnh, PDF, Word, Excel)."
              files={files.map((f, i) => ({ id: i, name: f.name, size: f.size }))}
              onAdd={(picked) => setFiles((list) => [...list, ...picked])}
              onRemove={(item) => setFiles((list) => list.filter((_, j) => j !== item.id))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="submit-confirm"
                checked={confirmed}
                disabled={busy}
                onCheckedChange={(v) => setConfirmed(v === true)}
                aria-invalid={Boolean(errors.confirm)}
              />
              <Label htmlFor="submit-confirm" className="font-normal">
                Tôi xác nhận gửi báo cáo năm {year} lên UBND
              </Label>
            </div>
            {errors.confirm && <FieldNote error={errors.confirm} />}
          </div>

          {serverError && (
            <div
              role="alert"
              className="bg-destructive-subtle text-destructive-text flex gap-2.5 rounded-lg px-3.5 py-3 text-sm"
            >
              <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>{serverError}</p>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button type="submit" form="submit-year-form" disabled={busy}>
            {busy && <LoaderCircle aria-hidden className="animate-spin" />}
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
