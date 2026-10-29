import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

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

export const RowLevelPolicyCreate = () => {
  const navigate = useNavigate();
  const resources = useManagedResources();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
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
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Huỷ
            </Button>
          </FormSectionActions>
        </SectionedFormPanel>
      </form>
    </CreateView>
  );
};
