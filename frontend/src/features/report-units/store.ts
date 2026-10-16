import { useSyncExternalStore } from "react";

import {
  REPORT_UNITS,
  type ReportUnit,
  type UnitAccount,
  type UnitType,
} from "./fixtures";

/**
 * Kho đơn vị trong bộ nhớ, dùng chung cho Danh sách / Thêm / Sửa.
 *
 * Ba màn là ba route riêng, nên state cục bộ của từng màn sẽ mất khi chuyển
 * trang — thêm một đơn vị rồi quay về danh sách sẽ không thấy nó. Kho này giữ
 * dữ liệu mẫu sống suốt phiên mở trang, cho tới khi có API thật.
 */
let units: ReportUnit[] = REPORT_UNITS;
const listeners = new Set<() => void>();

function emit(next: ReportUnit[]) {
  units = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReportUnits(): ReportUnit[] {
  return useSyncExternalStore(subscribe, () => units);
}

export function getReportUnits(): ReportUnit[] {
  return units;
}

/* ------------------------------------------------------------------ */
/* Cây đơn vị                                                          */
/* ------------------------------------------------------------------ */

/** Đơn vị cấp dưới trực tiếp, giữ thứ tự nhập (thứ tự danh mục của Sở). */
export function childrenOf(list: ReportUnit[], id: string | null): ReportUnit[] {
  return list.filter((u) => u.parentId === id);
}

/** Mọi đơn vị cấp dưới (mọi tầng) của một đơn vị. */
export function descendantIds(list: ReportUnit[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const u of list) {
      if (u.parentId === current && !out.has(u.id)) {
        out.add(u.id);
        stack.push(u.id);
      }
    }
  }
  return out;
}

export function findUnit(list: ReportUnit[], id: string | null | undefined) {
  return id ? list.find((u) => u.id === id) : undefined;
}

export type Khoi = "tinh" | "huyen" | "xa";

export const KHOI_LABELS: Record<Khoi, string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện",
  xa: "Khối xã",
};

/** "Đơn vị cấp xã" ở dòng phụ trang Sửa. */
export const KHOI_LEVEL_LABELS: Record<Khoi, string> = {
  tinh: "Đơn vị cấp tỉnh",
  huyen: "Đơn vị cấp huyện",
  xa: "Đơn vị cấp xã",
};

/** Khối suy từ loại đơn vị (BR-01.4): xã → khối xã, UBND huyện/TP ("Khác") → khối huyện, còn lại khối tỉnh. */
export function khoiOf(type: UnitType): Khoi {
  if (type === "xa") return "xa";
  if (type === "khac") return "huyen";
  return "tinh";
}

/* ------------------------------------------------------------------ */
/* Thao tác                                                            */
/* ------------------------------------------------------------------ */

export type UnitInput = {
  code: string;
  name: string;
  type: UnitType;
  parentId: string | null;
  active: boolean;
  receivesReports: boolean;
};

export function createUnit(input: UnitInput): ReportUnit {
  const unit: ReportUnit = {
    ...input,
    id: `dv-${Date.now().toString(36)}`,
    accounts: [],
  };
  emit([...units, unit]);
  return unit;
}

/**
 * Lưu đơn vị đã có. Mã không đổi (BR-01.1). Ngừng hoạt động lan xuống mọi cấp
 * con và tài khoản của chúng; kích hoạt lại chỉ áp cho chính đơn vị (BR-02.1).
 */
export function updateUnit(id: string, input: Omit<UnitInput, "code">) {
  const before = findUnit(units, id);
  if (!before) return;
  const deactivating = before.active && !input.active;
  const reactivating = !before.active && input.active;
  const cascade = deactivating ? descendantIds(units, id) : new Set<string>();

  emit(
    units.map((u) => {
      if (u.id === id) {
        return {
          ...u,
          ...input,
          accounts:
            deactivating || reactivating
              ? u.accounts.map((a) => ({ ...a, active: input.active }))
              : u.accounts,
        };
      }
      if (cascade.has(u.id)) {
        return {
          ...u,
          active: false,
          accounts: u.accounts.map((a) => ({ ...a, active: false })),
        };
      }
      return u;
    })
  );
}

export function setUnitActive(id: string, active: boolean) {
  const unit = findUnit(units, id);
  if (!unit) return;
  updateUnit(id, {
    name: unit.name,
    type: unit.type,
    parentId: unit.parentId,
    receivesReports: unit.receivesReports,
    active,
  });
}

/** Lý do chưa xoá được (BR-03.1), hoặc null nếu xoá được. */
export function deleteBlocker(list: ReportUnit[], id: string): string | null {
  const unit = findUnit(list, id);
  if (!unit) return null;
  if (list.some((u) => u.parentId === id)) return "còn đơn vị cấp dưới";
  if (unit.accounts.length > 0) return "còn tài khoản của đơn vị";
  return null;
}

export function deleteUnit(id: string) {
  emit(units.filter((u) => u.id !== id));
}

export function addAccount(unitId: string, account: Omit<UnitAccount, "id">) {
  emit(
    units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            accounts: [
              ...u.accounts,
              { ...account, id: `${unitId}-tk${Date.now().toString(36)}` },
            ],
          }
        : u
    )
  );
}

export function setAccountActive(unitId: string, accountId: string, active: boolean) {
  emit(
    units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            accounts: u.accounts.map((a) => (a.id === accountId ? { ...a, active } : a)),
          }
        : u
    )
  );
}

/** Mọi tên đăng nhập đang có — để chặn trùng khi cấp tài khoản. */
export function allUsernames(list: ReportUnit[]): Set<string> {
  return new Set(list.flatMap((u) => u.accounts.map((a) => a.username)));
}
