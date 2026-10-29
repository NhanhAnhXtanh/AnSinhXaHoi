import type { StatusTone } from "@/shared/components/asxh";

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu trên dây                                               */
/* ------------------------------------------------------------------ */

export type PublicationKind = "LAN_DAU" | "BO_SUNG";
export type PublicationStatus = "PUBLISHED" | "CANCELLED";

/** `PublicationResponse` — `/api/publications` (UC-30). */
export type ApiPublication = {
  id: number;
  period: { id: number; name: string; status: string };
  kind: PublicationKind;
  status: PublicationStatus;
  publicationNo: number;
  unitCount: number;
  reportCount: number;
  sheetCount: number;
  createdBy: string | null;
  createdAt: string;
  cancelledAt: string | null;
};

/** `ReportPeriodResponse` — chỉ các trường màn này đọc. */
export type ApiPeriodLite = {
  id: number;
  name: string;
  fromDate: string;
  toDate: string;
};

/** `ReportUnitResponse` — chỉ các trường màn này đọc. */
export type ApiUnitLite = {
  id: number;
  name: string;
  block: "tinh" | "huyen" | "xa" | null;
};

export type ApiReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "RETURNED"
  | "LOCKED"
  | "CANCELLED"
  | "SUPERSEDED";

/** `InputReportResponse` — phiếu của một đợt (`/api/input_reports?publication.id=`). */
export type ApiInputReport = {
  id: number;
  unit: { id: number; name: string };
  publication: { id: number; kind: PublicationKind; publicationNo: number } | null;
  revisionNo: number;
  status: ApiReportStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
  returnReason: string | null;
  progress: { done: number; total: number } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/* ------------------------------------------------------------------ */
/* Nhãn                                                                */
/* ------------------------------------------------------------------ */

export const KIND_LABEL: Record<PublicationKind, string> = {
  LAN_DAU: "Lần đầu",
  BO_SUNG: "Bổ sung",
};

export const STATUS_VIEW: Record<PublicationStatus, { label: string; tone: StatusTone }> = {
  PUBLISHED: { label: "Đã tạo phiếu", tone: "success" },
  CANCELLED: { label: "Đã thu hồi", tone: "outline" },
};

export const UNIT_GROUP_LABEL: Record<"tinh" | "huyen" | "xa", string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện, thành phố",
  xa: "Khối xã, phường",
};

/** Trạng thái hiện tại của phiếu, nói theo cách cán bộ hiểu. */
export const REPORT_STATUS_VIEW: Record<ApiReportStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Đang nhập", tone: "neutral" },
  SUBMITTED: { label: "Chờ duyệt", tone: "info" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  RETURNED: { label: "Bị trả lại", tone: "warning" },
  LOCKED: { label: "Đã chốt", tone: "locked" },
  CANCELLED: { label: "Đã huỷ", tone: "outline" },
  SUPERSEDED: { label: "Bản cũ", tone: "outline" },
};

/* ------------------------------------------------------------------ */
/* Chi tiết đợt: gom phiếu theo đơn vị + diễn biến                     */
/* ------------------------------------------------------------------ */

export type HistoryEvent = {
  at: Date;
  label: string;
  by: string;
  /** Mốc không có thời điểm gốc, được suy ra từ dữ liệu khác (BR-30.1). */
  inferred?: boolean;
};

export type PublicationItem = {
  unitId: number;
  unitName: string;
  unitGroup: string;
  /** Số biểu trong phiếu (bản mới nhất). */
  forms: number;
  status: ApiReportStatus;
  history: HistoryEvent[];
};

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Một dòng mỗi đơn vị: bản phiếu mới nhất cho số biểu và trạng thái, mọi bản (kể cả bản cũ khi
 * Sở trả lại) cho diễn biến. Mốc trả lại được ghi trên cả bản cũ lẫn bản mới nên lọc trùng.
 */
export function toItems(
  reports: ApiInputReport[],
  groupOf: (unitId: number) => string,
  openedBy: string
): PublicationItem[] {
  const byUnit = new Map<number, ApiInputReport[]>();
  for (const r of reports) {
    const list = byUnit.get(r.unit.id) ?? [];
    list.push(r);
    byUnit.set(r.unit.id, list);
  }
  const items: PublicationItem[] = [];
  byUnit.forEach((revisions, unitId) => {
    const sorted = [...revisions].sort((a, b) => a.revisionNo - b.revisionNo);
    const latest = sorted[sorted.length - 1];
    if (!latest) return;
    const events: HistoryEvent[] = [];
    const seen = new Set<string>();
    const push = (iso: string | null, label: string, by: string | null, inferred?: boolean) => {
      const at = toDate(iso);
      if (!at) return;
      const key = `${label}|${at.getTime()}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push({ at, label, by: by || "Hệ thống", inferred });
    };
    for (const r of sorted) {
      if (r.revisionNo === 1) push(r.createdAt, "Lập phiếu khi mở đợt", openedBy);
      push(r.submittedAt, r.revisionNo > 1 ? "Đơn vị nộp lại phiếu" : "Đơn vị nộp phiếu", r.submittedBy);
      push(
        r.returnedAt,
        r.returnReason ? `Sở trả lại phiếu: ${r.returnReason}` : "Sở trả lại phiếu",
        r.returnedBy
      );
      push(r.approvedAt, "Sở phê duyệt phiếu", r.approvedBy);
      // Khoá khi chốt đợt không lưu thời điểm riêng — lấy lần đổi cuối của phiếu.
      if (r.status === "LOCKED")
        push(r.updatedAt, r.approvedAt ? "Sở khoá phiếu đã duyệt" : "Khoá phiếu khi Sở chốt đợt", null, true);
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    items.push({
      unitId,
      unitName: latest.unit.name,
      unitGroup: groupOf(unitId),
      forms: latest.progress?.total ?? 0,
      // Phiếu khoá SAU khi duyệt vẫn là phiếu đã duyệt (số liệu đã ghi nhận).
      status: latest.status === "LOCKED" && latest.approvedAt ? "APPROVED" : latest.status,
      history: events,
    });
  });
  return items.sort((a, b) => a.unitName.localeCompare(b.unitName, "vi"));
}

/** dd/MM – dd/MM/yyyy của kỳ, viết sẵn cho dòng phụ. */
export function periodRange(p: ApiPeriodLite | undefined, format: (d: string) => string): string {
  if (!p) return "";
  return `${format(p.fromDate).slice(0, 5)} – ${format(p.toDate)}`;
}

export const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
