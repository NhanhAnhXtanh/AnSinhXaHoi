import { useCustom } from "@refinedev/core";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import { ACTIONS, type CoverageResponse } from "@/domains/row-level-policy/types";

/**
 * The coverage grid: which roles have a scope on which resource, per action.
 *
 * It exists to make one specific thing impossible to miss. A resource whose
 * default is `FULL` and a role with no scope means that role is **not narrowed
 * at all** — which is the price of being able to switch a running resource on
 * without anybody losing a row on the day it ships. Left implicit, that price
 * is a default somebody guessed at months ago; shown here, it is a red cell
 * with a name on it.
 *
 * A resource on `NONE` with no scope is the opposite and is fine: the role sees
 * nothing, which is loud, immediate and safe. It is marked, not coloured.
 */
export function CoverageMatrix() {
  const { result, query } = useCustom<CoverageResponse>({
    url: `${API_URL}/row_level_policies/coverage`,
    method: "get",
  });

  // Same trap as in `policy-form`: a query with no data yet reports a frozen
  // empty object, which is truthy and has no `resources` to read a length off.
  const coverage = customResult(result?.data, "resources");

  if (query.isLoading) {
    return null;
  }

  if (!coverage || coverage.resources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coverage</CardTitle>
          <CardDescription>
            No resource is under row-level management yet. A resource joins by
            declaring a policy set in code, not by adding a row here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roles = [...new Set(coverage.resources.flatMap((resource) =>
    resource.cells.map((cell) => cell.role)))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage</CardTitle>
        <CardDescription>
          Where a role has no scope, the resource&apos;s declared default
          decides. A red cell is a role that is not narrowed at all — usually
          because nobody has written its policy yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {coverage.resources.map((resource) => (
          <div key={resource.resource} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{resource.resource}</span>
              <Badge
                variant={resource.defaultScope === "FULL" ? "secondary" : "outline"}
              >
                default: {resource.defaultScope === "FULL"
                  ? "sees everything"
                  : "sees nothing"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Role</TableHead>
                    {ACTIONS.map((action) => (
                      <TableHead key={action}>{action}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role}>
                      <TableCell className="font-mono text-xs">{role}</TableCell>
                      {ACTIONS.map((action) => {
                        const cell = resource.cells.find(
                          (candidate) =>
                            candidate.role === role && candidate.action === action
                        );
                        return (
                          <TableCell key={action}>
                            <RiskBadge risk={cell?.risk} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: string | undefined }) {
  if (risk === "OK") {
    return <Badge variant="outline">scoped</Badge>;
  }
  if (risk === "CLOSED") {
    // Fail-closed, which is the destination for every resource. Worth naming so
    // nobody "fixes" it by writing a scope that grants everything.
    return (
      <Badge variant="outline" className="text-muted-foreground">
        no rows
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "bg-destructive/10 text-destructive border-destructive/30",
        "border"
      )}
      variant="outline"
    >
      unrestricted
    </Badge>
  );
}
