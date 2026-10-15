import { useMemo } from "react";
import { useCan, useList } from "@refinedev/core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
} from "@/shared/ui/form";
import type { Department as DepartmentRow } from "@/domains/department/types";
import type { User as UserRow } from "@/domains/user/types";
import type { DepartmentSummary, UserSummary } from "@/domains/task/types";

/**
 * Who is doing the task, and which team owns it.
 *
 * The two are independent, unlike the organization/department pair on a user:
 * an unassigned task can still belong to a department, and a task can be handed
 * to somebody outside the team that owns it. So this is two plain selects
 * grouped for reuse across the create and edit forms, not one coupled control.
 *
 * Both are optional. `NONE` is the sentinel the `Select` needs because Radix
 * reserves the empty string for "nothing selected"; it is translated back to
 * `{ id: null }`, which is how the API is told to clear a reference rather than
 * leave it alone.
 */

export type TaskRef = { id: number | null };

/** Radix `Select` treats `value=""` as unselected, so "none" needs a real value. */
const NONE = "__none__";

type AssignmentPickerProps = {
  assignee: TaskRef | null | undefined;
  department: TaskRef | null | undefined;
  onAssigneeChange: (value: TaskRef) => void;
  onDepartmentChange: (value: TaskRef) => void;
  /**
   * The record's own values, on an edit form. Merged into the options so the
   * trigger shows the current assignee before the lists arrive — and even when
   * they never do, because reading users is a separate grant.
   */
  currentAssignee?: UserSummary | null;
  currentDepartment?: DepartmentSummary | null;
};

export function AssignmentPicker({
  assignee,
  department,
  onAssigneeChange,
  onDepartmentChange,
  currentAssignee,
  currentDepartment,
}: AssignmentPickerProps) {
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const { data: canReadDepartments } = useCan({
    resource: "departments",
    action: "list",
  });
  const mayReadUsers = canReadUsers?.can ?? false;
  const mayReadDepartments = canReadDepartments?.can ?? false;

  const {
    result: userResult,
    query: { isLoading: usersLoading },
  } = useList<UserRow>({
    resource: "users",
    pagination: { pageSize: 200 },
    sorters: [{ field: "fullName", order: "asc" }],
    queryOptions: { enabled: mayReadUsers },
  });

  const {
    result: departmentResult,
    query: { isLoading: departmentsLoading },
  } = useList<DepartmentRow>({
    resource: "departments",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadDepartments },
  });

  /**
   * The record's own assignee, merged in rather than waited for.
   *
   * `Select` matches its `value` against the items mounted at that moment and
   * does not re-run the match when items arrive later, so on an edit form the
   * current value has to be an option no later than the render that fills the
   * form from the record.
   */
  const userOptions = useMemo(() => {
    const list = (userResult?.data ?? []).map((u) => ({
      value: String(u.id),
      label: u.fullName,
    }));
    if (!currentAssignee) return list;
    return list.some((o) => o.value === String(currentAssignee.id))
      ? list
      : [
          { value: String(currentAssignee.id), label: currentAssignee.fullName },
          ...list,
        ];
  }, [userResult?.data, currentAssignee]);

  const departmentOptions = useMemo(() => {
    const list = (departmentResult?.data ?? []).map((d) => ({
      value: String(d.id),
      label: `${d.organization.name} · ${d.name}`,
    }));
    if (!currentDepartment) return list;
    return list.some((o) => o.value === String(currentDepartment.id))
      ? list
      : [
          { value: String(currentDepartment.id), label: currentDepartment.name },
          ...list,
        ];
  }, [departmentResult?.data, currentDepartment]);

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <FormItem>
        <FormLabel>Assignee</FormLabel>
        <Select
          onValueChange={(raw) =>
            onAssigneeChange({ id: raw === NONE ? null : Number(raw) })
          }
          value={assignee?.id == null ? NONE : String(assignee.id)}
          disabled={!mayReadUsers}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue
                placeholder={usersLoading ? "Loading..." : "Unassigned"}
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value={NONE}>Unassigned</SelectItem>
            {userOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormDescription>
          {mayReadUsers
            ? "Whoever is assigned is notified, unless it is you."
            : "You need the users:read permission to change this."}
        </FormDescription>
      </FormItem>

      <FormItem>
        <FormLabel>Department</FormLabel>
        <Select
          onValueChange={(raw) =>
            onDepartmentChange({ id: raw === NONE ? null : Number(raw) })
          }
          value={department?.id == null ? NONE : String(department.id)}
          disabled={!mayReadDepartments}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue
                placeholder={departmentsLoading ? "Loading..." : "None"}
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {departmentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormDescription>
          {mayReadDepartments
            ? "The team that owns the work, which need not be the assignee's own."
            : "You need the departments:read permission to change this."}
        </FormDescription>
      </FormItem>
    </div>
  );
}
