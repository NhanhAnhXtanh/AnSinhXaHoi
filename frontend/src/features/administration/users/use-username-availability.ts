import { useEffect, useState } from "react";
import { useList } from "@refinedev/core";

import { USER_FIELD_RULES } from "./user-form-fields";

export type UsernameAvailability = "idle" | "checking" | "available" | "taken";

/** Chờ người dùng ngừng gõ rồi mới hỏi máy chủ. */
const DEBOUNCE_MS = 400;

/** Tên đăng nhập đủ dạng để hỏi (đúng luật ô nhập), chưa đủ thì chưa hỏi. */
function checkable(username: string): boolean {
  const rules = USER_FIELD_RULES.username;
  return username.length >= rules.minLength.value && rules.pattern.value.test(username);
}

/**
 * Tên đăng nhập đã có tài khoản nào dùng chưa (lọc `username` bằng, không phân biệt hoa
 * thường — như máy chủ kiểm khi lưu). Chỉ là gợi ý sớm: máy chủ vẫn kiểm lại khi lưu.
 *
 * `ownUsername`: khi SỬA tài khoản, tên hiện tại của chính tài khoản đó không tính là "đã có
 * người dùng" — gõ lại đúng tên cũ thì không hỏi, không báo.
 */
export function useUsernameAvailability(
  raw: string | undefined,
  ownUsername?: string
): UsernameAvailability {
  const username = (raw ?? "").trim();
  const isOwn =
    ownUsername !== undefined && username.toLowerCase() === ownUsername.trim().toLowerCase();
  const [debounced, setDebounced] = useState(username);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(username), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [username]);

  const enabled = !isOwn && checkable(debounced);
  const { result, query } = useList({
    resource: "users",
    filters: [{ field: "username", operator: "eq", value: debounced }],
    pagination: { pageSize: 1 },
    queryOptions: { enabled },
    errorNotification: false,
  });

  if (isOwn || !checkable(username)) return "idle";
  if (username !== debounced || query.isFetching) return "checking";
  if (query.isError) return "idle";
  return (result?.total ?? 0) > 0 ? "taken" : "available";
}

export const USERNAME_TAKEN_MESSAGE = "Tên đăng nhập đã có người dùng. Bạn chọn tên khác.";
