import { useMemo } from "react";
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
import type { Role } from "@/domains/role/types";
import {
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/permission/types";
import { PERMISSION_ACTION_VARIANTS } from "@/shared/lib/status-variants";

export const PermissionShow = () => {
  const { result: record, query } = useShow<Permission>({});
  const { isLoading } = query;

  // Which roles grant this code — the question the catalogue actually raises,
  // and the reason this page exists rather than a tooltip on the list row.
  //
  // Answered client-side from the role list, because the payload already
  // carries each role's permissions and there is no endpoint that filters
  // roles by permission. That holds only while the role list is small enough
  // to fetch whole; a deployment with hundreds of roles wants an endpoint
  // instead of a wider page size here.
  const { data: canReadRoles } = useCan({ resource: "roles", action: "list" });
  const mayReadRoles = canReadRoles?.can ?? false;

  const {
    result: roleResult,
    query: { isLoading: rolesLoading },
  } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 200 },
    sorters: [{ field: "code", order: "asc" }],
    queryOptions: { enabled: mayReadRoles },
  });

  const grantedBy = useMemo(() => {
    if (!record) return [];
    return (roleResult?.data ?? []).filter((role) =>
      role.permissions.some((permission) => permission.id === record.id)
    );
  }, [record, roleResult?.data]);

  const { resource, action } = splitPermissionCode(record?.code ?? "");

  return (
    <ShowView>
      <ShowViewHeader />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {record?.name ?? "—"}
            {record?.systemPermission && (
              <Badge variant="secondary">System</Badge>
            )}
          </CardTitle>
          <CardDescription className="font-mono">
            {record?.code} · Permission ID: {record?.id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Description
                </span>
                <p className="text-sm">{record?.description ?? "—"}</p>
              </div>

              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Resource
                  </span>
                  <span className="text-sm">{humanizeResource(resource)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Action
                  </span>
                  <div>
                    <Badge variant={PERMISSION_ACTION_VARIANTS[action] ?? "outline"}>
                      {action || "—"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Granted by
                </span>

                {/*
                  Reading roles is a separate grant from reading the catalogue,
                  so this section explains its absence rather than rendering an
                  empty list that reads as "no role grants this".
                */}
                {!mayReadRoles ? (
                  <p className="text-muted-foreground text-sm">
                    You need the roles:read permission to see which roles grant
                    this.
                  </p>
                ) : rolesLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : grantedBy.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No role grants this permission, so nobody currently holds
                    it.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {grantedBy.map((role) => (
                      <Link key={role.id} to={`/roles/show/${role.id}`}>
                        <Badge
                          variant="outline"
                          className="hover:bg-accent cursor-pointer"
                        >
                          {role.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>
    </ShowView>
  );
};
