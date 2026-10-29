import { useList, useOne, useUpdate, type HttpError } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import { Building, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  EmptyState,
  LoadingState,
  StatusBadge,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { UnitAccountsPanel } from "./accounts-panel";
import {
  BLOCK_LEVEL_LABELS,
  TREE_PAGE_SIZE,
  UNIT_RESOURCE,
  apiErrorMessage,
  type ApiError,
  type ReportUnit,
  type ReportUnitPayload,
} from "./model";
import { UnitForm, showServerError, type UnitFormValues } from "./unit-form";

const LIST_PATH = "/report-units";

function toFormValues(unit: ReportUnit): UnitFormValues {
  return {
    budgetCode: unit.budgetCode,
    name: unit.name,
    parentId: unit.parent ? String(unit.parent.id) : "",
    unitType: unit.unitType,
    active: unit.active,
    receivesReports: unit.receivesReports,
  };
}

/**
 * Sửa đơn vị — Figma 310:35692: form + panel Tài khoản của đơn vị.
 * `GET` + `PATCH /api/report_units/{id}`; ngừng hoạt động lan xuống cây con do máy chủ làm.
 */
export function ReportUnitEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unitId = Number(id);
  const validId = Number.isInteger(unitId) && unitId > 0;

  const { result: unit, query: unitQuery } = useOne<ReportUnit>({
    resource: UNIT_RESOURCE,
    id: unitId,
    errorNotification: false,
    queryOptions: { enabled: validId },
  });
  const { result: tree, query: treeQuery } = useList<ReportUnit>({
    resource: UNIT_RESOURCE,
    pagination: { currentPage: 1, pageSize: TREE_PAGE_SIZE },
    errorNotification: false,
  });
  const { mutateAsync: update } = useUpdate<ReportUnit, HttpError, ReportUnitPayload>();

  const notFound =
    !validId || (unitQuery.isError && (unitQuery.error as ApiError | null)?.statusCode === 404);

  if (notFound) {
    return (
      <AsxhPage title="Sửa đơn vị" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={Building}
          title="Không tìm thấy đơn vị"
          description="Đơn vị này không còn trong danh sách — có thể đã bị xoá. Bạn quay về danh sách để chọn đơn vị khác."
          action={
            <Button type="button" onClick={() => navigate(LIST_PATH)}>
              Về danh sách đơn vị
            </Button>
          }
        />
      </AsxhPage>
    );
  }

  if (unitQuery.isError || treeQuery.isError) {
    return (
      <AsxhPage title="Sửa đơn vị" backTo={LIST_PATH}>
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Chưa tải được thông tin đơn vị"
          description={apiErrorMessage(
            unitQuery.error ?? treeQuery.error,
            "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại."
          )}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void unitQuery.refetch();
                void treeQuery.refetch();
              }}
            >
              <RefreshCw aria-hidden />
              Thử lại
            </Button>
          }
        />
      </AsxhPage>
    );
  }

  // Form chỉ dựng khi đã có bản ghi: giá trị ban đầu của react-hook-form chỉ đọc một lần.
  if (!unit || unitQuery.isLoading || treeQuery.isLoading) {
    return (
      <AsxhPage title="Sửa đơn vị" backTo={LIST_PATH}>
        <LoadingState variant="page" label="Đang tải thông tin đơn vị…" />
      </AsxhPage>
    );
  }

  const subtitle = [
    unit.parent ? `Thuộc ${unit.parent.name}` : "Đơn vị cao nhất",
    BLOCK_LEVEL_LABELS[unit.block],
  ].join(" · ");

  return (
    <AsxhPage
      title={unit.name}
      badge={
        <StatusBadge tone={unit.active ? "success" : "neutral"}>
          {unit.active ? "Đang hoạt động" : "Ngừng hoạt động"}
        </StatusBadge>
      }
      description={subtitle}
      backTo={LIST_PATH}
    >
      <UnitForm
        key={unit.id}
        units={tree.data ?? []}
        editing={unit}
        defaultValues={toFormValues(unit)}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={async (values, { setFieldError }) => {
          const deactivating = unit.active && !values.active;
          try {
            await update({
              resource: UNIT_RESOURCE,
              id: unit.id,
              // Không gửi mã (bất biến) và khối (máy chủ tự theo loại đơn vị mới).
              values: {
                name: values.name,
                parent: { id: values.parentId },
                unitType: values.unitType,
                active: values.active,
                receivesReports: values.receivesReports,
              },
              successNotification: false,
              errorNotification: false,
            });
          } catch (error) {
            showServerError(
              error,
              setFieldError,
              "Chưa lưu được đơn vị. Bạn thử lại sau ít phút."
            );
            return false;
          }
          toast.success(
            deactivating
              ? `Đã lưu đơn vị ${values.name}. Đơn vị và các đơn vị cấp dưới đã ngừng hoạt động.`
              : `Đã lưu đơn vị ${values.name}.`
          );
          navigate(LIST_PATH);
          return true;
        }}
      />
      <UnitAccountsPanel unit={unit} />
    </AsxhPage>
  );
}
