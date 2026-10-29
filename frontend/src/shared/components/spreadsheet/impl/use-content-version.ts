import { useRef } from "react";

import type { WorkbookJson } from "../types";
import { workbookContentKey } from "../workbook-json";

/**
 * Số phiên bản NỘI DUNG của prop `workbook`: chỉ tăng khi nội dung thật sự đổi.
 * Feature có thể truyền object mới mỗi lần render (vd `JSON.parse` tại chỗ) — nếu
 * nạp lại theo tham chiếu, bảng tính sẽ xoá sạch số người dùng đang gõ.
 */
export function useContentVersion(value: WorkbookJson | null): number {
  const ref = useRef<{ value: unknown; key: string; version: number } | null>(null);
  if (ref.current === null) {
    ref.current = { value, key: workbookContentKey(value), version: 0 };
  } else if (ref.current.value !== value) {
    const key = workbookContentKey(value);
    ref.current = {
      value,
      key,
      version: key === ref.current.key ? ref.current.version : ref.current.version + 1,
    };
  }
  return ref.current.version;
}
