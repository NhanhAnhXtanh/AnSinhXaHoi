import { useShow } from "@refinedev/core";
import { Link } from "react-router";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import type { Task } from "@/domains/task/types";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/domains/task/types";
import { TASK_PRIORITY_VARIANTS, TASK_STATUS_VARIANTS } from "@/shared/lib/status-variants";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export const TaskShow = () => {
  const { result: record, query } = useShow<Task>({});
  const { isLoading } = query;

  return (
    <ShowView>
      <ShowViewHeader />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {record?.title ?? "—"}
            {record?.status ? (
              <Badge variant={TASK_STATUS_VARIANTS[record.status] ?? "secondary"}>
                {STATUS_LABELS[record.status] ?? record.status}
              </Badge>
            ) : null}
            {record?.priority ? (
              <Badge variant={TASK_PRIORITY_VARIANTS[record.priority] ?? "secondary"}>
                {PRIORITY_LABELS[record.priority] ?? record.priority}
              </Badge>
            ) : null}
            {/*
              Reported by the API rather than worked out here, so that "late"
              means the same thing on this page, in the list and in the filter.
            */}
            {record?.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
          </CardTitle>
          <CardDescription>Task ID: {record?.id}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              <Field label="Description">
                {record?.description ? (
                  <p className="whitespace-pre-wrap">{record.description}</p>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>

              <Separator />

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Assignee">
                  {record?.assignee ? (
                    <Link
                      to={`/users/show/${record.assignee.id}`}
                      className="hover:underline"
                    >
                      {record.assignee.fullName}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {record.assignee.username}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </Field>
                <Field label="Department">
                  {record?.department ? (
                    <Link
                      to={`/departments/show/${record.department.id}`}
                      className="hover:underline"
                    >
                      {record.department.name}
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        {record.department.code}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </Field>
              </div>

              <Separator />

              <div className="grid gap-6 sm:grid-cols-3">
                <Field label="Due">
                  <span
                    className={record?.overdue ? "text-destructive font-medium" : ""}
                  >
                    {formatDate(record?.dueDate)}
                  </span>
                </Field>
                <Field label="Completed">
                  {formatDateTime(record?.completedAt)}
                </Field>
                <Field label="Raised by">
                  {/*
                    Null once the account that raised it has been deleted — the
                    foreign key is ON DELETE SET NULL, because the history is
                    worth keeping but not worth refusing to delete a leaver's
                    account over.
                  */}
                  {record?.createdBy ? (
                    <Link
                      to={`/users/show/${record.createdBy.id}`}
                      className="hover:underline"
                    >
                      {record.createdBy.fullName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Field>
              </div>

              <Separator />

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Created">
                  {formatDateTime(record?.createdAt)}
                </Field>
                <Field label="Last updated">
                  {formatDateTime(record?.updatedAt)}
                </Field>
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>
    </ShowView>
  );
};
