import { useEffect, useState } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import { EditView } from "@/shared/components/views/edit-view";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  FormSectionActions,
  SectionedFormPanel,
} from "@/shared/components/form/form-section";
import { TriangleAlert } from "lucide-react";
import { AdminPageHeader, RecordHeaderActions } from "../record-actions";
import { errorDescription } from "../labels";
import { PolicyForm, type PolicyFormValues } from "./policy-form";
import { DEFAULT_POLICY, normalize } from "./policy-values";
import { useManagedResources } from "./use-managed-resources";
import { EMPTY_SCOPE, type RowLevelPolicy } from "@/domains/row-level-policy/types";
import { useWarnWhenChanged } from "@/shared/components/form/use-warn-when-changed";

export const RowLevelPolicyEdit = () => {
  const navigate = useNavigate();
  const resources = useManagedResources();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Cảnh báo chưa lưu do useWarnWhenChanged lo (so với giá trị lúc mở).
    warnWhenUnsavedChanges: false,
    // Defaults as well as the reset below: they are what types the form (see
    // create.tsx), and they give the condition builder something coherent to
    // render in the moment before the record arrives.
    refineCoreProps: {
      successNotification: () => ({
        type: "success",
        message: "Đã lưu phạm vi dữ liệu",
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không lưu được phạm vi dữ liệu",
        description: errorDescription(error),
      }),
    },
    defaultValues: DEFAULT_POLICY,
  });
  useWarnWhenChanged(form, form.formState.defaultValues);

  const policy = query?.data?.data as RowLevelPolicy | undefined;

  /**
   * Fill the form from the record in one go.
   *
   * `reset` rather than letting the library `setValue` each field as it thinks
   * they register — see `departments/edit.tsx` for the full account of why that
   * misses fields. It matters more here than anywhere else in this UI: the
   * condition builder mounts its inputs from the record itself, so there is no
   * moment at which every field is registered for a per-field fill to find.
   *
   * `keepDirtyValues` stops the refetch that follows a cache hit from throwing
   * away a condition somebody has already started editing.
   */
  /**
   * Whether the record has been written into the form yet.
   *
   * The form is not rendered until it has, and that is not a nicety. `reset`
   * can only run from an effect, which is always *after* a render — so a form
   * mounted before it holds the record mounts holding the defaults, and every
   * `Select` in it has to change its value afterwards. A Radix `Select` renders
   * its label from the matching item, and one whose value arrives after mount
   * shows the placeholder instead: `action` and `resource` came up blank while
   * `kind` looked fine, purely because `kind`'s default happened to equal the
   * record's value and so never had to change.
   *
   * Mounting once, already populated, removes the whole class of problem rather
   * than papering over the two fields where it showed.
   */
  const [hydrated, setHydrated] = useState(false);

  const { reset } = form;
  useEffect(() => {
    if (!policy) return;
    reset(
      {
        kind: policy.kind,
        role: { id: policy.role?.id ?? null },
        resource: policy.resource,
        action: policy.action,
        name: policy.name,
        policyGroup: policy.policyGroup ?? "",
        description: policy.description ?? "",
        scope: policy.scope ?? EMPTY_SCOPE,
        // Null stays null: it means "same as the condition above", which is
        // not the same thing as an empty tree.
        checkScope: policy.checkScope ?? null,
        enabled: policy.enabled,
      },
      // Protects an edit in progress from the background refetch that follows a
      // cache hit. Nothing can be dirty on the first pass, so this only matters
      // from the second onwards.
      { keepDirtyValues: true }
    );
    setHydrated(true);
  }, [policy, reset]);

  function onSubmit(values: PolicyFormValues) {
    // The whole form goes up, `kind` and `resource` included. Both are locked
    // in the UI and neither is a field on the patch DTO, so the API ignores
    // them — which is a better answer than stripping them here and having two
    // places that decide what an edit may change.
    onFinish(normalize(values));
  }

  return (
    <EditView>
      <AdminPageHeader
        title="Sửa phạm vi dữ liệu"
        description={policy?.name}
        actions={
          <RecordHeaderActions
            resource="row_level_policies"
            id={policy?.id}
            editLabel={false}
            showLabel="Xem chi tiết"
            remove={
              policy
                ? {
                    label: "Xoá phạm vi",
                    title: `Xoá phạm vi “${policy.name}”?`,
                    description:
                      "Phần dữ liệu phạm vi này mở ra hoặc giới hạn sẽ trở về mặc định. Việc xoá không lấy lại được.",
                    successMessage: `Đã xoá phạm vi ${policy.name}`,
                  }
                : false
            }
          />
        }
      />
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-w-0 flex-col gap-4">
        {policy?.invalidReason && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              Phạm vi này đã bị tắt khi khởi động vì điều kiện không còn hợp lệ:{" "}
              {policy.invalidReason}. Sửa điều kiện rồi bật lại — khi lưu hệ
              thống kiểm tra lại và xoá lý do nếu đã đúng.
            </AlertDescription>
          </Alert>
        )}

        <SectionedFormPanel>
          {hydrated ? (
            <PolicyForm
              form={form}
              resources={resources}
              currentRole={
                policy?.role
                  ? { id: policy.role.id, code: policy.role.name || policy.role.code }
                  : policy?.role
              }
              lockIdentity
            />
          ) : (
            <div className="space-y-4 p-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          <FormSectionActions>
            <Button type="submit" disabled={!hydrated || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Huỷ
            </Button>
          </FormSectionActions>
        </SectionedFormPanel>
      </form>
    </EditView>
  );
};
