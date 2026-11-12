import { useNavigation, useResourceParams } from "@refinedev/core";
import { useCallback } from "react";
import { useNavigate } from "react-router";

/**
 * Nút "Quay lại" / "Huỷ": về trang trước TRONG ứng dụng, không có trang trước thì về `fallback`.
 *
 * `navigate(-1)` một mình không làm gì khi trang được mở thẳng (thẻ mới, dán đường dẫn) hoặc là
 * trang đầu tiên của thẻ — nút trông như hỏng. React Router ghi vị trí trong lịch sử vào
 * `history.state.idx` (0 = trang đầu tiên của ứng dụng trong thẻ này), nên idx > 0 mới chắc
 * chắn có trang trước của ứng dụng để quay về.
 */
export function useBackOr(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const state = typeof window === "undefined" ? null : (window.history.state as { idx?: unknown } | null);
    const index = typeof state?.idx === "number" ? state.idx : 0;
    if (index > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

/**
 * `useBackOr` với đích dự phòng là danh sách của resource đang mở (khung trang Thêm / Sửa / Xem
 * dùng chung, đầu trang của màn quản trị) — thay `useBack()` của Refine, vốn chỉ là navigate(-1).
 */
export function useBackToList(): () => void {
  const { resource } = useResourceParams();
  const { listUrl } = useNavigation();
  return useBackOr(resource?.list ? listUrl(resource.name) : "/");
}
