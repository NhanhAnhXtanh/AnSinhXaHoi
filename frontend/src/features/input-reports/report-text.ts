import {
  formatDate,
  formatDateTime,
  formatNumber,
  type SheetData,
  type SheetRow,
} from "@/shared/components/asxh";

import {
  displayStatus,
  formatRange,
  type InputReport,
  type ReportSheet,
} from "./model";

/** Tham số đường dẫn chọn phiên bản cũ của phiếu để xem. */
export const REVISION_PARAM = "phienBan";

/** Đường dẫn màn nhập phiếu; `revision` khác bản mới nhất thì mở bản cũ ở chế độ chỉ xem. */
export function workPath(r: InputReport, revision?: number): string {
  const base = `/input-reports/${encodeURIComponent(r.id)}`;
  return revision && revision !== r.revision ? `${base}?${REVISION_PARAM}=${revision}` : base;
}

/** Tên phiếu theo lần nộp, cột "Phiếu" của danh sách. */
export function reportKindLabel(r: InputReport): string {
  return r.revision > 1 ? "Phiếu nộp lại" : "Phiếu lần đầu";
}

/** Dòng phụ trạng thái — dùng ở cột Trạng thái và ở đầu thẻ màn nhập (nguyên tắc §5). */
export function statusLine(r: InputReport): string {
  switch (displayStatus(r)) {
    case "draft":
      return `Cập nhật ${formatDateTime(r.updatedAt)}`;
    case "returned":
      return `Sở trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · Lý do: ${r.returnReason ?? "—"}`;
    case "submitted":
      return `Đã nộp ${r.submittedAt ? formatDateTime(r.submittedAt) : ""} · chờ Sở duyệt`;
    case "overdue":
      return `Hết hạn nộp ${formatDate(r.dueDate)} · liên hệ Sở Tài chính nếu cần gia hạn`;
    case "locked":
      return `Sở đã chốt số liệu ${r.lockedAt ? formatDate(r.lockedAt) : ""} · chỉ xem`;
    case "approved":
      return `Sở duyệt ${r.approvedAt ? formatDateTime(r.approvedAt) : ""}`;
  }
}

/** Tên tệp Excel khi xuất phiếu (UC-45): bỏ dấu tiếng Việt. */
export function exportFileName(r: InputReport, revision = r.revision): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const suffix = revision > 1 ? `_ban-${revision}` : "";
  return `Phieu_${slug(r.orgName)}_${slug(r.periodName)}${suffix}.xlsx`;
}

// ------------------------------------------------------------ bảng tính

const COLUMNS: SheetData["columns"] = [
  { label: "A", width: 56, align: "center" },
  { label: "B", width: 360, align: "left" },
  { label: "C", width: 150, align: "right" },
  { label: "D", width: 150, align: "right" },
  { label: "E", width: 150, align: "right" },
  { label: "F", width: 240, align: "left" },
];

/** Số dòng trên lưới (đếm từ 1) của dòng số liệu đầu tiên: 5 dòng đầu là tiêu đề. */
export const FIRST_DATA_ROW = 6;
/** Chỉ số cột (từ 0) của ô đơn vị nhập — cột D. */
export const CURRENT_COL = 3;

/** Chỉ số dòng số liệu (từ 0) ứng với chỉ số hàng trên lưới (từ 0); ngoài vùng số liệu → null. */
export function lineIndexOfRow(rowIndex: number, lineCount: number): number | null {
  const i = rowIndex - (FIRST_DATA_ROW - 1);
  return i >= 0 && i < lineCount ? i : null;
}

/** Dựng lưới của một biểu: 4 dòng tiêu đề, dòng tên cột, các dòng số liệu, dòng Tổng cộng. */
export function buildSheetData(r: InputReport, s: ReportSheet, editable: boolean): SheetData {
  const sum = (pick: (i: number) => number | null) =>
    s.lines.reduce((acc, _l, i) => acc + (pick(i) ?? 0), 0);
  const total = (i: number) => {
    const l = s.lines[i];
    return l.current === null ? null : (l.previous ?? 0) + l.current;
  };

  const rows: SheetRow[] = [
    { kind: "title", cells: [null, `ĐƠN VỊ: ${r.orgName}`, null, null, null, null] },
    { kind: "title", cells: [null, `BIỂU ${s.code} — ${s.title}`, null, null, null, null] },
    {
      kind: "normal",
      cells: [null, `Kỳ báo cáo: ${r.periodName} (${formatRange(r.periodFrom, r.periodTo)})`, null, null, null, null],
    },
    { kind: "normal", cells: [null, `Đơn vị tính: ${s.unit}`, null, null, null, null] },
    { kind: "header", cells: ["STT", "Chỉ tiêu", ...s.headers, "Ghi chú"] },
    ...s.lines.map<SheetRow>((l, i) => ({
      kind: "normal",
      editable,
      // Chỉ cột D ("Số kỳ này") do đơn vị nhập; C lấy từ kỳ trước, E là công thức.
      editableCols: [CURRENT_COL],
      cells: [i + 1, l.label, l.previous, l.current, total(i), l.note ?? null],
    })),
    {
      kind: "total",
      cells: [
        null,
        "Tổng cộng",
        sum((i) => s.lines[i].previous),
        sum((i) => s.lines[i].current),
        sum(total),
        null,
      ],
    },
  ];
  return { columns: COLUMNS, rows };
}

/** Tổng cột "Số kỳ này" của một biểu — dùng trong hộp xác nhận nộp. */
export function sheetCurrentTotal(s: ReportSheet): string {
  return formatNumber(s.lines.reduce((acc, l) => acc + (l.current ?? 0), 0));
}

// ------------------------------------------------------------ kiểm tra

export type SheetIssue = { sheet: string; row: number; message: string };

/**
 * Kiểm tra số liệu một biểu (giả lập hook kiểm tra của biểu mẫu):
 * ô "Số kỳ này" không được để trống.
 */
export function validateSheet(s: ReportSheet): SheetIssue[] {
  return s.lines.flatMap((l, i) =>
    l.current === null
      ? [
          {
            sheet: s.code,
            row: FIRST_DATA_ROW + i,
            message: `Chưa nhập số liệu ở cột ${s.headers[1]}.`,
          },
        ]
      : []
  );
}
