import { useCreate, useList, type HttpError } from "@refinedev/core";
import { useNavigate } from "react-router";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AsxhPage, EmptyState, LoadingState } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import {
  TREE_PAGE_SIZE,
  UNIT_RESOURCE,
  apiErrorMessage,
  type ReportUnit,
  type ReportUnitPayload,
} from "./model";
import { UnitForm, showServerError, type UnitFormValues } from "./unit-form";

const LIST_PATH = "/report-units";

const DEFAULT_VALUES: UnitFormValues = {
  budgetCode: "",
  name: "",
  parentId: "",
  unitType: "",
  active: true,
  receivesReports: true,
};

/** Thêm đơn vị — Figma 310:31992 (lỗi ô: 310:33452). `POST /api/report_units`. */
export function ReportUnitCreate() {
  const navigate = useNavigate();
  // Cả cây — cho ô Đơn vị cấp trên và kiểm mã trùng trước khi gửi.
  const { result, query } = useList<ReportUnit>({
    resource: UNIT_RESOURCE,
    pagination: { currentPage: 1, pageSize: TREE_PAGE_SIZE },
    errorNotification: false,
  });
  const { mutateAsync: create } = useCreate<ReportUnit, HttpError, ReportUnitPayload>();

  return (
    <AsxhPage
      title="Thêm đơn vị"
      description="Nhập thông tin đơn vị rồi bấm Lưu."
      backTo={LIST_PATH}
    >
      {query.isLoading ? (
        <LoadingState label="Đang tải danh sách đơn vị…" />
      ) : query.isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa tải được danh sách đơn vị"
          description={apiErrorMessage(
            query.error,
            "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại."
          )}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw aria-hidden />
              Thử lại
            </Button>
          }
        />
      ) : (
        <UnitForm
          units={result.data ?? []}
          defaultValues={DEFAULT_VALUES}
          onCancel={() => navigate(LIST_PATH)}
          onSubmit={async (values, { setFieldError }) => {
            try {
              await create({
                resource: UNIT_RESOURCE,
                values: {
                  budgetCode: values.budgetCode,
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
            toast.success(`Đã lưu đơn vị ${values.name}.`);
            navigate(LIST_PATH);
            return true;
          }}
        />
      )}
    </AsxhPage>
  );
}
