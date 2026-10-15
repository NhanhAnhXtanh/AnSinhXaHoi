import { useShow } from "@refinedev/core";
import { Link } from "react-router";
import { ShieldIcon, ShieldOffIcon } from "lucide-react";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  DetailList,
  DetailPanel,
  DetailRow,
  EmptyValue,
  MetaItem,
  MetaStrip,
} from "@/shared/components/views/record-detail";
import { formatDateTime } from "@/shared/lib/format";
import type { User } from "@/domains/user/types";
import { STATUS_LABELS } from "@/domains/user/types";
import { USER_STATUS_VARIANTS } from "@/shared/lib/status-variants";

/** A never-signed-in account is a fact, not a missing value. */
function formatLastSignIn(value?: string | null) {
  return value ? formatDateTime(value) : "Never";
}

/**
 * First and last initial, the same two the shell's own avatar draws.
 *
 * A photograph is not stored for anybody, so this is the only thing that can
 * make one account distinguishable from the next at a glance.
 */
function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Reading an account.
 *
 * **Panels by subject, not one column of fields.** Who this is, where they sit
 * and what they may do are three different questions, and a single card with
 * separators between the groups made them one long answer that had to be read
 * in order. Three panels side by side can be read in any order — and on the
 * width this shell actually runs at, they cost a third of the height.
 *
 * The identity band on top carries what a person is looking for when they open
 * this screen at all: who it is, whether the account works, and the timestamps
 * that answer "is this still in use". Everything below it is detail.
 *
 * Every row that names another record is a link to it. A user's organization,
 * department and roles are all records with screens of their own, and the
 * question after "which role does she hold" is almost always "and what does
 * that role grant".
 */
export const UserShow = () => {
  const { result: record, query } = useShow<User>({});
  const { isLoading } = query;

  const status = record?.status;

  return (
    <ShowView>
      <ShowViewHeader />

      <Card className="py-4">
        <LoadingOverlay loading={isLoading}>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4 px-6">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials(record?.fullName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg leading-6 font-semibold tracking-tight">
                  {record?.fullName ?? "—"}
                </h2>
                {status && (
                  <Badge variant={USER_STATUS_VARIANTS[status] ?? "secondary"}>
                    {STATUS_LABELS[status] ?? status}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                <span className="font-mono">{record?.username ?? "—"}</span>
                {record?.email ? ` · ${record.email}` : ""}
              </p>
            </div>

            <MetaStrip className="shrink-0">
              <MetaItem label="User ID">
                <span className="tabular-nums">{record?.id ?? "—"}</span>
              </MetaItem>
              <MetaItem label="Created">
                {formatDateTime(record?.createdAt)}
              </MetaItem>
              <MetaItem label="Last sign-in">
                {formatLastSignIn(record?.lastLoginAt)}
              </MetaItem>
            </MetaStrip>
          </div>
        </LoadingOverlay>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <DetailPanel title="Identity">
          <DetailList>
            <DetailRow label="Username">
              <span className="font-mono">{record?.username ?? "—"}</span>
            </DetailRow>
            <DetailRow label="Email">
              {record?.email ? (
                // `mailto:` rather than plain text: the next thing anybody does
                // with an address on a screen like this is write to it.
                <a
                  href={`mailto:${record.email}`}
                  className="break-all hover:underline"
                >
                  {record.email}
                </a>
              ) : (
                <EmptyValue />
              )}
            </DetailRow>
            <DetailRow label="Full name">
              {record?.fullName ?? <EmptyValue />}
            </DetailRow>
            <DetailRow label="Status">
              {status ? (
                <Badge variant={USER_STATUS_VARIANTS[status] ?? "secondary"}>
                  {STATUS_LABELS[status] ?? status}
                </Badge>
              ) : (
                <EmptyValue />
              )}
            </DetailRow>
          </DetailList>
        </DetailPanel>

        <DetailPanel title="Placement">
          <DetailList>
            <DetailRow label="Organization">
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
                <EmptyValue>Not placed</EmptyValue>
              )}
            </DetailRow>
            <DetailRow label="Department">
              {record?.department ? (
                <Link
                  to={`/departments/show/${record.department.id}`}
                  className="hover:underline"
                >
                  {record.department.name}
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {record.department.code}
                  </span>
                </Link>
              ) : (
                <EmptyValue>None</EmptyValue>
              )}
            </DetailRow>
          </DetailList>
        </DetailPanel>

        <DetailPanel title="Activity">
          <DetailList>
            <DetailRow label="Created">
              {formatDateTime(record?.createdAt)}
            </DetailRow>
            <DetailRow label="Last updated">
              {record?.updatedAt ? (
                formatDateTime(record.updatedAt)
              ) : (
                <EmptyValue />
              )}
            </DetailRow>
            <DetailRow label="Last sign-in">
              {formatLastSignIn(record?.lastLoginAt)}
            </DetailRow>
          </DetailList>
        </DetailPanel>
      </div>

      {/*
        Full width and last, because it is the answer to the question this
        screen is most often opened for — what can this person do — and because
        the roles are cards rather than rows: each is a record with a name, a
        code and a screen of its own behind it.
      */}
      <DetailPanel
        title="Roles"
        action={
          <span className="text-muted-foreground text-xs tabular-nums">
            {record?.roles?.length ?? 0} held
          </span>
        }
        bodyClassName="p-4"
      >
        <LoadingOverlay loading={isLoading}>
          {record?.roles?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {record.roles.map((role) => (
                <Link
                  key={role.id}
                  to={`/roles/show/${role.id}`}
                  className="border-border hover:bg-accent/40 flex items-start gap-3 rounded-lg border p-3 transition-colors"
                >
                  <ShieldIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {role.name}
                    </span>
                    <span className="text-muted-foreground truncate font-mono text-xs">
                      {role.code}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <ShieldOffIcon className="size-4" />
              This account holds no role, so every screen refuses it.
            </p>
          )}
        </LoadingOverlay>
      </DetailPanel>
    </ShowView>
  );
};
