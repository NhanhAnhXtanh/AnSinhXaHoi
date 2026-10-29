import { useState } from "react";
import { useCan, useShow } from "@refinedev/core";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView } from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/tabs/tabs";
import { PermissionMatrix } from "./permission-matrix";
import { RoleDataScopes } from "./data-scopes";
import { AdminPageHeader, RecordHeaderActions } from "../record-actions";
import type { Role } from "@/domains/role/types";

/** Dòng giải thích cạnh hàng tab — nói một lần, cùng chữ với màn sửa. */
const TAB_HINTS: Record<string, string> = {
  permissions:
    "Mỗi dòng là một chức năng, mỗi cột là một thao tác. Thay đổi có hiệu lực với người đang đăng nhập sau vài giây.",
  scopes:
    "Quyền quyết định vai trò được làm gì; phạm vi quyết định vai trò được thấy những dòng dữ liệu nào. Muốn đổi, bấm “Sửa vai trò”.",
};

/**
 * Xem một vai trò (Figma 310:56162, 310:72315).
 *
 * Tên, loại và mô tả nằm ở đầu trang; phần còn lại là hai tab — quyền và phạm
 * vi dữ liệu — vì đó là hai nửa của việc một vai trò được cấp. Ma trận quyền ở
 * chế độ chỉ đọc, mở sẵn trên các chức năng có cấp.
 */
export const RoleShow = () => {
  const { result: record, query } = useShow<Role>({});
  const { isLoading } = query;

  // `row_level_policies:*` chỉ cấp cho quản trị, nên người xem được vai trò chưa
  // chắc xem được phạm vi của nó: không có quyền thì không hiện tab.
  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");

  return (
    <ShowView>
      <AdminPageHeader
        title={record?.name ?? "Vai trò"}
        badge={
          record?.systemRole ? (
            <Badge variant="neutral" dot>
              Vai trò hệ thống
            </Badge>
          ) : undefined
        }
        description={record?.description || undefined}
        actions={
          <RecordHeaderActions
            resource="roles"
            id={record?.id}
            editLabel="Sửa vai trò"
            // Vai trò hệ thống không xoá được — API trả 409.
            remove={
              !record || record.systemRole
                ? false
                : {
                    label: "Xoá vai trò",
                    title: `Xoá vai trò ${record.name}?`,
                    description:
                      "Cán bộ đang giữ vai trò này sẽ mất các quyền của nó. Việc xoá không lấy lại được.",
                    successMessage: `Đã xoá vai trò ${record.name}`,
                  }
            }
          />
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TabsList>
            <TabsTrigger value="permissions">
              Quyền ({record?.permissions?.length ?? 0})
            </TabsTrigger>
            {mayReadScopes && (
              <TabsTrigger value="scopes">Phạm vi dữ liệu</TabsTrigger>
            )}
          </TabsList>

          <p className="text-muted-foreground hidden max-w-3xl text-xs leading-5 lg:block lg:ms-auto lg:text-right">
            {TAB_HINTS[tab]}
          </p>
        </div>

        <TabsContent value="permissions">
          <Card className="[--panel-reserve:19rem] gap-0 overflow-hidden py-0">
            <LoadingOverlay loading={isLoading}>
              {/* Gắn khoá theo bản ghi: ma trận mở trên các dòng có cấp và tính
                  điều đó lúc dựng, dựng trước khi có vai trò thì sẽ mở trên
                  "không cấp gì" và đứng yên ở đó. */}
              <PermissionMatrix
                key={record?.id ?? "loading"}
                value={record?.permissions}
                readOnly
              />
            </LoadingOverlay>
          </Card>
        </TabsContent>

        {mayReadScopes && (
          <TabsContent value="scopes">
            <Card className="gap-0 overflow-hidden py-0">
              <RoleDataScopes
                roleId={record?.id}
                roleCode={record?.code}
                roleName={record?.name}
                readOnly
              />
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </ShowView>
  );
};
