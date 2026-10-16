import { useNavigate } from "react-router";
import { toast } from "sonner";

import { AsxhPage } from "@/shared/components/asxh";

import { createUnit, getReportUnits, useReportUnits } from "./store";
import { UnitForm, type UnitFormValues } from "./unit-form";

const LIST_PATH = "/report-units";

const DEFAULT_VALUES: UnitFormValues = {
  code: "",
  name: "",
  parentId: "",
  type: "",
  active: true,
  receivesReports: true,
};

/** Thêm đơn vị — Figma 310:31992 (lỗi ô: 310:33452). */
export function ReportUnitCreate() {
  const navigate = useNavigate();
  const units = useReportUnits();

  return (
    <AsxhPage
      title="Thêm đơn vị"
      description="Nhập thông tin đơn vị rồi bấm Lưu."
      backTo={LIST_PATH}
    >
      <UnitForm
        units={units}
        defaultValues={DEFAULT_VALUES}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={(values) => {
          // Kiểm lại mã trùng ngay lúc lưu — danh sách có thể vừa đổi ở cửa sổ khác.
          if (getReportUnits().some((u) => u.code === values.code)) {
            toast.error("Mã này đã có đơn vị khác dùng nên chưa lưu được. Hãy nhập mã khác.");
            return;
          }
          createUnit(values);
          toast.success(`Đã lưu đơn vị ${values.name}.`);
          navigate(LIST_PATH);
        }}
      />
    </AsxhPage>
  );
}
