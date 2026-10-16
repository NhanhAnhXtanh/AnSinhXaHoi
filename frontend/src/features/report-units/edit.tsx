import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { Building } from "lucide-react";
import { toast } from "sonner";

import { AsxhPage, EmptyState, StatusBadge } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { UnitAccountsPanel } from "./accounts-panel";
import {
  KHOI_LEVEL_LABELS,
  findUnit,
  khoiOf,
  updateUnit,
  useReportUnits,
} from "./store";
import { UnitForm, type UnitFormValues } from "./unit-form";

const LIST_PATH = "/report-units";

/** Sửa đơn vị — Figma 310:35692: form + panel Tài khoản của đơn vị. */
export function ReportUnitEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const units = useReportUnits();
  const unit = findUnit(units, id);

  // Giá trị ban đầu chỉ lấy một lần theo đơn vị; panel tài khoản đổi kho
  // đơn vị nhưng không được xoá những gì người dùng đang gõ dở trên form.
  const defaultValues = useMemo<UnitFormValues | null>(
    () =>
      unit
        ? {
            code: unit.code,
            name: unit.name,
            parentId: unit.parentId ?? "",
            type: unit.type,
            active: unit.active,
            receivesReports: unit.receivesReports,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unit?.id]
  );

  if (!unit || !defaultValues) {
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

  const parent = findUnit(units, unit.parentId);
  const subtitle = [
    parent ? `Thuộc ${parent.name}` : "Đơn vị cao nhất",
    KHOI_LEVEL_LABELS[khoiOf(unit.type)],
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
        units={units}
        editing={unit}
        defaultValues={defaultValues}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={(values) => {
          updateUnit(unit.id, {
            name: values.name,
            type: values.type,
            parentId: values.parentId,
            active: values.active,
            receivesReports: values.receivesReports,
          });
          toast.success(`Đã lưu đơn vị ${values.name}.`);
          navigate(LIST_PATH);
        }}
      />
      <UnitAccountsPanel unit={unit} />
    </AsxhPage>
  );
}
