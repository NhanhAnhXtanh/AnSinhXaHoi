import type { ReactNode } from "react";
import { useCan, useShow } from "@refinedev/core";
import { TriangleAlert } from "lucide-react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView } from "@/shared/components/views/show-view";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { ExplainPanel } from "./explain-panel";
import { KIND_LABELS, readConditionVi } from "./labels";
import type { RowLevelPolicy } from "@/domains/row-level-policy/types";
import { actionLabel, formatDateTimeVi, resourceLabel } from "../labels";
import { AdminPageHeader, RecordHeaderActions } from "../record-actions";

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-overline text-muted-foreground">{children}</span>;
}

/**
 * Xem một phạm vi dữ liệu: nó là gì, điều kiện đọc thành câu, và (cho người có
 * quyền xem người dùng) công cụ kiểm tra ai thấy gì.
 */
export const RowLevelPolicyShow = () => {
  const { result: record, query } = useShow<RowLevelPolicy>({});
  const { isLoading } = query;

  // Kiểm tra / mô phỏng nhận mã tài khoản của người khác, nên cần thêm quyền xem
  // người dùng. Không có thì không hiện, vì máy chủ sẽ trả 403.
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const mayExplain = canReadUsers?.can ?? false;

  const roleName = record?.role ? record.role.name || record.role.code : null;

  return (
    <ShowView>
      <AdminPageHeader
        title={record?.name ?? "Phạm vi dữ liệu"}
        badge={
          record ? (
            <div className="flex items-center gap-2">
              <Badge variant={record.kind === "FILTER" ? "warning" : "info"} dot>
                {KIND_LABELS[record.kind] ?? record.kind}
              </Badge>
              {!record.enabled && (
                <Badge variant="neutral" dot>
                  Tạm tắt
                </Badge>
              )}
            </div>
          ) : undefined
        }
        description={
          record
            ? `${resourceLabel(record.resource)} · Thao tác: ${actionLabel(record.action)} · ${roleName ?? "Mọi vai trò"}`
            : undefined
        }
        actions={
          <RecordHeaderActions
            resource="row_level_policies"
            id={record?.id}
            editLabel="Sửa phạm vi"
            remove={
              record
                ? {
                    label: "Xoá phạm vi",
                    title: `Xoá phạm vi “${record.name}”?`,
                    description:
                      "Phần dữ liệu phạm vi này mở ra hoặc giới hạn sẽ trở về mặc định. Việc xoá không lấy lại được.",
                    successMessage: `Đã xoá phạm vi ${record.name}`,
                  }
                : false
            }
          />
        }
      />

      <Card>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              {record?.invalidReason && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>
                    Đã bị tắt khi khởi động vì điều kiện không còn hợp lệ:{" "}
                    {record.invalidReason}
                    {record.kind === "FILTER" && (
                      <>
                        {" "}
                        Vì đây là phạm vi hạn chế, mọi thao tác “
                        {actionLabel(record.action)}” trên{" "}
                        {resourceLabel(record.resource)} bị từ chối cho đến khi
                        sửa xong — một giới hạn ngừng áp dụng là lọt dữ liệu,
                        nên thà chặn hẳn còn hơn.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1">
                <SectionLabel>Phạm vi này làm gì</SectionLabel>
                <p className="text-sm">
                  {record?.kind === "FILTER"
                    ? "Bớt dữ liệu của mọi người, dù giữ vai trò nào. Nó không gắn với vai trò nào nên không ai thoát được."
                    : `Mở rộng dữ liệu ${roleName ?? "một vai trò"} được thấy. Nó cộng thêm với các phạm vi khác của cán bộ, nên có thêm vai trò chỉ thấy rộng hơn.`}
                </p>
              </div>

              {record?.description && (
                <div className="flex flex-col gap-1">
                  <SectionLabel>Mô tả</SectionLabel>
                  <p className="text-sm">{record.description}</p>
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                <SectionLabel>Dòng dữ liệu được thấy</SectionLabel>
                <p className="text-sm">
                  {record ? readConditionVi(record.scope) : "—"}
                </p>
                {/* Cây điều kiện gốc, cho người cần đối chiếu đúng từng nút. */}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">
                    Xem cấu trúc điều kiện
                  </summary>
                  <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3">
                    {record ? JSON.stringify(record.scope, null, 2) : ""}
                  </pre>
                </details>
              </div>

              {record?.action === "write" && (
                <div className="flex flex-col gap-2">
                  <SectionLabel>Sau khi lưu</SectionLabel>
                  {record.checkScope ? (
                    <>
                      <p className="text-sm">
                        {readConditionVi(record.checkScope)}
                      </p>
                      <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer">
                          Xem cấu trúc điều kiện
                        </summary>
                        <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3">
                          {JSON.stringify(record.checkScope, null, 2)}
                        </pre>
                      </details>
                    </>
                  ) : (
                    <p className="text-sm">
                      Vẫn theo điều kiện trên, áp cho dòng sau khi lưu — để
                      không ai chuyển được dòng dữ liệu ra ngoài phạm vi mình
                      thấy.
                    </p>
                  )}
                </div>
              )}

              <Separator />

              <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
                <span>
                  Tạo bởi{" "}
                  {record?.createdBy?.fullName || record?.createdBy?.username || "—"}
                  {record?.createdAt
                    ? ` lúc ${formatDateTimeVi(record.createdAt)}`
                    : ""}
                </span>
                <span>
                  Sửa gần nhất bởi{" "}
                  {record?.updatedBy?.fullName || record?.updatedBy?.username || "—"}
                  {record?.updatedAt
                    ? ` lúc ${formatDateTimeVi(record.updatedAt)}`
                    : ""}
                </span>
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>

      {record && mayExplain && (
        <ExplainPanel resource={record.resource} action={record.action} />
      )}
    </ShowView>
  );
};
