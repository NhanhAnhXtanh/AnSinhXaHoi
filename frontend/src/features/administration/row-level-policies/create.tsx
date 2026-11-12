import { useForm } from "@refinedev/react-hook-form";

import { CreateView } from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import {
  FormSectionActions,
  SectionedFormPanel,
} from "@/shared/components/form/form-section";
import { PolicyForm, type PolicyFormValues } from "./policy-form";
import { DEFAULT_POLICY, normalize } from "./policy-values";
import { useManagedResources } from "./use-managed-resources";
import { AdminPageHeader } from "../record-actions";
import { errorDescription } from "../labels";
import { useWarnWhenChanged } from "@/shared/components/form/use-warn-when-changed";
import { useBackOr } from "@/shared/hooks/use-back-or";

export const RowLevelPolicyCreate = () => {
  // Huỷ: về trang trước trong app; mở thẳng / sau F5 thì về danh sách (navigate(-1) đứng yên).
  const goBack = useBackOr("/row-level-policies");
  const resources = useManagedResources();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    // Cảnh báo chưa lưu do useWarnWhenChanged lo (so với giá trị lúc mở).
    warnWhenUnsavedChanges: false,
    refineCoreProps: {
      successNotification: () => ({
        type: "success",
        message: "Đã thêm phạm vi dữ liệu",
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không tạo được phạm vi dữ liệu",
        description: errorDescription(error),
      }),
    },
    defaultValues: DEFAULT_POLICY,
  });
  useWarnWhenChanged(form, form.formState.defaultValues);

  function onSubmit(values: PolicyFormValues) {
    onFinish(normalize(values));
  }

  return (
    <CreateView>
      <AdminPageHeader
        title="Thêm phạm vi dữ liệu"
        description="Quy định vai trò nào được thấy những dòng dữ liệu nào, hoặc giới hạn dữ liệu cho mọi người."
      />
      <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0">
        <SectionedFormPanel>
          <PolicyForm form={form} resources={resources} />
          <FormSectionActions>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang tạo..." : "Tạo phạm vi"}
            </Button>
            <Button type="button" variant="outline" onClick={goBack}>
              Huỷ
            </Button>
          </FormSectionActions>
        </SectionedFormPanel>
      </form>
    </CreateView>
  );
};
