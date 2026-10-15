import { useCustom, useCustomMutation, useSelect } from "@refinedev/core";
import { useState } from "react";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { ACTIONS, type ExplainResponse } from "@/domains/row-level-policy/types";

type SimulateResult = {
  allowed: boolean;
  evaluatedAs: "TRUE" | "FALSE" | "UNKNOWN";
  failedAt: string | null;
  because: string | null;
};

/**
 * The two operational tools, on the page where somebody already has the policy
 * in front of them.
 *
 * `Explain` answers "which rule is doing this". `Simulate` answers "why can
 * this person not see that record", and it answers in three values rather than
 * two — because `UNKNOWN` is both the commonest answer and the one nobody
 * guesses. It almost always means a null foreign key turning a whole branch
 * unknown, and unknown refuses the row.
 *
 * Both need `users:read` on top of the policy permission: simulating somebody
 * else's access is reading about somebody else. The panel simply does not
 * render for an account without it, because the endpoints would 403.
 */
export function ExplainPanel({
  resource,
  action: initialAction,
}: {
  resource: string;
  action: string;
}) {
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>(initialAction);
  const [recordId, setRecordId] = useState<string>("");
  const [simulation, setSimulation] = useState<SimulateResult | null>(null);

  const { options: userOptions } = useSelect({
    resource: "users",
    optionLabel: "username",
    optionValue: "id",
    sorters: [{ field: "username", order: "asc" }],
  });

  const { result: explainResult, query: explainQuery } = useCustom<ExplainResponse>({
    url: `${API_URL}/row_level_policies/explain`,
    method: "get",
    config: { query: { resource, action, userId } },
    queryOptions: { enabled: Boolean(userId) },
  });

  const { mutate: simulate, mutation } = useCustomMutation<SimulateResult>();

  // Disabled until an account is chosen, so this is the empty-object sentinel
  // far more often than not.
  const explanation = customResult(explainResult?.data, "principal");

  function runSimulation() {
    if (!userId || !recordId) return;
    simulate(
      {
        url: `${API_URL}/row_level_policies/simulate`,
        method: "post",
        values: {
          resource,
          action,
          userId: Number(userId),
          recordId: Number(recordId),
        },
      },
      {
        onSuccess: (response) => setSimulation(response.data as SimulateResult),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Why somebody sees what they see</CardTitle>
        <CardDescription>
          Pick an account to work out what the rules add up to for them, on{" "}
          <span className="font-mono">{resource}</span>. Naming a record answers
          the harder question: why a particular row is or is not reachable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Account</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {(userOptions ?? []).map((option) => (
                  <SelectItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {candidate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Record id</Label>
            <Input
              className="w-[140px]"
              type="number"
              value={recordId}
              placeholder="optional"
              onChange={(e) => setRecordId(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={!userId || !recordId || mutation.isPending}
            onClick={runSimulation}
          >
            {mutation.isPending ? "Checking..." : "Check this record"}
          </Button>
        </div>

        {simulation && (
          <Alert variant={simulation.allowed ? "default" : "destructive"}>
            <AlertDescription className="flex flex-col gap-1">
              <span className="font-medium">
                {simulation.allowed ? "Allowed" : "Refused"} — evaluated as{" "}
                {simulation.evaluatedAs}
              </span>
              {simulation.failedAt && (
                <span className="font-mono text-xs">{simulation.failedAt}</span>
              )}
              {simulation.because && <span>{simulation.because}</span>}
              {simulation.evaluatedAs === "UNKNOWN" && (
                <span className="text-xs">
                  Unknown is a refusal, not a maybe. A condition against an empty
                  value has no answer, and a row with no answer is not shown.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {userId && !explainQuery.isLoading && explanation && (
          <>
            <Separator />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Roles:</span>
              {explanation.principal.roleCodes.map((role) => (
                <Badge key={role} variant="secondary" className="font-mono text-[11px]">
                  {role}
                </Badge>
              ))}
              <span className="text-muted-foreground">Department:</span>
              <span className="font-mono text-xs">
                {explanation.principal.departmentId ?? "—"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Effective scope
              </span>
              <code className="bg-muted rounded-md p-3 text-xs break-words">
                {explanation.effective}
              </code>
            </div>

            <RuleList
              title="Scopes"
              hint="These union with each other, so holding one more role only ever widens."
              rules={explanation.scopes}
            />
            <RuleList
              title="Filters"
              hint="These always intersect and belong to nobody, so there is no role to not-hold in order to escape one."
              rules={explanation.filters}
            />

            {explanation.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-1">
                  {explanation.warnings.map((warning, index) => (
                    <span key={index}>{warning}</span>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RuleList({
  title,
  hint,
  rules,
}: {
  title: string;
  hint: string;
  rules: ExplainResponse["scopes"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {title}
      </span>
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">None.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div
              key={rule.source}
              className="flex flex-col gap-1 rounded-md border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={rule.applies ? "default" : "outline"}>
                  {rule.applies ? "applies" : "not held"}
                </Badge>
                <span className="text-sm font-medium">{rule.name}</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {rule.source}
                </span>
              </div>
              {/*
                The compiled form, not the JSON that was typed. Normalisation is
                the part most likely to surprise whoever wrote the rule, so
                showing the authored version here would be showing the wrong
                thing.
              */}
              <code className="text-xs break-words">{rule.reads}</code>
              {/*
                Only when the two clauses differ. Repeating an identical
                condition twice reads like a mistake in the rule rather than a
                property of it.
              */}
              {rule.checks && (
                <code className="text-muted-foreground text-xs break-words">
                  after a save: {rule.checks}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
