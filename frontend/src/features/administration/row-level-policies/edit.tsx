import { useEffect, useState } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { TriangleAlert } from "lucide-react";
import { PolicyForm, type PolicyFormValues } from "./policy-form";
import { DEFAULT_POLICY, normalize } from "./policy-values";
import { useManagedResources } from "./use-managed-resources";
import { EMPTY_SCOPE, type RowLevelPolicy } from "@/domains/row-level-policy/types";

export const RowLevelPolicyEdit = () => {
  const navigate = useNavigate();
  const resources = useManagedResources();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Defaults as well as the reset below: they are what types the form (see
    // create.tsx), and they give the condition builder something coherent to
    // render in the moment before the record arrives.
    refineCoreProps: {},
    defaultValues: DEFAULT_POLICY,
  });

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
      <EditViewHeader />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {policy?.invalidReason && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              This policy was disabled at startup because it no longer compiles:{" "}
              {policy.invalidReason}. Fix the condition and switch it back on —
              saving re-checks it, and the reason is cleared when it passes.
            </AlertDescription>
          </Alert>
        )}

        {hydrated ? (
          <PolicyForm
            form={form}
            resources={resources}
            currentRole={policy?.role}
            lockIdentity
          />
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={!hydrated || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </EditView>
  );
};
