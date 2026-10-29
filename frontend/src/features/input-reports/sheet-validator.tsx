import { useEffect, useRef, useState } from "react";

import {
  SpreadWorkbook,
  runClientScript,
  type SpreadWorkbookApi,
  type WorkbookJson,
} from "@/shared/components/spreadsheet";

import type { SheetIssue } from "./work-dialogs";

/** Một biểu cần chạy lại bước kiểm tra của mẫu trước khi nộp. */
export type ValidationJob = {
  sheetId: number;
  /** Tên ngắn của biểu (1a, 1b…) — hiện trong danh sách lỗi. */
  code: string;
  workbook: WorkbookJson | null;
  scriptText: string;
  /** Dữ liệu cho script (`ctx.shared`), như lúc mở biểu trên màn. */
  context: Record<string, unknown>;
};

/** Biểu nào mở không xong trong khoảng này thì bỏ qua (máy chủ vẫn kiểm lại khi nộp). */
const JOB_TIMEOUT_MS = 20_000;

/**
 * Chạy bước kiểm tra `validate` của script mẫu trên các biểu KHÔNG đang mở trên màn,
 * lần lượt từng biểu, trong một bảng tính ẩn ngoài khung nhìn (SpreadJS cần khung
 * có kích thước thật để dựng). Bảng ẩn chạy chế độ `offscreen`: nạp đồng bộ và không
 * vẽ canvas, vì không ai nhìn nó.
 *
 * Biểu không mở được hoặc quá lâu được coi là qua (giống bản Jmix: script lỗi
 * biên dịch thì trình duyệt không chặn — UC-35 2b); hàng rào cuối là máy chủ.
 */
export function SheetValidator({
  jobs,
  onDone,
}: {
  jobs: ValidationJob[];
  onDone: (issues: SheetIssue[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const issuesRef = useRef<SheetIssue[]>([]);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const job = jobs[index];

  // Hết việc → báo kết quả đúng một lần.
  useEffect(() => {
    if (job || finishedRef.current) return;
    finishedRef.current = true;
    onDoneRef.current(issuesRef.current);
  }, [job]);

  // Biểu treo (không tải được bảng tính) không được giữ người dùng mãi.
  useEffect(() => {
    if (!job) return;
    const timer = window.setTimeout(() => setIndex((i) => (i === index ? i + 1 : i)), JOB_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [job, index]);

  if (!job) return null;

  const onReady = (api: SpreadWorkbookApi) => {
    const current = index;
    void runClientScript(api, job.scriptText, "validate", job.context)
      .then((result) => {
        if (!result.ok) {
          issuesRef.current.push(...result.messages.map((message) => ({ sheet: job.code, message })));
        }
      })
      .catch(() => {
        /* fail-open: máy chủ kiểm lại */
      })
      .finally(() => setIndex((i) => (i === current ? i + 1 : i)));
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 -left-[10000px] h-[600px] w-[1000px] overflow-hidden opacity-0"
    >
      <SpreadWorkbook
        key={job.sheetId}
        workbook={job.workbook}
        readOnly
        hideTabs
        offscreen
        scriptText={job.scriptText}
        scriptContext={job.context}
        onReady={onReady}
        className="h-full"
      />
    </div>
  );
}
