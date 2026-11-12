import { useCustom, type HttpError } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";

import type { HomeDashboard } from "./types";

/**
 * Số liệu trang chủ của một năm.
 *
 * Mỗi chế độ là một truy vấn riêng (`units=true` chỉ khi đang xem "Theo đơn
 * vị") nên chỉ chế độ đang hiện được nạp (BR-76.1). `refetchOnMount: "always"`
 * vì số liệu phải mới mỗi lần quay về trang chủ (BR-75.2).
 *
 * Lỗi không bật thông báo nổi: màn tự hiện khối lỗi kèm nút "Thử lại".
 */
export function useHomeDashboard(year: number, units: boolean, enabled = true) {
  const { result, query } = useCustom<HomeDashboard, HttpError>({
    url: `${API_URL}/asxh_dashboard`,
    method: "get",
    config: { query: units ? { year, units: true } : { year } },
    errorNotification: false,
    // Tài khoản không có quyền xem phiếu thì không gọi (máy chủ chỉ trả 403).
    queryOptions: { refetchOnMount: "always", enabled },
  });

  // `useCustom` trả một object rỗng (truthy) khi chưa có dữ liệu — đọc qua
  // `customResult` với khoá luôn có trong payload thật.
  const data = customResult(result?.data, "kpi");

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? (query.error ?? null) : null,
    refetch: query.refetch,
  };
}
