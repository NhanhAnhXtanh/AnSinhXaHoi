import { Plus, TriangleAlert, X } from "lucide-react";
import * as React from "react";

import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  NULLARY_OPERATORS,
  RANGE_OPERATORS,
  SET_OPERATORS,
  operatorLabel,
  type MetadataField,
  type PolicyMetadata,
  type ScopeLeaf,
  type ScopeNode,
  type ScopeValue,
} from "@/domains/row-level-policy/types";

/**
 * The condition builder.
 *
 * **There is no free-text expression box here, and its absence is the point.**
 * Every field, operator, context key and enum value is a dropdown built from
 * `/metadata`, which is the server's own declaration of what a policy on this
 * resource may say. A condition that would not compile is one this screen will
 * not let anybody write — and the reason it can work that way is that there is
 * no expression language at runtime to have to render an editor for.
 *
 * The tree it edits is the same shape the API stores, so nothing is translated
 * on the way in or out. What the server normalises (a `not` pushed down into
 * the leaves) is deliberately *not* mirrored here: people write `not`, and the
 * show page reports back what actually runs.
 */

type ScopeBuilderProps = {
  metadata: PolicyMetadata | undefined;
  value: ScopeNode;
  onChange: (next: ScopeNode) => void;
  /** `write` policies may not mention a field whose value only exists after the flush. */
  action: string;
  disabled?: boolean;
};

export function ScopeBuilder({
  metadata,
  value,
  onChange,
  action,
  disabled,
}: ScopeBuilderProps) {
  if (!metadata) {
    return (
      <p className="text-muted-foreground text-sm">
        Pick a resource first — the fields a condition may use are declared per
        resource.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <NodeEditor
        metadata={metadata}
        node={value}
        onChange={onChange}
        onRemove={undefined}
        action={action}
        disabled={disabled}
        depth={0}
      />
      <p className="text-muted-foreground text-xs">
        An empty <span className="font-mono">all</span> group matches every row
        — that is the full scope, not an unfinished condition.
      </p>
    </div>
  );
}

type NodeEditorProps = {
  metadata: PolicyMetadata;
  node: ScopeNode;
  onChange: (next: ScopeNode) => void;
  onRemove: (() => void) | undefined;
  action: string;
  disabled?: boolean;
  depth: number;
};

function NodeEditor(props: NodeEditorProps) {
  const { node } = props;

  if ("all" in node || "any" in node) {
    return <GroupEditor {...props} />;
  }
  if ("not" in node) {
    return <NotEditor {...props} />;
  }
  return <LeafEditor {...props} />;
}

function GroupEditor({
  metadata,
  node,
  onChange,
  onRemove,
  action,
  disabled,
  depth,
}: NodeEditorProps) {
  const kind = "all" in node ? "all" : "any";
  const children = ("all" in node ? node.all : (node as { any: ScopeNode[] }).any) ?? [];

  function replace(index: number, next: ScopeNode) {
    const updated = children.map((child, i) => (i === index ? next : child));
    onChange(kind === "all" ? { all: updated } : { any: updated });
  }

  function remove(index: number) {
    const updated = children.filter((_, i) => i !== index);
    onChange(kind === "all" ? { all: updated } : { any: updated });
  }

  function add(next: ScopeNode) {
    const updated = [...children, next];
    onChange(kind === "all" ? { all: updated } : { any: updated });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border p-3",
        depth > 0 && "bg-muted/30"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={kind}
          disabled={disabled}
          onValueChange={(next) =>
            onChange(next === "all" ? { all: children } : { any: children })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Match all of</SelectItem>
            <SelectItem value="any">Match any of</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => add(newLeaf(metadata))}
        >
          <Plus className="h-3.5 w-3.5" />
          Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => add({ any: [] })}
        >
          <Plus className="h-3.5 w-3.5" />
          Group
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label="Remove group"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {kind === "all"
            ? "Empty — matches every row."
            : "Empty — matches no rows."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {children.map((child, index) => (
            <NodeEditor
              // Index is the identity here: the children have nothing stable of
              // their own, and reordering is not offered.
              key={index}
              metadata={metadata}
              node={child}
              onChange={(next) => replace(index, next)}
              onRemove={() => remove(index)}
              action={action}
              disabled={disabled}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotEditor({
  metadata,
  node,
  onChange,
  onRemove,
  action,
  disabled,
  depth,
}: NodeEditorProps) {
  const inner = (node as { not: ScopeNode }).not;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">NOT</Badge>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(inner)}
        >
          Remove NOT
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label="Remove condition"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <NodeEditor
        metadata={metadata}
        node={inner}
        onChange={(next) => onChange({ not: next })}
        onRemove={undefined}
        action={action}
        disabled={disabled}
        depth={depth + 1}
      />
      <NullWarning metadata={metadata} node={inner} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function LeafEditor({
  metadata,
  node,
  onChange,
  onRemove,
  action,
  disabled,
}: NodeEditorProps) {
  const leaf = node as ScopeLeaf;
  const field = metadata.fields.find((candidate) => candidate.path === leaf.field);

  // Refused by the server when the policy is saved, with the reason. Saying it
  // here as well means nobody has to submit the form to find out.
  const notCheckSafe =
    action === "write" &&
    field !== undefined &&
    metadata.notCheckSafe.some((unsafe) => leaf.field === unsafe || leaf.field.startsWith(`${unsafe}.`));

  function update(next: Partial<ScopeLeaf>) {
    onChange({ ...leaf, ...next } as ScopeLeaf);
  }

  function changeField(path: string) {
    const target = metadata.fields.find((candidate) => candidate.path === path);
    if (!target) return;
    // The operator and the value belong to the old field's type, so both are
    // reset rather than carried across into a comparison that cannot hold.
    const op = target.operators.includes(leaf.op) ? leaf.op : target.operators[0];
    onChange(defaultLeaf(target, op));
  }

  function changeOperator(op: string) {
    if (!field) return;
    onChange(defaultLeaf(field, op, leaf.value));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={leaf.field} disabled={disabled} onValueChange={changeField}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {metadata.fields.map((candidate) => (
              <SelectItem key={candidate.path} value={candidate.path}>
                {candidate.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leaf.op} disabled={disabled || !field} onValueChange={changeOperator}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {(field?.operators ?? []).map((op) => (
              <SelectItem key={op} value={op}>
                {operatorLabel(op)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {field && !NULLARY_OPERATORS.has(leaf.op) && (
          <ValueEditor
            metadata={metadata}
            field={field}
            op={leaf.op}
            value={leaf.value}
            disabled={disabled}
            onChange={(value) => update({ value })}
          />
        )}

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange({ not: leaf })}
        >
          Negate
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onRemove}
            aria-label="Remove condition"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {notCheckSafe && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            <span className="font-mono">{leaf.field}</span> only has a value once
            the row has been saved, so a write policy using it would refuse every
            new record. The API will not accept this.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * The three-valued-logic warning, offered where it is actually needed.
 *
 * `not(assignee.id = me)` does not match a task with no assignee: a null makes
 * the comparison UNKNOWN, and UNKNOWN refuses the row. Rather than leave that
 * to be discovered as a row that mysteriously never appears, the builder says
 * so the moment a `not` lands on a nullable field, and offers to write the
 * `isNull` branch out.
 */
function NullWarning({
  metadata,
  node,
  onChange,
  disabled,
}: {
  metadata: PolicyMetadata;
  node: ScopeNode;
  onChange: (next: ScopeNode) => void;
  disabled?: boolean;
}) {
  if ("all" in node || "any" in node || "not" in node) return null;

  const leaf = node as ScopeLeaf;
  const field = metadata.fields.find((candidate) => candidate.path === leaf.field);
  if (!field?.warnNotNull || NULLARY_OPERATORS.has(leaf.op)) return null;

  return (
    <Alert>
      <TriangleAlert className="h-4 w-4" />
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          <span className="font-mono">{field.path}</span> can be empty. A negated
          condition does <b>not</b> match a row where it is — an empty value makes
          the comparison unknown, and unknown refuses the row.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange({
              any: [{ not: leaf }, { field: field.path, op: "isNull" }],
            })
          }
        >
          Also match rows where it is empty
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function ValueEditor({
  metadata,
  field,
  op,
  value,
  onChange,
  disabled,
}: {
  metadata: PolicyMetadata;
  field: MetadataField;
  op: string;
  value: ScopeValue | undefined;
  onChange: (next: ScopeValue) => void;
  disabled?: boolean;
}) {
  const isContext = value !== undefined && "ctx" in value;

  // Only the keys whose type can actually be compared with this field, and
  // whose shape suits the operator. Offering the rest would be offering a
  // choice the server refuses.
  const usableKeys = metadata.context.filter(
    (candidate) =>
      candidate.collection === SET_OPERATORS.has(op) &&
      compatible(candidate.type, field.type)
  );

  const literal = value !== undefined && "lit" in value ? value.lit : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={isContext ? "ctx" : "lit"}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(
            next === "ctx"
              ? { ctx: usableKeys[0]?.key ?? "" }
              : { lit: emptyLiteral(op) }
          )
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lit">a value</SelectItem>
          <SelectItem value="ctx" disabled={usableKeys.length === 0}>
            the caller&apos;s
          </SelectItem>
        </SelectContent>
      </Select>

      {isContext ? (
        <Select
          value={(value as { ctx: string }).ctx}
          disabled={disabled}
          onValueChange={(next) => onChange({ ctx: next })}
        >
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Context key" />
          </SelectTrigger>
          <SelectContent>
            {usableKeys.map((candidate) => (
              <SelectItem key={candidate.key} value={candidate.key}>
                {candidate.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <LiteralEditor
          field={field}
          op={op}
          value={literal}
          disabled={disabled}
          onChange={(next) => onChange({ lit: next })}
        />
      )}
    </div>
  );
}

function LiteralEditor({
  field,
  op,
  value,
  onChange,
  disabled,
}: {
  field: MetadataField;
  op: string;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  if (RANGE_OPERATORS.has(op)) {
    const bounds = Array.isArray(value) ? value : ["", ""];
    return (
      <div className="flex items-center gap-1">
        <Input
          className="w-[150px]"
          type={inputType(field.type)}
          disabled={disabled}
          value={String(bounds[0] ?? "")}
          onChange={(e) => onChange([e.target.value, bounds[1] ?? ""])}
        />
        <span className="text-muted-foreground text-xs">and</span>
        <Input
          className="w-[150px]"
          type={inputType(field.type)}
          disabled={disabled}
          value={String(bounds[1] ?? "")}
          onChange={(e) => onChange([bounds[0] ?? "", e.target.value])}
        />
      </div>
    );
  }

  if (SET_OPERATORS.has(op)) {
    const values = Array.isArray(value) ? value : [];

    if (field.type === "enum") {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {field.values.map((option) => {
            const selected = values.includes(option);
            return (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                disabled={disabled}
                onClick={() =>
                  onChange(
                    selected
                      ? values.filter((candidate) => candidate !== option)
                      : [...values, option]
                  )
                }
              >
                {option}
              </Button>
            );
          })}
        </div>
      );
    }

    return (
      <Input
        className="w-[240px]"
        placeholder="Comma separated"
        disabled={disabled}
        value={values.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((part) => part.trim())
              .filter((part) => part.length > 0)
          )
        }
      />
    );
  }

  if (field.type === "enum") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder="Value" />
        </SelectTrigger>
        <SelectContent>
          {field.values.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "boolean") {
    return (
      <Select
        value={value === true ? "true" : "false"}
        disabled={disabled}
        onValueChange={(next) => onChange(next === "true")}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      className="w-[190px]"
      type={inputType(field.type)}
      disabled={disabled}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) =>
        onChange(
          field.type === "long" || field.type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value
        )
      }
    />
  );
}

function newLeaf(metadata: PolicyMetadata): ScopeNode {
  const field = metadata.fields[0];
  if (!field) return { all: [] };
  return defaultLeaf(field, field.operators[0]);
}

/** A leaf whose value is the right shape for its operator, so nothing is half-built. */
function defaultLeaf(
  field: MetadataField,
  op: string,
  previous?: ScopeValue
): ScopeLeaf {
  if (NULLARY_OPERATORS.has(op)) {
    // The two operators that take no operand. Carrying a value across would be
    // rejected by the API, and rightly: a condition that quietly ignores half
    // of what it was given is worse than one that refuses.
    return { field: field.path, op };
  }
  if (previous && "ctx" in previous) {
    return { field: field.path, op, value: previous };
  }
  return { field: field.path, op, value: { lit: emptyLiteral(op) } };
}

function emptyLiteral(op: string): unknown {
  if (SET_OPERATORS.has(op)) return [];
  if (RANGE_OPERATORS.has(op)) return ["", ""];
  return "";
}

function inputType(type: string): string {
  if (type === "date") return "date";
  if (type === "datetime") return "datetime-local";
  if (type === "long" || type === "number") return "number";
  return "text";
}

/** Numeric widths are interchangeable; everything else has to match, as on the server. */
function compatible(contextType: string, fieldType: string): boolean {
  if (contextType === fieldType) return true;
  const numeric = new Set(["long", "number"]);
  return numeric.has(contextType) && numeric.has(fieldType);
}
