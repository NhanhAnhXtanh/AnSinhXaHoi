import { useState } from "react";
import { useCan, useShow } from "@refinedev/core";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/tabs/tabs";
import {
  MetaItem,
  MetaStrip,
} from "@/shared/components/views/record-detail";
import { PermissionMatrix } from "./permission-matrix";
import { RoleDataScopes } from "./data-scopes";
import type { Role } from "@/domains/role/types";

/**
 * The line beside each tab, said once rather than as a heading on top of the
 * panel it describes. Same band, same wording as the edit screen.
 */
const TAB_HINTS: Record<string, string> = {
  permissions:
    "A row is a resource, a column an action. Every endpoint re-checks the code it needs, so this is the whole of what the API will answer for.",
  scopes:
    "A permission decides whether an endpoint answers this role at all; a scope decides which rows it answers with. Open the role for editing to change one.",
};

/**
 * Reading a role.
 *
 * The same three parts as the edit screen, in the same order and the same
 * proportions: one identity strip on top, then the two halves of what a role
 * grants as tabs with the panel below them taking the rest of the screen. What
 * you read here and what you change there should not be two different shapes.
 *
 * The permissions are the matrix rather than a wall of code badges, and for the
 * same reason the edit screen draws one: a code is a resource *and* an action,
 * and a flat list of forty of them flattens one of those axes away. Read-only
 * here — the boxes are marks, and it opens on the rows that actually grant
 * something, with the whole catalogue one button away.
 */
export const RoleShow = () => {
  const { result: record, query } = useShow<Role>({});
  const { isLoading } = query;

  // `row_level_policies:*` is seeded to ADMIN alone. Somebody who may read a
  // role is not necessarily somebody who may read its data scopes, so the tab
  // is not offered rather than offered and then refused.
  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");

  return (
    <ShowView>
      <ShowViewHeader />

      {/*
        Everything this role *is*, on one strip: what it is called and what it
        is for on the left, the facts the API settled on the right. It replaces
        a card whose header carried the name and whose body carried a single
        paragraph — the same content over three times the height.
      */}
      <Card className="py-4">
        <LoadingOverlay loading={isLoading}>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4 px-6">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg leading-6 font-semibold tracking-tight">
                  {record?.name ?? "—"}
                </h2>
                {record?.systemRole && (
                  <Badge variant="secondary">System</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {record?.description || "No description."}
              </p>
            </div>

            <MetaStrip className="shrink-0">
              <MetaItem label="Code">
                <span className="font-mono">{record?.code ?? "—"}</span>
              </MetaItem>
              <MetaItem label="Role ID">
                <span className="tabular-nums">{record?.id ?? "—"}</span>
              </MetaItem>
              <MetaItem label="Permissions">
                <span className="tabular-nums">
                  {record?.permissions?.length ?? 0}
                </span>
              </MetaItem>
            </MetaStrip>
          </div>
        </LoadingOverlay>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TabsList>
            <TabsTrigger value="permissions">
              Permissions
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {record?.permissions?.length ?? 0}
              </Badge>
            </TabsTrigger>
            {mayReadScopes && (
              <TabsTrigger value="scopes">Data scopes</TabsTrigger>
            )}
          </TabsList>

          <p className="text-muted-foreground hidden max-w-3xl text-xs leading-5 lg:block lg:ms-auto lg:text-right">
            {TAB_HINTS[tab]}
          </p>
        </div>

        <TabsContent value="permissions">
          {/* Less to reserve than on the edit screen: no save bar at the
              bottom, and an identity strip with no fields in it. */}
          <Card className="[--panel-reserve:25rem] gap-0 overflow-hidden py-0">
            <LoadingOverlay loading={isLoading}>
              {/* Keyed on the record, because the matrix opens on the granted
                  rows and works that out at mount: mounted before the role
                  arrived, it would open on "this role grants nothing" and stay
                  there. */}
              <PermissionMatrix
                key={record?.id ?? "loading"}
                value={record?.permissions}
                readOnly
              />
            </LoadingOverlay>
          </Card>
        </TabsContent>

        {mayReadScopes && (
          <TabsContent value="scopes">
            <Card className="gap-0 overflow-hidden py-0">
              <RoleDataScopes
                roleId={record?.id}
                roleCode={record?.code}
                readOnly
              />
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </ShowView>
  );
};
