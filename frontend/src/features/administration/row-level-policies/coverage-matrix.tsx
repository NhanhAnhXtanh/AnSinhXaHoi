import { useMemo } from "react";
import { useCan, useCustom, useList } from "@refinedev/core";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ACTIONS, type CoverageResponse } from "@/domains/row-level-policy/types";
import type { Role } from "@/domains/role/types";
import { actionLabel, resourceLabel } from "../labels";

/**
 * The coverage grid: which roles have a scope on which resource, per action.
 *
 * It exists to make one specific thing impossible to miss. A resource whose
 * default is `FULL` and a role with no scope means that role is **not narrowed
 * at all** — which is the price of being able to switch a running resource on
 * without anybody losing a row on the day it ships. Left implicit, that price
 * is a default somebody guessed at months ago; shown here, it is a red cell
 * with a name on it.
 *
 * A resource on `NONE` with no scope is the opposite and is fine: the role sees
 * nothing, which is loud, immediate and safe. It is marked, not coloured.
 */
export function CoverageMatrix() {
  const { result, query } = useCustom<CoverageResponse>({
    url: `${API_URL}/row_level_policies/coverage`,
    method: "get",
  });

  // Same trap as in `policy-form`: a query with no data yet reports a frozen
  // empty object, which is truthy and has no `resources` to read a length off.
  const coverage = customResult(result?.data, "resources");

  // Bảng trả về mã vai trò; đổi sang tên khi được xem danh sách vai trò, không
  // thì hiện nguyên mã.
  const { data: canReadRoles } = useCan({ resource: "roles", action: "list" });
  const { result: roleResult } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 200 },
    queryOptions: { enabled: canReadRoles?.can ?? false },
  });
  const roleNames = useMemo(
    () => new Map((roleResult?.data ?? []).map((role) => [role.code, role.name])),
    [roleResult?.data]
  );

  if (query.isLoading) {
    return null;
  }

  if (!coverage || coverage.resources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tổng quan phạm vi</CardTitle>
          <CardDescription>
            Chưa có loại dữ liệu nào được giới hạn theo phạm vi.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roles = [...new Set(coverage.resources.flatMap((resource) =>
    resource.cells.map((cell) => cell.role)))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tổng quan phạm vi</CardTitle>
        <CardDescription>
          Mỗi ô cho biết vai trò đó được thấy phần dữ liệu nào. Vai trò chưa có
          phạm vi riêng thì theo mặc định của loại dữ liệu; ô màu đỏ là vai trò
          chưa bị giới hạn gì — thường vì chưa ai đặt phạm vi cho nó.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {coverage.resources.map((resource) => (
          <div key={resource.resource} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {resourceLabel(resource.resource)}
              </span>
              <Badge
                variant={resource.defaultScope === "FULL" ? "secondary" : "outline"}
              >
                Mặc định:{" "}
                {resource.defaultScope === "FULL"
                  ? "thấy toàn bộ"
                  : "không thấy gì"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Vai trò</TableHead>
                    {ACTIONS.map((action) => (
                      <TableHead key={action}>{actionLabel(action)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role}>
                      <TableCell className="text-sm">
                        {roleNames.get(role) ?? role}
                      </TableCell>
                      {ACTIONS.map((action) => {
                        const cell = resource.cells.find(
                          (candidate) =>
                            candidate.role === role && candidate.action === action
                        );
                        return (
                          <TableCell key={action}>
                            <RiskBadge risk={cell?.risk} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: string | undefined }) {
  if (risk === "OK") {
    return (
      <Badge variant="info" dot>
        Đã có phạm vi
      </Badge>
    );
  }
  if (risk === "CLOSED") {
    // Đóng an toàn — đích đến của mọi loại dữ liệu. Ghi rõ để không ai "sửa"
    // bằng cách đặt một phạm vi cho thấy tất cả.
    return (
      <Badge variant="neutral" dot>
        Không thấy gì
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" dot>
      Chưa giới hạn
    </Badge>
  );
}
