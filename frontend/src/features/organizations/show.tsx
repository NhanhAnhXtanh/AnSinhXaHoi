import { useCan, useList, useShow } from "@refinedev/core";
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
import { Skeleton } from "@/shared/ui/skeleton";
import type { Department } from "@/domains/department/types";
import {
  STATUS_LABELS as DEPARTMENT_STATUS_LABELS,
} from "@/domains/department/types";
import type { Organization } from "@/domains/organization/types";
import { STATUS_LABELS } from "@/domains/organization/types";
import { formatDateTime } from "@/shared/lib/format";
import { DEPARTMENT_STATUS_VARIANTS, ORGANIZATION_STATUS_VARIANTS } from "@/shared/lib/status-variants";

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

export const OrganizationShow = () => {
  const { result: record, query } = useShow<Organization>({});
  const { isLoading } = query;

  // Which departments belong to this organization — the question the record
  // raises and the one the list column cannot answer.
  //
  // Filtered by the API rather than client-side, because
  // `DepartmentSpecifications` already handles `organization.id`. Reading
  // departments is a separate grant from reading organizations, so the query is
  // gated rather than left to fail with a toast: a role can hold one without
  // the other, and this section explains its absence instead of rendering an
  // empty list that reads as "this organization has none".
  const { data: canReadDepartments } = useCan({
    resource: "departments",
    action: "list",
  });
  const mayReadDepartments = canReadDepartments?.can ?? false;

  const {
    result: departmentResult,
    query: { isLoading: departmentsLoading },
  } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    filters: record?.id
      ? [{ field: "organization.id", operator: "eq", value: record.id }]
      : [],
    queryOptions: { enabled: mayReadDepartments && Boolean(record?.id) },
  });

  const departments = departmentResult?.data ?? [];

  return (
    <ShowView>
      <ShowViewHeader />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {record?.name ?? "—"}
              {record?.status ? (
                <Badge variant={ORGANIZATION_STATUS_VARIANTS[record.status] ?? "secondary"}>
                  {STATUS_LABELS[record.status] ?? record.status}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="font-mono">
              {record?.code} · Organization ID: {record?.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingOverlay loading={isLoading}>
              <div className="flex flex-col gap-6">
                <Field label="Description">{record?.description ?? "—"}</Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Email">{record?.email ?? "—"}</Field>
                  <Field label="Phone">{record?.phone ?? "—"}</Field>
                </div>

                <Field label="Address">{record?.address ?? "—"}</Field>

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

        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Units that belong to this organization. An organization that still
              has any cannot be deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!mayReadDepartments ? (
              <p className="text-muted-foreground text-sm">
                You need the departments:read permission to see the departments
                of this organization.
              </p>
            ) : departmentsLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-6 w-48" />
              </div>
            ) : departments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No departments yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {departments.map((department) => (
                  <li
                    key={department.id}
                    className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col">
                      <Link
                        to={`/departments/show/${department.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {department.name}
                      </Link>
                      <span className="text-muted-foreground font-mono text-xs">
                        {department.code}
                      </span>
                    </div>
                    <Badge
                      variant={
                        DEPARTMENT_STATUS_VARIANTS[department.status] ??
                        "secondary"
                      }
                    >
                      {DEPARTMENT_STATUS_LABELS[department.status] ??
                        department.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ShowView>
  );
};
