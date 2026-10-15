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
import { cn } from "@/shared/lib/utils";
import type { Organization } from "@/domains/organization/types";
import type { Department } from "@/domains/department/types";
import type { DepartmentSummary, OrganizationSummary } from "@/domains/user/types";

/**
 * Where an account sits in the company: an organization, and optionally a
 * department inside it.
 *
 * The two are one control rather than two independent fields because they are
 * not independent. The API refuses a department that belongs to a different
 * organization than the user's — the `users (organization_id, department_id)`
 * composite foreign key makes that state unrepresentable — so the picker filters
 * the department list by the chosen organization and clears the department
 * whenever the organization changes. Offering all departments and letting the
 * save fail would be a form that invites a mistake and then reports it.
 *
 * Both fields are optional. `NONE` is the sentinel the `Select` needs because
 * Radix reserves the empty string for "nothing selected"; it is translated back
 * to `{ id: null }`, which is how the API is told to clear a placement rather
 * than leave it alone.
 */

export type PlacementRef = { id: number | null };

/** Radix `Select` treats `value=""` as unselected, so "none" needs a real value. */
const NONE = "__none__";

type PlacementPickerProps = {
  organization: PlacementRef | null | undefined;
  department: PlacementRef | null | undefined;
  onOrganizationChange: (value: PlacementRef) => void;
  onDepartmentChange: (value: PlacementRef) => void;
  /**
   * The record's own placement, on an edit form. Merged into the options so the
   * trigger shows the current value even before the lists arrive — and even
   * when they never do, because reading them is a separate grant.
   */
  currentOrganization?: OrganizationSummary | null;
  currentDepartment?: DepartmentSummary | null;
  /**
   * The wrapper around the two fields. It defaults to a column, which is what a
   * narrow form wants; a form laying its fields out on a grid passes
   * `"contents"` so the two `FormItem`s become children of *that* grid and can
   * sit beside the fields they belong with.
   */
  className?: string;
  /** Applied to each of the two fields — a column span, on such a grid. */
  itemClassName?: string;
};

export function PlacementPicker({
  organization,
  department,
  onOrganizationChange,
  onDepartmentChange,
  currentOrganization,
  currentDepartment,
  className,
  itemClassName,
}: PlacementPickerProps) {
  // Reading organizations and departments are separate grants from writing
  // users, so a role can hold one without the others. Asking anyway spends a
  // request on a guaranteed 403 and raises an error toast over the form.
  const { data: canReadOrganizations } = useCan({
    resource: "organizations",
    action: "list",
  });
  const { data: canReadDepartments } = useCan({
    resource: "departments",
    action: "list",
  });
  const mayReadOrganizations = canReadOrganizations?.can ?? false;
  const mayReadDepartments = canReadDepartments?.can ?? false;

  const organizationId = organization?.id ?? null;

  const {
    result: organizationResult,
    query: { isLoading: organizationsLoading },
  } = useList<Organization>({
    resource: "organizations",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadOrganizations },
  });

  // Filtered by the API rather than fetched whole and narrowed here: the
  // department list is the one that grows with the number of companies, and
  // `DepartmentSpecifications` already handles `organization.id`.
  const {
    result: departmentResult,
    query: { isLoading: departmentsLoading },
  } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    filters: organizationId
      ? [{ field: "organization.id", operator: "eq", value: organizationId }]
      : [],
    queryOptions: {
      enabled: mayReadDepartments && Boolean(organizationId),
    },
  });

  /**
   * The record's own organization, merged in rather than waited for.
   *
   * `Select` matches its `value` against the items mounted at that moment and
   * does not re-run the match when items arrive later, so on an edit form the
   * current value has to be an option no later than the render that fills the
   * form from the record. Same reasoning as the department edit dialog.
   */
  const organizationOptions = useMemo(() => {
    const list = (organizationResult?.data ?? []).map((o) => ({
      value: String(o.id),
      label: o.name,
    }));
    if (!currentOrganization) return list;
    return list.some((o) => o.value === String(currentOrganization.id))
      ? list
      : [
          {
            value: String(currentOrganization.id),
            label: currentOrganization.name,
          },
          ...list,
        ];
  }, [organizationResult?.data, currentOrganization]);

  const departmentOptions = useMemo(() => {
    const list = (departmentResult?.data ?? []).map((d) => ({
      value: String(d.id),
      label: d.name,
    }));
    // Only merged while the record is still in the organization it was loaded
    // with. Once the organization is changed the old department is no longer a
    // legal choice, and showing it would be offering the one value the API is
    // certain to refuse.
    const stillApplies =
      currentDepartment &&
      currentOrganization &&
      String(organizationId) === String(currentOrganization.id);
    if (!stillApplies) return list;
    return list.some((d) => d.value === String(currentDepartment.id))
      ? list
      : [
          {
            value: String(currentDepartment.id),
            label: currentDepartment.name,
          },
          ...list,
        ];
  }, [
    departmentResult?.data,
    currentDepartment,
    currentOrganization,
    organizationId,
  ]);

  const handleOrganization = (raw: string) => {
    const next = raw === NONE ? null : Number(raw);
    onOrganizationChange({ id: next });
    // A department only means something inside its organization, so it cannot
    // survive the organization changing under it. Clearing it here is what
    // stops the form from submitting a pair the API would refuse.
    onDepartmentChange({ id: null });
  };

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <FormItem className={itemClassName}>
        <FormLabel>Organization</FormLabel>
        <Select
          onValueChange={handleOrganization}
          value={organizationId == null ? NONE : String(organizationId)}
          disabled={!mayReadOrganizations}
        >
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={organizationsLoading ? "Loading..." : "Not placed"}
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value={NONE}>Not placed</SelectItem>
            {organizationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormDescription>
          {mayReadOrganizations
            ? "Optional. An account can sign in without belonging to one."
            : "You need the organizations:read permission to change this."}
        </FormDescription>
      </FormItem>

      <FormItem className={itemClassName}>
        <FormLabel>Department</FormLabel>
        <Select
          onValueChange={(raw) =>
            onDepartmentChange({ id: raw === NONE ? null : Number(raw) })
          }
          value={department?.id == null ? NONE : String(department.id)}
          disabled={!mayReadDepartments || !organizationId}
        >
          <FormControl>
            <SelectTrigger className="w-full">
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
          {!mayReadDepartments
            ? "You need the departments:read permission to change this."
            : !organizationId
            ? "Choose an organization first — a department only exists inside one."
            : "Optional, and limited to the organization above."}
        </FormDescription>
      </FormItem>
    </div>
  );
}
