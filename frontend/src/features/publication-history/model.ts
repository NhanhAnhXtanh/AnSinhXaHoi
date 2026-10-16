import type { StatusTone } from "@/shared/components/asxh";

import type {
  ItemResult,
  Publication,
  PublicationKind,
  PublicationStatus,
} from "./fixtures";

export const KIND_LABEL: Record<PublicationKind, string> = {
  first: "Lần đầu",
  supplement: "Bổ sung",
};

export const STATUS_VIEW: Record<PublicationStatus, { label: string; tone: StatusTone }> = {
  processing: { label: "Đang xử lý", tone: "info" },
  created: { label: "Đã tạo phiếu", tone: "success" },
  failed: { label: "Thất bại", tone: "destructive" },
  withdrawn: { label: "Đã thu hồi", tone: "outline" },
};

export const RESULT_VIEW: Record<ItemResult, { label: string; tone: StatusTone }> = {
  created: { label: "Đã tạo", tone: "success" },
  existed: { label: "Đã có sẵn", tone: "neutral" },
  failed: { label: "Chưa tạo được", tone: "destructive" },
  processing: { label: "Đang tạo", tone: "info" },
};

/** Đếm của một đợt: phiếu và biểu chỉ tính dòng không thất bại. */
export function totals(p: Publication): { units: number; tickets: number; forms: number } {
  const ok = p.items.filter((i) => i.result !== "failed");
  return {
    units: p.items.length,
    tickets: ok.length,
    forms: ok.reduce((s, i) => s + i.forms, 0),
  };
}

/** "yyyy-MM-ddTHH:mm" → Date theo giờ máy. */
export function parseAt(at: string): Date {
  const [d, t] = at.split("T");
  const [y, mo, da] = (d ?? "1970-01-01").split("-").map(Number);
  const [h, mi] = (t ?? "00:00").split(":").map(Number);
  return new Date(y ?? 1970, (mo ?? 1) - 1, da ?? 1, h ?? 0, mi ?? 0);
}

/** Bỏ dấu để tìm không phân biệt dấu. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
