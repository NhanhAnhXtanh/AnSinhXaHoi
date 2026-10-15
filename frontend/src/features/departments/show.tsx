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
import type { Department } from "@/domains/department/types";
import { STATUS_LABELS } from "@/domains/department/types";
import { formatDateTime } from "@/shared/lib/format";
import { DEPARTMENT_STATUS_VARIANTS } from "@/shared/lib/status-variants";

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

export const DepartmentShow = () => {
  const { result: record, query } = useShow<Department>({});
  const { isLoading } = query;

  return (
    <ShowView>
      <ShowViewHeader />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {record?.name ?? "—"}
            {record?.status ? (
              <Badge variant={DEPARTMENT_STATUS_VARIANTS[record.status] ?? "secondary"}>
                {STATUS_LABELS[record.status] ?? record.status}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription className="font-mono">
            {record?.code} · Department ID: {record?.id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              <Field label="Organization">
                {/*
                  Linked rather than merely named: the department carries the
                  whole organization summary, so the id for the link is already
                  here and needs no second request.
                */}
                {record?.organization ? (
                  <Link
                    to={`/organizations/show/${record.organization.id}`}
                    className="hover:underline"
                  >
                    {record.organization.name}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {record.organization.code}
                    </span>
                  </Link>
                ) : (
                  "—"
                )}
              </Field>

              <Field label="Description">{record?.description ?? "—"}</Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Email">{record?.email ?? "—"}</Field>
                <Field label="Phone">{record?.phone ?? "—"}</Field>
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
