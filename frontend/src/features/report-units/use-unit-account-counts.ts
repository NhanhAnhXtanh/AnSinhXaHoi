import { useMemo } from "react";
import { useCan, useList } from "@refinedev/core";

import type { User } from "@/domains/user/types";

/**
 * Số tài khoản gắn với từng đơn vị — cột "Tài khoản" của danh sách đơn vị.
 *
 * Một yêu cầu cho cả màn: mọi tài khoản cấp Đơn vị (`accountLevel=don_vi`), đếm theo
 * `reportUnit.id` ở trình duyệt. Số tài khoản đơn vị xấp xỉ số đơn vị (mỗi đơn vị một tài
 * khoản), nên một trang 1.000 dòng là đủ. Không có quyền xem người dùng thì không hỏi và trả
 * `null` — cột hiện "—" như chưa biết, thay vì "0" sai.
 */
export function useUnitAccountCounts(): Map<number, number> | null {
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const mayRead = canReadUsers?.can ?? false;

  const { result, query } = useList<User>({
    resource: "users",
    pagination: { pageSize: 1000 },
    filters: [{ field: "accountLevel", operator: "eq", value: "don_vi" }],
    queryOptions: { enabled: mayRead },
    errorNotification: false,
  });

  return useMemo(() => {
    if (!mayRead || query.isPending || query.isError || !result?.data) return null;
    const counts = new Map<number, number>();
    for (const user of result.data) {
      const unitId = user.reportUnit?.id;
      if (unitId != null) counts.set(unitId, (counts.get(unitId) ?? 0) + 1);
    }
    return counts;
  }, [mayRead, query.isPending, query.isError, result?.data]);
}
