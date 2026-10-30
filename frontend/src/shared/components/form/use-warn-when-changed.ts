import { useEffect, useRef } from "react";
import { useWarnAboutChange } from "@refinedev/core";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Bật cảnh báo "còn thay đổi chưa lưu" chỉ khi giá trị form THỰC SỰ khác lúc mở.
 *
 * `useForm` của `@refinedev/react-hook-form` bật cờ ở mọi lần gõ / tích và không bao giờ so
 * lại, nên bỏ tích rồi tích lại đúng như cũ vẫn bị hỏi khi rời trang. Màn dùng hook này truyền
 * `warnWhenUnsavedChanges: false` cho `useForm` để tắt cờ của Refine; hook tự so mỗi khi giá trị
 * đổi. (Refine vẫn tắt cờ khi bấm Lưu qua `handleSubmit` của nó.)
 *
 * `baseline` là giá trị lúc mở: bản ghi vừa tải với màn sửa, giá trị mặc định với màn tạo.
 * `undefined` (bản ghi chưa về) thì không cảnh báo. Chỉ so các ô đang có trong form.
 */
export function useWarnWhenChanged<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, "watch" | "getValues">,
  baseline: Record<string, unknown> | undefined
) {
  const { setWarnWhen } = useWarnAboutChange();
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const { watch, getValues } = form;

  useEffect(() => {
    const check = (values: Record<string, unknown>) => {
      const base = baselineRef.current;
      setWarnWhen(base !== undefined && !sameFormValues(values, base));
    };
    // Bản ghi về sau khi đã sửa (hiếm) cũng phải so lại.
    check(getValues() as Record<string, unknown>);
    const subscription = watch((values) => check(values as Record<string, unknown>));
    return () => subscription.unsubscribe();
  }, [watch, getValues, setWarnWhen, baseline]);

  useEffect(() => () => setWarnWhen(false), [setWarnWhen]);
}

/** So giá trị form với giá trị lúc mở, chỉ trên các ô form đang có. */
export function sameFormValues(
  values: Record<string, unknown>,
  baseline: Record<string, unknown>
): boolean {
  return Object.keys(values).every(
    (key) => JSON.stringify(normalize(values[key])) === JSON.stringify(normalize(baseline[key]))
  );
}

/**
 * Đưa giá trị về dạng so được:
 * - rỗng (`undefined`, `null`, `""`) là một;
 * - đối tượng có `id` (tham chiếu tới bản ghi khác) so bằng `id` — form giữ `{ id }`, bản ghi
 *   tải về giữ đối tượng đầy đủ;
 * - danh sách tham chiếu (quyền, vai trò được tích) không tính thứ tự: bỏ tích rồi tích lại
 *   làm `[1, 2, 3]` thành `[2, 3, 1]` mà vẫn là một tập;
 * - đối tượng thường so theo khoá đã sắp, bỏ khoá rỗng.
 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.map(normalize);
    const allRefs = items.length > 0 && items.every((v) => typeof v === "string" && v.startsWith("ref:"));
    return allRefs ? [...items].sort() : items;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined && obj.id !== null && obj.id !== "") return `ref:${String(obj.id)}`;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = normalize(obj[key]);
      if (v !== null) out[key] = v;
    }
    return out;
  }
  return value;
}
