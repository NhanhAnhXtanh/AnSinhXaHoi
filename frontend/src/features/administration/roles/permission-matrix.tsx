import { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  CheckIcon,
  MinusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  PERMISSION_ACTIONS,
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/role/types";

/**
 * The permissions a role grants, as a resource x action matrix.
 *
 * Every code is `{resource}:{action}`, which is a product of two axes, and a
 * list flattens one of them away. A grid puts it back: a row reads as "what
 * this role may do to blog posts", a column as "who may delete anything", and
 * the shape of a role becomes something you can see rather than something you
 * reconstruct from a column of checkboxes.
 *
 * Columns come from the data, not from a fixed list, so a code with an action
 * nobody anticipated gets its own column instead of disappearing. A resource
 * with no permission for a column shows a dash: nothing to grant is a different
 * statement from granted-and-then-revoked, and a disabled checkbox says
 * neither.
 *
 * **It is the panel, not something inside one.** The toolbar sits on
 * `--surface-subtle` above a hairline and the rows scroll beneath it, so the
 * caller wraps this in a `Card` with no padding of its own and gets the same
 * three-zone sheet every list screen in this shell is built from. Anything
 * else draws two borders around the same table.
 *
 * The value is the array of `{ id }` refs the API expects.
 */

export type PermissionRef = { id: number };

type PermissionMatrixProps = {
  value: PermissionRef[] | undefined;
  /** Absent in read-only mode, where nothing is written. */
  onChange?: (value: PermissionRef[]) => void;
  /**
   * Reading a role rather than changing one. The boxes become marks, the bulk
   * actions go, and the rows open on the ones that actually grant something —
   * a screenful of empty rows is not what somebody opened a role to read.
   */
  readOnly?: boolean;
};

type MatrixRow = {
  resource: string;
  label: string;
  /** The permission for each action, where one exists. */
  cells: Map<string, Permission>;
  all: Permission[];
};

type TriState = boolean | "indeterminate";

/**
 * A checkbox that can say "some".
 *
 * `shared/ui/checkbox.tsx` draws a tick for Radix's indeterminate state, so
 * a half-granted row would look fully granted through it. The matrix lives or
 * dies on that distinction — every header box in it summarises the boxes below
 * or beside it — so it draws its own indicator rather than hand-editing the
 * stock primitive.
 */
function TriStateCheckbox({
  state,
  onToggle,
  label,
  className,
}: {
  state: TriState;
  onToggle: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={state === true}
      // Partly granted, and the useful move from there is to grant the rest —
      // so only a full box clears.
      onCheckedChange={() => onToggle(state !== true)}
      aria-label={label}
      aria-checked={state === "indeterminate" ? "mixed" : state}
      className={cn(
        "peer border-input dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-e1",
        "flex items-center justify-center outline-none transition-shadow",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        state === "indeterminate" &&
          "border-primary bg-primary/15 text-primary dark:bg-primary/25",
        className
      )}
    >
      {state === true && <CheckIcon className="size-3.5" />}
      {state === "indeterminate" && <MinusIcon className="size-3.5" />}
    </CheckboxPrimitive.Root>
  );
}

/**
 * The same cell, read rather than written.
 *
 * A disabled checkbox would say "you may not change this", which is not what a
 * show screen means: nothing on it is changeable, and drawing twenty greyed
 * boxes to say so puts the emphasis on the refusal instead of on the answer. A
 * tick or a hollow box says granted or not, and reads at a glance down a
 * column.
 */
function ReadOnlyMark({ granted, label }: { granted: boolean; label: string }) {
  return granted ? (
    <span
      role="img"
      aria-label={`${label}: granted`}
      className="bg-primary text-primary-foreground inline-flex size-4 items-center justify-center rounded-[4px]"
    >
      <CheckIcon className="size-3.5" />
    </span>
  ) : (
    <span
      role="img"
      aria-label={`${label}: not granted`}
      className="border-input inline-block size-4 rounded-[4px] border"
    />
  );
}

/**
 * `read`, `write`, `delete` keep their familiar order; an action the catalogue
 * grows later is appended rather than dropped.
 */
function orderActions(actions: Set<string>): string[] {
  const known: string[] = PERMISSION_ACTIONS.filter((action) =>
    actions.has(action)
  );
  const extra = [...actions]
    .filter((action) => !known.includes(action))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
}: PermissionMatrixProps) {
  // The catalogue is fixed and small — it only changes when a migration adds a
  // permission — so one large page is the whole of it.
  const { result, query } = useList<Permission>({
    resource: "permissions",
    pagination: { pageSize: 200 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const [search, setSearch] = useState("");
  const [grantedOnly, setGrantedOnly] = useState(readOnly);

  const permissions = useMemo(() => result?.data ?? [], [result?.data]);

  const { rows, columns } = useMemo(() => {
    const byResource = new Map<string, MatrixRow>();
    const actions = new Set<string>();

    for (const permission of permissions) {
      const { resource, action } = splitPermissionCode(permission.code);
      actions.add(action);

      let row = byResource.get(resource);
      if (!row) {
        row = {
          resource,
          label: humanizeResource(resource),
          cells: new Map(),
          all: [],
        };
        byResource.set(resource, row);
      }
      row.cells.set(action, permission);
      row.all.push(permission);
    }

    return {
      rows: [...byResource.values()].sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      columns: orderActions(actions),
    };
  }, [permissions]);

  const term = search.trim().toLowerCase();

  const selected = useMemo(
    () => new Set((value ?? []).map((ref) => Number(ref.id))),
    [value]
  );

  const visibleRows = useMemo(() => {
    let subject = rows;
    if (term) {
      subject = subject.filter(
        (row) =>
          row.label.toLowerCase().includes(term) ||
          row.resource.toLowerCase().includes(term) ||
          row.all.some((p) => p.code.toLowerCase().includes(term))
      );
    }
    if (grantedOnly) {
      subject = subject.filter((row) =>
        row.all.some((p) => selected.has(p.id))
      );
    }
    return subject;
  }, [rows, term, grantedOnly, selected]);

  const emit = (next: Set<number>) =>
    onChange?.([...next].map((id) => ({ id })));

  const setMany = (subject: Permission[], granted: boolean) => {
    if (readOnly) return;
    const next = new Set(selected);
    for (const permission of subject) {
      if (granted) next.add(permission.id);
      else next.delete(permission.id);
    }
    emit(next);
  };

  /** Whole, partial or none, over whatever set of permissions is asked about. */
  const stateOf = (subject: Permission[]): TriState => {
    if (subject.length === 0) return false;
    const granted = subject.filter((p) => selected.has(p.id)).length;
    if (granted === 0) return false;
    if (granted === subject.length) return true;
    return "indeterminate";
  };

  // The column and corner boxes act on the rows you can see, so a search
  // narrows "grant this column" to what it says on screen.
  const columnSubject = (action: string) =>
    visibleRows
      .map((row) => row.cells.get(action))
      .filter((p): p is Permission => p !== undefined);

  const visibleSubject = visibleRows.flatMap((row) => row.all);

  const grantedCount = permissions.filter((p) => selected.has(p.id)).length;

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-sm">
        No permissions are defined.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Zone one: what narrows the table, on the strip that says so. The
          search takes the room because typing is the common act; the counter
          and the bulk actions sit against the right edge, where controls that
          act on the table as a whole belong. */}
      <div className="bg-surface-subtle flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter resources or codes"
            className="bg-card h-9 pl-9"
            aria-label="Filter permissions"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          <span className="text-muted-foreground text-sm tabular-nums">
            <span className="text-foreground font-semibold">
              {grantedCount}
            </span>{" "}
            of {permissions.length} granted
          </span>

          {readOnly ? (
            // Reading a role, the useful default is the handful of rows that
            // grant something rather than the twenty-odd that do not — with the
            // whole catalogue one click away, because "what is this role *not*
            // allowed to do" is the other half of the same question.
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={!grantedOnly}
              onClick={() => setGrantedOnly((previous) => !previous)}
            >
              {grantedOnly ? "Show all resources" : "Granted only"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMany(visibleSubject, true)}
              >
                Grant all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMany(visibleSubject, false)}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/*
        Zone two: the rows, scrolling inside the panel rather than taking the
        page with them. The column headings and the resource column are both
        sticky, so the two things a tick is meaningless without — which
        resource, which action — stay on screen however far down the catalogue
        you are.

        The cap is viewport-relative, so the table grows with the display
        instead of being pinned to a height chosen on one of them. What it
        subtracts is *everything else on the screen*, which only the page knows
        — so the page states it as `--panel-reserve` and this reads it. That is
        what lets collapsing the details strip on the edit screen hand its
        height straight to the rows rather than to a gap at the bottom.
      */}
      <div className="max-h-[calc(100svh-var(--panel-reserve,26rem))] min-h-[18rem] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-muted sticky left-0 top-0 z-30 border-b px-4 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <TriStateCheckbox
                      state={stateOf(visibleSubject)}
                      onToggle={(next) => setMany(visibleSubject, next)}
                      label="Grant every permission shown"
                    />
                  )}
                  <span className="text-overline text-muted-foreground">
                    Resource
                  </span>
                </div>
              </th>

              {columns.map((action) => {
                const subject = columnSubject(action);
                const granted = subject.filter((p) =>
                  selected.has(p.id)
                ).length;

                return (
                  <th
                    key={action}
                    scope="col"
                    className="bg-muted sticky top-0 z-20 w-28 border-b border-l px-3 py-2.5 text-center align-bottom"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-overline text-muted-foreground">
                        {action}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!readOnly && (
                          <TriStateCheckbox
                            state={stateOf(subject)}
                            onToggle={(next) => setMany(subject, next)}
                            label={`Grant ${action} on every resource shown`}
                          />
                        )}
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {granted}/{subject.length}
                        </span>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-muted-foreground px-4 py-10 text-center text-sm"
                >
                  {grantedOnly && !term
                    ? "This role grants nothing."
                    : "Nothing matches that filter."}
                </td>
              </tr>
            )}

            {visibleRows.map((row) => {
              const readPermission = row.cells.get("read");
              // Every other action on a resource is reached through a screen
              // that `{resource}:read` is what opens, so write without read is
              // a grant nobody can use. Worth pointing out, not worth refusing:
              // the API is what decides.
              const missingRead =
                readPermission !== undefined &&
                !selected.has(readPermission.id) &&
                row.all.some(
                  (p) => p.id !== readPermission.id && selected.has(p.id)
                );

              return (
                <tr key={row.resource} className="group">
                  <th
                    scope="row"
                    className="bg-card group-hover:bg-muted/40 sticky left-0 z-10 border-b px-4 py-2 text-left font-normal transition-colors"
                  >
                    <label
                      className={cn(
                        "flex items-center gap-2",
                        !readOnly && "cursor-pointer"
                      )}
                    >
                      {!readOnly && (
                        <TriStateCheckbox
                          state={stateOf(row.all)}
                          onToggle={(next) => setMany(row.all, next)}
                          label={`Grant everything on ${row.label}`}
                        />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 font-medium">
                          {row.label}
                          {missingRead && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TriangleAlertIcon className="text-warning size-3.5 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Granted without read — the screens this reaches
                                stay hidden.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                        <span className="text-muted-foreground truncate font-mono text-[11px]">
                          {row.resource}
                        </span>
                      </span>
                    </label>
                  </th>

                  {columns.map((action) => {
                    const permission = row.cells.get(action);

                    if (!permission) {
                      return (
                        <td
                          key={action}
                          className="text-muted-foreground/50 group-hover:bg-muted/40 border-b border-l px-3 py-2 text-center transition-colors"
                        >
                          <span aria-label="Not applicable">&mdash;</span>
                        </td>
                      );
                    }

                    if (readOnly) {
                      return (
                        <td
                          key={action}
                          className="group-hover:bg-muted/40 border-b border-l px-3 py-2 text-center transition-colors"
                          title={permission.description ?? permission.code}
                        >
                          <ReadOnlyMark
                            granted={selected.has(permission.id)}
                            label={permission.code}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={action}
                        className="group-hover:bg-muted/40 border-b border-l p-0 text-center transition-colors"
                      >
                        <label
                          className="flex cursor-pointer items-center justify-center px-3 py-2"
                          title={permission.description ?? permission.code}
                        >
                          <TriStateCheckbox
                            state={selected.has(permission.id)}
                            onToggle={(next) => setMany([permission], next)}
                            label={permission.code}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
