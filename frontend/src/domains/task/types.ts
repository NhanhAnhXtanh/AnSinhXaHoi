/**
 * The `tasks` resource as the API reports it — `TaskResponse` on the backend.
 *
 * Nothing generates this from the Java record, so the two are kept in step by
 * hand; that is the same bargain the rest of the API contract is on.
 */
export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: UserSummary | null;
  department: DepartmentSummary | null;
  dueDate: string | null;
  completedAt: string | null;
  createdBy: UserSummary | null;
  /**
   * Computed by the API, not here.
   *
   * Working it out in the browser would let a client in another timezone
   * disagree with the `overdue` filter about which tasks are late today.
   */
  overdue: boolean;
  createdAt: string;
  updatedAt: string | null;
};

/** The user as a task row reports it — no email, no status, no roles. */
export type UserSummary = {
  id: number;
  username: string;
  fullName: string;
};

/** The department as a task row reports it. */
export type DepartmentSummary = {
  id: number;
  code: string;
  name: string;
};

/** Mirrors `TaskStatus`; these are the lower-case wire values. */
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

/** Mirrors `TaskPriority`. */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/**
 * Written out in wire order rather than derived from the label maps, because
 * these are a contract with the Java enums: a value that is not one of them
 * filters to nothing rather than failing loudly.
 */
export const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
  { label: "To do", value: "todo" },
  { label: "In progress", value: "in_progress" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

/** Ordered by importance, which is the one order the API cannot sort by. */
export const PRIORITY_OPTIONS: { label: string; value: TaskPriority }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];
