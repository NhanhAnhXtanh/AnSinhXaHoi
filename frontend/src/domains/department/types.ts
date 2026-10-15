/**
 * The `departments` resource as the API reports it — `DepartmentResponse` on
 * the backend.
 *
 * Nothing generates this from the Java record, so the two are kept in step by
 * hand; that is the same bargain the rest of the API contract is on.
 */
export type Department = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  organization: OrganizationSummary;
  email: string | null;
  phone: string | null;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string | null;
};

/**
 * The organization as a department row reports it — narrower than the
 * organization resource's own payload, and declared here rather than imported
 * from `../organizations/types` for the same reason the backend declares its
 * own nested record: what this endpoint returns is this endpoint's contract.
 */
export type OrganizationSummary = {
  id: number;
  code: string;
  name: string;
  status: "active" | "inactive";
};

/**
 * Mirrors `DepartmentStatus`; these are the lower-case wire values, not the
 * Java constants.
 */
export type DepartmentStatus = "active" | "inactive";

export const STATUS_LABELS: Record<DepartmentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const STATUS_OPTIONS: { label: string; value: DepartmentStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];
