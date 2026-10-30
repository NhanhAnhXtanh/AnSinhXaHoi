import { useEffect, useState, type CSSProperties } from "react";
import { useCan, useList } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Pencil, Plus, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSidebar } from "@/shared/ui/sidebar";
import {
  SHELL_SIDEBAR_WIDTH,
  SHELL_SIDEBAR_WIDTH_ICON,
} from "@/shared/components/layout/layout";
import { cn } from "@/shared/lib/utils";
import {
  PolicyForm,
  type PolicyFormValues,
} from "@/features/administration/row-level-policies/policy-form";
import { DEFAULT_POLICY, normalize } from "@/features/administration/row-level-policies/policy-values";
import { readConditionVi } from "@/features/administration/row-level-policies/labels";
import { RecordActionsMenu } from "../record-actions";
import { actionLabel, errorDescription, resourceLabel } from "../labels";
import { useManagedResources } from "@/features/administration/row-level-policies/use-managed-resources";
import { EMPTY_SCOPE, type RowLevelPolicy } from "@/domains/row-level-policy/types";

/**
 * A role's data scopes, on the role's own screen.
 *
 * The two halves of what a role grants answer different questions — a
 * permission decides whether an endpoint answers at all, a scope decides which
 * rows it answers with — and until now they lived on screens a navigation
 * apart. They are read together, so they are edited together.
 *
 * **They are not saved together, and that is deliberate.** The permissions
 * matrix is a field of the role form: nothing happens until the role is saved.
 * A scope is a row in `row_level_policies` with its own validation (a condition
 * that will not compile is refused with a `422` naming the node at fault), its
 * own audit trail, and its own cache invalidation — so each one is written the
 * moment its dialog is submitted, through the endpoints that already do all of
 * that. Folding them into the role's payload would mean re-implementing the
 * policy compiler's refusals inside a form that saves several rules at once,
 * and losing the ability to say *which* rule was rejected.
 *
 * Everything here is a `SCOPE`. A `FILTER` names no role — that is precisely
 * what makes it inescapable — so it has no place on a role's screen and the
 * kind picker is locked.
 */

const POLICY_RESOURCE = "row_level_policies";

type RoleDataScopesProps = {
  /** Absent on the create screen, where the role does not exist yet. */
  roleId: number | undefined;
  roleCode: string | undefined;
  /** Tên vai trò, để câu chữ trong hộp phạm vi nói bằng tên chứ không bằng mã. */
  roleName?: string | undefined;
  /** True on the show screen: the rules are listed but nothing is offered. */
  readOnly?: boolean;
};

export function RoleDataScopes({
  roleId,
  roleCode,
  roleName,
  readOnly,
}: RoleDataScopesProps) {
  // `row_level_policies:*` is seeded to ADMIN alone, so these are real
  // questions rather than formalities. Access control hides; the API re-checks.
  const { data: canWrite } = useCan({
    resource: POLICY_RESOURCE,
    action: "create",
  });
  const mayWrite = !readOnly && (canWrite?.can ?? false);

  const resources = useManagedResources();

  const {
    result,
    query: { isLoading, refetch },
  } = useList<RowLevelPolicy>({
    resource: POLICY_RESOURCE,
    // A role with a hundred scopes is a role nobody can reason about; one page
    // is the whole of it in every realistic case, and paginating a list this
    // short would cost more than it explains.
    pagination: { pageSize: 200 },
    sorters: [
      { field: "resource", order: "asc" },
      { field: "action", order: "asc" },
    ],
    filters: roleId
      ? [{ field: "role.id", operator: "eq", value: roleId }]
      : [],
    queryOptions: { enabled: Boolean(roleId) },
  });

  /**
   * Which dialog is open, if any. `null` for none, `{ id: undefined }` for a
   * new scope, `{ id }` for an existing one.
   */
  const [editing, setEditing] = useState<{ id?: number } | null>(null);

  if (!roleId) {
    return (
      <div className="p-4">
        <Alert>
          <AlertDescription>
            Phạm vi dữ liệu phải gắn với một vai trò, mà vai trò này chưa được
            tạo. Bấm “Tạo vai trò”, màn sửa sẽ mở sẵn tab này cho vai trò vừa
            tạo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const policies = result?.data ?? [];

  // Grouped by resource, because that is the axis somebody reads along: "what
  // can this role reach in tasks" is one question, and a flat list interleaves
  // it with every other resource.
  const groups = new Map<string, RowLevelPolicy[]>();
  for (const policy of policies) {
    const bucket = groups.get(policy.resource);
    if (bucket) bucket.push(policy);
    else groups.set(policy.resource, [policy]);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/*
        The panel's own toolbar, the same strip the permission matrix carries on
        the tab beside this one — a count of what is here on the left, the one
        control that acts on the whole list against the right edge. The
        paragraph that used to stand here explaining what a scope *is* now sits
        on the tab band, said once, where it does not push the rules it explains
        down the page every time somebody opens this tab.
      */}
      <div className="bg-surface-subtle flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="text-muted-foreground text-sm">
          <span className="text-foreground font-semibold tabular-nums">
            {policies.length}
          </span>{" "}
          phạm vi trên{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {groups.size}
          </span>{" "}
          loại dữ liệu
        </span>
        {mayWrite && (
          <Button
            // Explicit, because this sits inside the role's own form: an
            // unqualified button in a form is a submit button.
            type="button"
            size="sm"
            onClick={() => setEditing({})}
            className="shrink-0 sm:ms-auto"
          >
            <Plus className="size-4" />
            Thêm phạm vi
          </Button>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : policies.length === 0 ? (
          <Alert>
            <AlertDescription>
              Vai trò này chưa có phạm vi dữ liệu riêng. Khi đó mỗi loại dữ liệu
              theo mặc định của nó: có loại cho thấy toàn bộ, có loại không cho
              thấy gì. Bảng “Tổng quan phạm vi” ở màn Phạm vi dữ liệu tô màu
              từng ô như vậy để bạn thấy được chỗ còn trống.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            {[...groups.entries()].map(([resource, rows]) => (
              <div key={resource} className="flex flex-col gap-2">
                <span className="text-overline text-muted-foreground">
                  {resourceLabel(resource)}
                </span>
                <div className="divide-y rounded-md border">
                  {rows.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex flex-wrap items-start justify-between gap-3 p-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{policy.name}</span>
                          <Badge variant="outline">
                            {actionLabel(policy.action)}
                          </Badge>
                          {!policy.enabled && (
                            <Badge variant="neutral" dot>
                              Tạm tắt
                            </Badge>
                          )}
                          {policy.policyGroup && (
                            <span className="text-muted-foreground text-xs">
                              {policy.policyGroup}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-sm">
                          Thấy: {readConditionVi(policy.scope)}
                        </span>
                        {policy.action === "write" && (
                          <span className="text-muted-foreground text-sm">
                            Sau khi lưu:{" "}
                            {policy.checkScope
                              ? readConditionVi(policy.checkScope)
                              : "vẫn theo điều kiện trên — để không ai chuyển được bản ghi ra khỏi phạm vi mình thấy"}
                            .
                          </span>
                        )}
                        {/* The quarantine note beside the rule rather than only
                          in a log: whoever can fix it is looking at this. */}
                        {policy.invalidReason && (
                          <span className="text-destructive flex items-start gap-1 text-sm">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            Đã bị tắt khi khởi động vì điều kiện không còn hợp
                            lệ: {policy.invalidReason}
                          </span>
                        )}
                      </div>

                      {mayWrite && (
                        <div className="flex shrink-0">
                          <RecordActionsMenu
                            resource={POLICY_RESOURCE}
                            id={policy.id}
                            editLabel={false}
                            showLabel={false}
                            items={[
                              {
                                key: "edit",
                                label: "Sửa phạm vi",
                                icon: Pencil,
                                onSelect: () => setEditing({ id: policy.id }),
                              },
                            ]}
                            remove={{
                              label: "Xoá phạm vi",
                              title: `Xoá phạm vi “${policy.name}”?`,
                              description:
                                "Vai trò sẽ không còn thấy phần dữ liệu mà phạm vi này mở ra. Việc xoá không lấy lại được.",
                              successMessage: `Đã xoá phạm vi ${policy.name}`,
                            }}
                            onDeleted={() => void refetch()}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        Keyed, and mounted only while open, so switching from one scope to
        another starts a fresh form rather than reusing one already holding the
        previous record.
      */}
      {editing && (
        <PolicyDialog
          key={editing.id ?? "create"}
          roleId={roleId}
          roleCode={roleCode}
          roleName={roleName}
          policyId={editing.id}
          resources={resources}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

type PolicyDialogProps = {
  roleId: number;
  roleCode: string | undefined;
  roleName: string | undefined;
  /** Absent for a new scope. */
  policyId?: number;
  resources: string[];
  onClose: () => void;
  onSaved: () => void;
};

/**
 * One scope, in a dialog.
 *
 * It writes through `row_level_policies` rather than through the role, so the
 * compiler's `422` — which names the node at fault — reaches the person who
 * wrote the condition, and the audit trail records the rule that changed rather
 * than "the role was edited".
 *
 * `DialogContent` renders through a portal, so the form below is not a DOM
 * descendant of the role form it visually sits inside. That is what makes a
 * form-within-a-form legal here; every button that is *not* portaled out has to
 * say `type="button"` instead.
 */
function PolicyDialog({
  roleId,
  roleCode,
  roleName,
  policyId,
  resources,
  onClose,
  onSaved,
}: PolicyDialogProps) {
  const isEdit = policyId !== undefined;

  const inset = useShellInset();

  /**
   * Annotated, not inferred, and it is what types the whole form.
   *
   * `useForm` reads its field type off `defaultValues`, so an inferred literal
   * would widen `kind` to `string` and pin `role.id` to `number` — neither of
   * which is `PolicyFormValues`, and `PolicyForm` takes nothing else. Naming
   * the type here is the same trick `DEFAULT_POLICY` uses for the standalone
   * screens, with the role filled in.
   */
  const defaults: PolicyFormValues = {
    ...DEFAULT_POLICY,
    // A role's screen writes scopes and only scopes.
    kind: "SCOPE",
    role: { id: roleId },
  };

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Hộp thoại đóng là bỏ, không qua cảnh báo rời trang; để cờ của Refine bật ở đây thì
    // sau khi đóng, rời màn vai trò vẫn bị hỏi oan.
    warnWhenUnsavedChanges: false,
    refineCoreProps: {
      resource: POLICY_RESOURCE,
      action: isEdit ? "edit" : "create",
      id: policyId,
      // The dialog closes; the page underneath stays where it was. Refine's
      // default would navigate to the policy list and take the role screen with
      // it.
      redirect: false,
      onMutationSuccess: () => onSaved(),
      successNotification: () => ({
        type: "success",
        message: isEdit ? "Đã lưu phạm vi dữ liệu" : "Đã thêm phạm vi dữ liệu",
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không lưu được phạm vi dữ liệu",
        description: errorDescription(error),
      }),
    },
    defaultValues: defaults,
  });

  const policy = query?.data?.data as RowLevelPolicy | undefined;

  /**
   * Whether the record has been written into the form yet.
   *
   * The same gate `row-level-policies/edit.tsx` explains at length: `reset` can
   * only run from an effect, which is always after a render, so a form mounted
   * before it holds the record mounts holding the defaults — and a Radix
   * `Select` whose value arrives after mount renders its placeholder instead of
   * its label. Mounting once, already populated, removes the class of problem
   * rather than the two fields where it happens to show.
   */
  const [hydrated, setHydrated] = useState(!isEdit);

  const { reset } = form;
  useEffect(() => {
    if (!policy) return;
    reset(
      {
        kind: policy.kind,
        role: { id: policy.role?.id ?? roleId },
        resource: policy.resource,
        action: policy.action,
        name: policy.name,
        policyGroup: policy.policyGroup ?? "",
        description: policy.description ?? "",
        scope: policy.scope ?? EMPTY_SCOPE,
        // Null stays null: it means "the same as the condition above", which is
        // not the same thing as an empty tree.
        checkScope: policy.checkScope ?? null,
        enabled: policy.enabled,
      },
      { keepDirtyValues: true }
    );
    setHydrated(true);
  }, [policy, reset, roleId]);

  function onSubmit(values: PolicyFormValues) {
    onFinish(normalize(values));
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        // The rail's own width, so the surface can start where the content
        // column does. See `useShellInset` for why it has to be handed in.
        style={{ "--shell-inset": inset } as CSSProperties}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          // Spans the content column rather than sitting at a centred fixed
          // width. The condition builder is a tree that indents once per
          // nesting level and puts a field, an operator and a value on one row;
          // narrow, every row wraps and a two-level condition stops being
          // readable at all.
          "top-4 bottom-4 left-[calc(var(--shell-inset)+1rem)] right-4",
          "w-auto translate-x-0 translate-y-0",
          // Both halves, and this is the trap: `tailwind-merge` treats a bare
          // utility and its `sm:` variant as different groups, so `max-w-none`
          // on its own leaves the stock `sm:max-w-lg` in force from `sm`
          // upwards — which is every screen this shell is used on. The dialog
          // would come out looking exactly as narrow as before.
          "max-w-none sm:max-w-none"
        )}
      >
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>
            {isEdit ? "Sửa phạm vi dữ liệu" : "Thêm phạm vi dữ liệu"}
          </DialogTitle>
          <DialogDescription>
            Những dòng dữ liệu {roleName ?? "vai trò này"} được thấy. Phạm vi được
            lưu riêng ngay khi bấm lưu ở đây — nút “Lưu thay đổi” của vai trò chỉ
            lưu thông tin và quyền.
          </DialogDescription>
        </DialogHeader>

        {hydrated ? (
          // `min-h-0`, or the body below refuses to shrink and pushes the
          // footer off the bottom instead of scrolling inside itself.
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 overflow-y-auto">
              {policy?.invalidReason && (
                <div className="px-6 pt-5">
                  <Alert variant="destructive">
                    <TriangleAlert className="size-4" />
                    <AlertDescription>
                      Phạm vi này đã bị tắt khi khởi động vì điều kiện không còn
                      hợp lệ: {policy.invalidReason}. Sửa điều kiện rồi bật lại —
                      khi lưu hệ thống kiểm tra lại và xoá lý do nếu đã đúng.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <PolicyForm
                form={form}
                resources={resources}
                currentRole={{
                  id: roleId,
                  code: roleName ?? roleCode ?? "",
                }}
                lockRole
                lockKind
                // On edit, the resource is part of what the policy *is*:
                // changing it withdraws one rule and introduces another, which
                // the API refuses for the same reason.
                lockIdentity={isEdit}
              />
            </div>

            {/* Outside the scrolling body, so the two buttons stay put however
                deep the condition tree gets. */}
            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Đang lưu..."
                  : isEdit
                  ? "Lưu phạm vi"
                  : "Thêm phạm vi"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * How far the shell's content column starts from the left edge.
 *
 * A dialog is portaled to `document.body`, which is outside the element
 * carrying `--sidebar-width` — the variable is simply not in scope there, and
 * no amount of CSS reaches it. React context *does* travel through a portal,
 * though, so the sidebar's own state is readable here, and the two widths are
 * exported from the layout that sets them rather than written down a second
 * time.
 */
function useShellInset(): string {
  const { isMobile, state } = useSidebar();

  // Off-canvas on mobile: the sidebar is a sheet, so there is no rail to avoid.
  if (isMobile) return "0rem";

  return state === "collapsed" ? SHELL_SIDEBAR_WIDTH_ICON : SHELL_SIDEBAR_WIDTH;
}
