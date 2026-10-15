import { useCustom, useSelect } from "@refinedev/core";
import type { UseFormReturn } from "react-hook-form";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { ScopeBuilder } from "./scope-builder";
import {
  ACTIONS,
  EMPTY_SCOPE,
  type PolicyMetadata,
  type ScopeNode,
} from "@/domains/row-level-policy/types";

/**
 * The create and edit forms are the same form, so it lives here once.
 *
 * The shape it edits is `RowLevelPolicyRequest` on the backend. Two of its
 * fields are locked on edit rather than merely discouraged — see
 * `lockIdentity` below.
 */

export type PolicyFormValues = {
  kind: "SCOPE" | "FILTER";
  /**
   * Null for a filter, which has no role by design. Nullable rather than
   * optional because the field is always sent: an omitted role would leave the
   * API guessing, and an explicit null is the only way to say "nobody".
   */
  role: { id: number | null };
  resource: string;
  action: string;
  name: string;
  policyGroup: string;
  description: string;
  scope: ScopeNode;
  /**
   * The `WITH CHECK` clause. Null means "the same as `scope`" — see the card in
   * the form for why that is the default and when to override it.
   */
  checkScope: ScopeNode | null;
  enabled: boolean;
};

type PolicyFormProps = {
  form: UseFormReturn<PolicyFormValues>;
  /**
   * True on the edit screen. `kind` and `resource` are then read-only, because
   * changing either turns a policy into a different policy about different
   * rows — and the audit trail would claim one thing was edited when in truth
   * one rule was withdrawn and another introduced. The API rejects them for the
   * same reason; this is the form agreeing with it rather than discovering it.
   */
  lockIdentity?: boolean;
  /** Every resource under row-level management, for the resource picker. */
  resources: string[];
  /**
   * The role the record already names, for the edit screen.
   *
   * Both pickers here are fed by requests that finish after this form mounts,
   * and a Radix `Select` renders its label from the matching item — so a value
   * whose option has not arrived yet shows the placeholder and looks like an
   * empty field. Merging the current value into the list closes that window;
   * the role needs its label passed in because only the record knows it.
   */
  currentRole?: { id: number; code: string } | null;
  /**
   * True when the screen, rather than the form, has already decided the role —
   * the Data scopes tab of a role, where every policy written belongs to the
   * role being edited.
   *
   * The picker is shown disabled rather than hidden, for the same reason it is
   * on a filter: a field that vanishes reads as one somebody forgot, while a
   * disabled one holding the right value reads as a decision already made.
   */
  lockRole?: boolean;
  /**
   * True when the kind is fixed at `SCOPE`.
   *
   * A `FILTER` names no role by design — that is what makes it inescapable — so
   * there is no such thing as a filter *of* a role, and offering the choice on
   * a role's own screen would offer a policy that screen cannot save.
   */
  lockKind?: boolean;
};

export function PolicyForm({
  form,
  lockIdentity,
  resources,
  currentRole,
  lockRole,
  lockKind,
}: PolicyFormProps) {
  const kind = form.watch("kind");
  const resource = form.watch("resource");
  const action = form.watch("action");

  const { options: roleOptions, query: roleQuery } = useSelect({
    resource: "roles",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "code", order: "asc" }],
  });

  // The current values, guaranteed to have an option to match, however late the
  // real lists arrive. Without this the field renders as blank rather than as
  // what it holds -- which reads as data loss on a form somebody is editing.
  const resourceOptions =
    resource && !resources.includes(resource) ? [resource, ...resources] : resources;

  const roleChoices = (roleOptions ?? []).some(
    (option) => String(option.value) === String(currentRole?.id)
  )
    ? (roleOptions ?? [])
    : [
        ...(currentRole ? [{ value: currentRole.id, label: currentRole.code }] : []),
        ...(roleOptions ?? []),
      ];

  // The server's own declaration of what a policy on this resource may say.
  // Everything the condition builder offers comes from here, which is what lets
  // that builder have no free-text expression box at all.
  const { result: metadataResult, query: metadataQuery } = useCustom<PolicyMetadata>({
    url: `${API_URL}/row_level_policies/metadata`,
    method: "get",
    config: { query: { resource } },
    queryOptions: { enabled: Boolean(resource) },
  });

  // Not `metadataResult?.data` on its own: refine answers a query that has not
  // run with a frozen empty object rather than undefined, and this query is
  // disabled until a resource is picked. See `customResult`.
  const metadata = customResult(metadataResult?.data, "fields");

  return (
    <Form {...form}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>What this policy is</CardTitle>
            <CardDescription>
              A scope belongs to one role and widens what that role can reach. A
              filter belongs to nobody and narrows what everyone can reach —
              which is why it cannot be escaped by not holding a role.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-3xl space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={lockIdentity || lockKind}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCOPE">
                          Scope — widens one role
                        </SelectItem>
                        <SelectItem value="FILTER">
                          Filter — narrows everyone
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {lockIdentity
                        ? "Cannot be changed: it would make this a different rule about different rows."
                        : lockKind
                          ? "A filter names no role, so it cannot be written from a role's own screen."
                          : "Scopes union with each other; filters always intersect."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resource"
                rules={{ required: "A resource is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={lockIdentity}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a resource" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {resourceOptions.map((candidate) => (
                          <SelectItem key={candidate} value={candidate}>
                            {candidate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only resources declared under row-level management appear
                      here.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="action"
                rules={{ required: "An action is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIONS.map((candidate) => (
                          <SelectItem key={candidate} value={candidate}>
                            {candidate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {action === "write"
                        ? "Checked twice: on the row as it stands, and on the state the save would leave behind."
                        : "Folded into the WHERE clause of every query for this resource."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/*
                A filter has no role by design. Showing the picker disabled
                rather than hiding it is what makes that visible as a decision
                instead of looking like a field somebody forgot.
              */}
              <FormField
                control={form.control}
                name="role.id"
                rules={{
                  validate: (value) =>
                    kind === "FILTER" ||
                    value != null ||
                    "A scope has to name the role it widens",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    {/*
                      Role ids are numbers on the wire but `Select` compares its
                      values as strings, so the conversion happens at this
                      boundary and nowhere else.
                    */}
                    <Select
                      onValueChange={(next) => field.onChange(Number(next))}
                      value={
                        field.value === null || field.value === undefined
                          ? ""
                          : String(field.value)
                      }
                      disabled={kind === "FILTER" || lockRole}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              kind === "FILTER"
                                ? "Filters apply to everyone"
                                : roleQuery.isLoading
                                  ? "Loading..."
                                  : "Select a role"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleChoices.map((option) => (
                          <SelectItem
                            key={String(option.value)}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lockRole && (
                      <FormDescription>
                        Fixed: this scope belongs to the role you are editing.
                        Write one for another role from that role&rsquo;s own
                        screen.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              rules={{
                required: "A name is required",
                maxLength: { value: 160, message: "At most 160 characters" },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Work in my department"
                    />
                  </FormControl>
                  <FormDescription>
                    How this rule is referred to in the audit trail and in
                    explanations. Say what it lets people see.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="policyGroup"
                rules={{ maxLength: { value: 64, message: "At most 64 characters" } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Departmental"
                      />
                    </FormControl>
                    <FormDescription>
                      Display only — it groups rows on this screen and nothing
                      else.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Enabled</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {kind === "FILTER"
                        ? "Turning a filter off removes a restriction from everyone."
                        : "Turning a scope off narrows the role it belongs to."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              rules={{ maxLength: { value: 500, message: "At most 500 characters" } }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      placeholder="Why this rule exists, for whoever reads it next"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Which rows it matches</CardTitle>
            <CardDescription>
              Every choice below is drawn from what the server says this resource
              allows. There is no free-text expression here, and that is
              deliberate: a condition this screen will not let you write is one
              the API would refuse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metadata && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Roles with no scope on this resource:
                </span>
                <Badge
                  variant={
                    metadata.defaultScope === "FULL" ? "secondary" : "outline"
                  }
                >
                  {metadata.defaultScope === "FULL"
                    ? "see everything"
                    : "see nothing"}
                </Badge>
              </div>
            )}

            {metadata && metadata.designTime.length > 0 && (
              <Alert>
                <AlertDescription className="flex flex-col gap-1">
                  <span className="font-medium">
                    Also in force, declared in source and not editable here:
                  </span>
                  {metadata.designTime.map((declared, index) => (
                    <span key={index} className="text-sm">
                      {declared.kind} · {declared.action}
                      {declared.role ? ` · ${declared.role}` : ""} —{" "}
                      {declared.name}
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div>
                      <ScopeBuilder
                        metadata={metadata}
                        value={field.value}
                        onChange={field.onChange}
                        action={action}
                        disabled={metadataQuery.isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/*
          Only `write` leaves a new state behind, so only `write` has a second
          clause. Showing this card for `read` or `delete` would invite somebody
          to fill in a condition that is never consulted.
        */}
        {action === "write" && (
          <Card>
            <CardHeader>
              <CardTitle>What it may become</CardTitle>
              <CardDescription>
                The condition above decides which records can be edited. This one
                decides what they are allowed to look like <b>after</b> the save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="checkScope"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value === null || field.value === undefined}
                          onCheckedChange={(sameAsAbove) =>
                            // Null and an empty tree are opposites here: null
                            // reuses the condition above, an empty tree allows
                            // any resulting state at all.
                            field.onChange(sameAsAbove ? null : EMPTY_SCOPE)
                          }
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel>Apply the same condition to the saved record</FormLabel>
                        <FormDescription>
                          On by default, and the right answer when the condition
                          above is about <b>whose</b> record it is — a department,
                          a category, an owner. It is what stops somebody moving a
                          record somewhere they cannot see it in order to hide it.
                        </FormDescription>
                      </div>
                    </div>

                    {field.value !== null && field.value !== undefined && (
                      <>
                        <Alert>
                          <AlertDescription>
                            Turn it off when the condition above is about a{" "}
                            <b>state the work changes</b>. &ldquo;Only drafts can
                            be edited&rdquo; applied to the saved record also
                            means &ldquo;and a draft can never be
                            published&rdquo;, which forbids the one edit that
                            matters. Leave the builder below empty to allow any
                            resulting state.
                          </AlertDescription>
                        </Alert>
                        <FormControl>
                          <div>
                            <ScopeBuilder
                              metadata={metadata}
                              value={field.value}
                              onChange={field.onChange}
                              action={action}
                              disabled={metadataQuery.isLoading}
                            />
                          </div>
                        </FormControl>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Form>
  );
}
