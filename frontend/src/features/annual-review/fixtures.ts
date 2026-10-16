// Dữ liệu mẫu — thay bằng API khi backend có

import type { StatusTone } from "@/shared/components/asxh";

export type SubmissionStatus = "cho-duyet" | "da-duyet" | "tra-lai";

export const STATUS: Record<SubmissionStatus, { label: string; tone: StatusTone }> = {
  "cho-duyet": { label: "Chờ UBND duyệt", tone: "warning" },
  "da-duyet": { label: "UBND đã duyệt", tone: "success" },
  "tra-lai": { label: "UBND trả lại", tone: "destructive" },
};

export type AttachedFile = { name: string; sizeKb: number };

/** Một lần Sở Tài chính nộp báo cáo năm lên UBND ("Phiếu n"). */
export type AnnualSubmission = {
  /** Trùng mã phiếu ở màn Tổng hợp → Theo năm. */
  id: string;
  year: number;
  revisionNo: number;
  docNo: string;
  docDate: string;
  submittedAt: string;
  submittedBy: string;
  submitterOrg: string;
  files: AttachedFile[];
  /** Phiên bản số liệu tổng hợp được ghim khi nộp. */
  versionNo: number;
  status: SubmissionStatus;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
  /** UBND mở lại sau khi đã duyệt (trạng thái thành trả lại). */
  reopened?: boolean;
};

export const SUBMITTER_ORG = "Sở Tài chính Đồng Nai";
export const UBND_ORG = "UBND tỉnh Đồng Nai";
/** Người đang đăng nhập (vai UBND) — dùng khi ghi người quyết định. */
export const CURRENT_APPROVER = "Lê Quang Minh";

const THU = "Nguyễn Thị Thu";
const HAI = "Trần Văn Hải";
const MINH = "Lê Quang Minh";

export const SUBMISSIONS: AnnualSubmission[] = [
  {
    id: "nam-2026-phieu-2", year: 2026, revisionNo: 2, docNo: "15/TTr-STC", docDate: "2027-01-15",
    submittedAt: "2027-01-15T09:20", submittedBy: THU, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 15-TTr-STC.pdf", sizeKb: 912 }], versionNo: 4, status: "cho-duyet",
  },
  {
    id: "nam-2026-phieu-1", year: 2026, revisionNo: 1, docNo: "12/TTr-STC", docDate: "2027-01-06",
    submittedAt: "2027-01-06T14:10", submittedBy: THU, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 12-TTr-STC.pdf", sizeKb: 842 }], versionNo: 3, status: "tra-lai",
    decidedAt: "2027-01-12T16:05", decidedBy: MINH,
    reason: "Thiếu số liệu biểu 1b của Quý I/2026. Sở hãy bổ sung rồi nộp lại.",
  },
  {
    id: "nam-2025-phieu-1", year: 2025, revisionNo: 1, docNo: "09/TTr-STC", docDate: "2026-01-08",
    submittedAt: "2026-01-08T10:05", submittedBy: THU, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 09-TTr-STC.pdf", sizeKb: 765 }], versionNo: 3, status: "da-duyet",
    decidedAt: "2026-01-14T15:30", decidedBy: MINH,
  },
  {
    id: "nam-2024-phieu-2", year: 2024, revisionNo: 2, docNo: "14/TTr-STC", docDate: "2025-01-20",
    submittedAt: "2025-01-20T14:30", submittedBy: HAI, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 14-TTr-STC.pdf", sizeKb: 712 }], versionNo: 5, status: "da-duyet",
    decidedAt: "2025-01-24T09:00", decidedBy: MINH,
  },
  {
    id: "nam-2024-phieu-1", year: 2024, revisionNo: 1, docNo: "08/TTr-STC", docDate: "2025-01-10",
    submittedAt: "2025-01-10T08:45", submittedBy: HAI, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 08-TTr-STC.pdf", sizeKb: 690 }], versionNo: 4, status: "tra-lai",
    decidedAt: "2025-01-15T10:20", decidedBy: MINH,
    reason: "Số kinh phí biểu 1c chưa khớp với quyết toán.",
  },
  {
    id: "nam-2023-phieu-2", year: 2023, revisionNo: 2, docNo: "11/TTr-STC", docDate: "2024-01-18",
    submittedAt: "2024-01-18T08:45", submittedBy: THU, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 11-TTr-STC.pdf", sizeKb: 698 }], versionNo: 4, status: "da-duyet",
    decidedAt: "2024-01-23T14:10", decidedBy: MINH,
  },
  {
    id: "nam-2023-phieu-1", year: 2023, revisionNo: 1, docNo: "05/TTr-STC", docDate: "2024-01-09",
    submittedAt: "2024-01-09T15:00", submittedBy: THU, submitterOrg: SUBMITTER_ORG,
    files: [{ name: "Tờ trình 05-TTr-STC.pdf", sizeKb: 655 }], versionNo: 3, status: "tra-lai",
    decidedAt: "2024-01-12T08:30", decidedBy: MINH,
    reason: "Thiếu số người cao tuổi ở biểu 1i.",
  },
  {
    id: "nam-2022-phieu-1", year: 2022, revisionNo: 1, docNo: "07/TTr-STC", docDate: "2023-01-12",
    submittedAt: "2023-01-12T09:30", submittedBy: HAI, submitterOrg: SUBMITTER_ORG,
    files: [], versionNo: 2, status: "da-duyet",
    decidedAt: "2023-01-17T16:45", decidedBy: MINH,
  },
];
