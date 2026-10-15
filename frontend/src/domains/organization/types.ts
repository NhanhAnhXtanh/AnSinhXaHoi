/**
 * The `organizations` resource as the API reports it — `OrganizationResponse`
 * on the backend.
 *
 * Nothing generates this from the Java record, so the two are kept in step by
 * hand; that is the same bargain the rest of the API contract is on.
 */
export type Organization = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string | null;
};

/**
 * Mirrors `OrganizationStatus`; these are the lower-case wire values, not the
 * Java constants.
 */
export type OrganizationStatus = "active" | "inactive";

export const STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const STATUS_OPTIONS: { label: string; value: OrganizationStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];
