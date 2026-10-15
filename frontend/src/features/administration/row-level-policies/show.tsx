import { useCan, useShow } from "@refinedev/core";
import { TriangleAlert } from "lucide-react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { ExplainPanel } from "./explain-panel";
import { readCondition } from "@/domains/row-level-policy/read-condition";
import type { RowLevelPolicy } from "@/domains/row-level-policy/types";
import { formatDateTime } from "@/shared/lib/format";

export const RowLevelPolicyShow = () => {
  const { result: record, query } = useShow<RowLevelPolicy>({});
  const { isLoading } = query;

  // The explain and simulate endpoints take somebody else's account id, so they
  // require users:read on top of the policy permission. Without it they would
  // 403, so the panel is not offered rather than offered and then refused.
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const mayExplain = canReadUsers?.can ?? false;

  return (
    <ShowView>
      <ShowViewHeader />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {record?.name ?? "—"}
            {record && (
              <Badge variant={record.kind === "FILTER" ? "default" : "secondary"}>
                {record.kind}
              </Badge>
            )}
            {record && !record.enabled && <Badge variant="outline">Off</Badge>}
          </CardTitle>
          <CardDescription className="font-mono">
            {record?.resource} · {record?.action} ·{" "}
            {record?.role ? record.role.code : "everyone"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              {record?.invalidReason && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>
                    Disabled at startup because it no longer compiles:{" "}
                    {record.invalidReason}
                    {record.kind === "FILTER" && (
                      <>
                        {" "}
                        Because this is a filter, everything on{" "}
                        <span className="font-mono">
                          {record.resource}:{record.action}
                        </span>{" "}
                        is refused until it is fixed — a prohibition that stopped
                        applying is a leak, and losing one rule quietly is worse
                        than losing the screen loudly.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  What it does
                </span>
                <p className="text-sm">
                  {record?.kind === "FILTER"
                    ? "Removes rows from everybody, whatever roles they hold. It names no role, which is what makes it inescapable."
                    : `Widens what ${record?.role?.code ?? "a role"} can reach. It unions with that account's other scopes, so holding one more role only ever adds rows.`}
                </p>
              </div>

              {record?.description && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Description
                  </span>
                  <p className="text-sm">{record.description}</p>
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Condition
                </span>
                <p className="text-sm">
                  {record ? readCondition(record.scope) : "—"}
                </p>
                {/*
                  The stored tree as well as the sentence. Anybody debugging a
                  policy eventually wants to see exactly what is in the column,
                  and the alternative is opening devtools to find out.
                */}
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {record ? JSON.stringify(record.scope, null, 2) : ""}
                </pre>
              </div>

              {record?.action === "write" && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    What it may become
                  </span>
                  {record.checkScope ? (
                    <>
                      <p className="text-sm">{readCondition(record.checkScope)}</p>
                      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                        {JSON.stringify(record.checkScope, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="text-sm">
                      The same condition, applied to the record after the save —
                      which is what stops it being moved somewhere its writer
                      cannot see.
                    </p>
                  )}
                </div>
              )}

              <Separator />

              <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
                <span>
                  Created by {record?.createdBy?.username ?? "—"}
                  {record?.createdAt
                    ? ` on ${formatDateTime(record.createdAt)}`
                    : ""}
                </span>
                <span>
                  Last changed by {record?.updatedBy?.username ?? "—"}
                  {record?.updatedAt
                    ? ` on ${formatDateTime(record.updatedAt)}`
                    : ""}
                </span>
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>

      {record && mayExplain && (
        <ExplainPanel resource={record.resource} action={record.action} />
      )}
    </ShowView>
  );
};
