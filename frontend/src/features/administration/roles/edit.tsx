import { useState } from "react";
import { useCan } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

import { EditView } from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/tabs/tabs";
import { ChevronDownIcon, ChevronUpIcon, ShieldIcon } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { cn } from "@/shared/lib/utils";
import {
  MetaItem,
  MetaStrip,
} from "@/shared/components/views/record-detail";
import { PermissionMatrix, type PermissionRef } from "./permission-matrix";
import { RoleDataScopes } from "./data-scopes";
import { AdminPageHeader, RecordHeaderActions } from "../record-actions";
import { errorDescription } from "../labels";
import { useWarnWhenChanged } from "@/shared/components/form/use-warn-when-changed";
import { useBackOr } from "@/shared/hooks/use-back-or";

/**
 * What the tab band says beside each tab, in one line.
 *
 * The explanation used to be a `CardHeader` on top of each panel — a title
 * repeating the tab label and two lines of prose, some ninety pixels of it,
 * taken off the top of the only part of this screen anybody came here to use.
 * It says the same thing on the band the tabs already occupy, so the panel
 * below starts at its own toolbar.
 */
const TAB_HINTS: Record<string, string> = {
  permissions:
    "Mỗi dòng là một chức năng, mỗi cột là một thao tác. Thay đổi có hiệu lực với người đang đăng nhập sau vài giây.",
  scopes:
    "Chọn mỗi thao tác được thấy phần dữ liệu nào. Mỗi phạm vi được lưu riêng ngay khi bấm lưu trong hộp của nó.",
};

/**
 * Editing a role.
 *
 * Three parts, and the split follows what each one *is*. On top, one strip
 * carrying the short form of what a role is called and the facts about it that
 * are not fields at all. Below it, the two things a role actually grants sit as
 * tabs, because they answer questions of different shapes about the same
 * subject: a permission decides whether an endpoint answers this role at all, a
 * data scope decides which rows it answers with. Reading one without the other
 * gives half a picture.
 *
 * **The layout is a decision about which half deserves the screen.** The three
 * identity fields are typed once and read at a glance afterwards; the matrix
 * and the scope list are worked in. So the fields sit on one row rather than a
 * column beside a card of read-only facts, the panel headings are gone, and the
 * strip collapses entirely — which hands the tabs the whole viewport when
 * somebody is doing the part of this job that needs it.
 *
 * **The tabs do not share a save.** Details and permissions are fields of this
 * form and go up together when Save is pressed; a data scope is a row in
 * another resource, with its own compiler, its own `422` naming the node at
 * fault, and its own audit trail, so each is written the moment its dialog is
 * submitted. `data-scopes.tsx` explains why folding them together would cost
 * more than it saved.
 */
export const RoleEdit = () => {
  // Huỷ: về trang trước trong app; mở thẳng / sau F5 thì về danh sách (navigate(-1) đứng yên).
  const goBack = useBackOr("/roles");

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Cảnh báo chưa lưu do useWarnWhenChanged lo (so với giá trị lúc mở).
    warnWhenUnsavedChanges: false,
    refineCoreProps: {
      successNotification: () => ({
        type: "success",
        message: "Đã lưu thay đổi vai trò",
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không lưu được vai trò",
        description: errorDescription(error),
      }),
    },
  });
  useWarnWhenChanged(form, query?.data?.data);

  const record = query?.data?.data;
  const isSystemRole = record?.systemRole === true;

  const grantedCount = form.watch("permissions")?.length ?? 0;
  const code = form.watch("code") as string | undefined;
  const name = form.watch("name") as string | undefined;

  // `row_level_policies:*` is seeded to ADMIN alone, so somebody who may edit a
  // role is not necessarily somebody who may see its data scopes. The tab is
  // not offered rather than offered and then refused on arrival.
  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");
  const [detailsOpen, setDetailsOpen] = useState(true);

  function onSubmit(values: Record<string, unknown>) {
    const permissions = Array.isArray(values.permissions)
      ? (values.permissions as PermissionRef[]).map((p) => ({ id: p.id }))
      : values.permissions;

    // The API refuses to change a system role's code, so sending it back
    // unchanged would be a no-op at best and a 409 if the field were touched.
    // Leaving it out of the payload states the intent instead.
    const { code: submittedCode, ...rest } = values as Record<string, unknown>;
    const payload = isSystemRole
      ? { ...rest, permissions }
      : { ...rest, code: submittedCode, permissions };

    onFinish(payload);
  }

  return (
    <EditView>
      <AdminPageHeader
        title="Sửa vai trò"
        description={
          record?.name
            ? `${record.name}. Thay đổi chỉ có hiệu lực sau khi bạn bấm Lưu thay đổi.`
            : "Thay đổi chỉ có hiệu lực sau khi bạn bấm Lưu thay đổi."
        }
        actions={
          <RecordHeaderActions
            resource="roles"
            id={record?.id as number | undefined}
            editLabel={false}
            showLabel="Xem chi tiết"
            remove={
              !record || isSystemRole
                ? false
                : {
                    label: "Xoá vai trò",
                    title: `Xoá vai trò ${record.name}?`,
                    description:
                      "Cán bộ đang giữ vai trò này sẽ mất các quyền của nó. Việc xoá không lấy lại được.",
                    successMessage: `Đã xoá vai trò ${record.name}`,
                  }
            }
          />
        }
      />
      <Form {...form}>
        <form
          // Collapsed, the identity fields are still mounted and still
          // validated — so a required one left empty would refuse the save with
          // its message out of sight. Opening the strip on an invalid submit is
          // what stops the collapse from ever hiding the reason.
          onSubmit={form.handleSubmit(onSubmit, () => setDetailsOpen(true))}
          className="flex min-w-0 flex-col gap-4"
        >
          {isSystemRole && (
            <Alert>
              <ShieldIcon className="size-4" />
              <AlertTitle>Vai trò hệ thống</AlertTitle>
              <AlertDescription>
                Hệ thống dựa vào vai trò này nên không đổi được mã và không xoá
                được. Các quyền vẫn sửa được — cẩn thận kẻo bỏ mất quyền của
                chính bạn.
              </AlertDescription>
            </Alert>
          )}

          {/*
            One panel for everything this role *is*: the three fields that name
            it, and beside them the facts the API settled — type and id, which
            are answers rather than inputs. They were a card of their own to the
            right until now, which spent a quarter of the width and the whole of
            the height on three short lines. On the strip they cost one row, and
            the difference goes to the tabs.
          */}
          <Card className="gap-0 overflow-hidden py-0">
            <div
              className={cn(
                "bg-surface-subtle flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3",
                // Only while something follows it. Collapsed, the hairline
                // would sit a pixel above the card's own edge and read as a
                // double border.
                detailsOpen && "border-b"
              )}
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-sm leading-5 font-semibold">
                  Thông tin vai trò
                </h2>
                <p className="text-muted-foreground truncate text-xs">
                  {detailsOpen ? (
                    "Tên gọi của vai trò và vai trò dùng cho việc gì."
                  ) : (
                    <span>
                      {name || code || "—"}
                    </span>
                  )}
                </p>
              </div>

              <MetaStrip className="shrink-0">
                <MetaItem label="Loại">
                  {isSystemRole ? (
                    <Badge variant="neutral" dot>
                      Hệ thống
                    </Badge>
                  ) : (
                    <Badge variant="info" dot>
                      Tuỳ chỉnh
                    </Badge>
                  )}
                </MetaItem>
              </MetaStrip>

              {/* The only control on this screen whose whole purpose is to give
                  the tabs below more room, so it says what it does rather than
                  being a bare chevron. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((previous) => !previous)}
                className="shrink-0"
              >
                {detailsOpen ? (
                  <ChevronUpIcon className="size-4" />
                ) : (
                  <ChevronDownIcon className="size-4" />
                )}
                {detailsOpen ? "Thu gọn" : "Mở rộng"}
              </Button>
            </div>

            {/*
              Hidden rather than unmounted, so the fields stay registered and a
              value is never lost to a collapse.

              One row on `lg`, in the proportions the content asks for: a code
              is short and fixed-format, a name is a few words, a description is
              a sentence. Below `lg` they stack, where three columns of this
              would each be narrower than what they hold.
            */}
            <div
              className={cn(
                "grid gap-4 p-4 lg:grid-cols-12 lg:gap-6",
                !detailsOpen && "hidden"
              )}
            >
              <FormField
                control={form.control}
                name="code"
                rules={{
                  required: "Vui lòng nhập mã vai trò.",
                  pattern: {
                    value: /^[A-Z][A-Z0-9_]*$/,
                    message:
                      "Chỉ dùng chữ in hoa không dấu, chữ số và gạch dưới; bắt đầu bằng chữ.",
                  },
                }}
                render={({ field }) => (
                  <FormItem className="lg:col-span-3">
                    <FormLabel>Mã vai trò</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        className="font-mono"
                        disabled={isSystemRole}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                rules={{ required: "Vui lòng nhập tên vai trò." }}
                render={({ field }) => (
                  <FormItem className="lg:col-span-4">
                    <FormLabel>Tên vai trò</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="lg:col-span-5">
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      {/* Two rows, not three: it is a sentence about what the
                          role is for, and on this row it now has the width to
                          hold one. */}
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                        className="min-h-9 resize-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Tabs value={tab} onValueChange={setTab} className="gap-3">
            {/* The band, not a header: the tabs on the left, and the one line
                that explains the panel below them against the right edge. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <TabsList>
                <TabsTrigger value="permissions">
                  Quyền ({grantedCount})
                </TabsTrigger>
                {mayReadScopes && (
                  <TabsTrigger value="scopes">Phạm vi dữ liệu</TabsTrigger>
                )}
              </TabsList>

              <p className="text-muted-foreground hidden max-w-3xl text-xs leading-5 lg:block lg:ms-auto lg:text-right">
                {TAB_HINTS[tab]}
              </p>
            </div>

            {/* Each panel is a single sheet: its own toolbar strip, then its
                rows. No card header above either, because the tab already
                names it. */}
            <TabsContent value="permissions">
              {/* How much of the viewport everything above the rows is using,
                  handed to the panel so the scrolling table can size itself
                  against what is actually left. Collapsing the details strip
                  gives its height to the rows, which is the whole point of
                  being able to collapse it. */}
              <Card
                className={cn(
                  "gap-0 overflow-hidden py-0",
                  detailsOpen
                    ? "[--panel-reserve:28rem]"
                    : "[--panel-reserve:19rem]"
                )}
              >
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem className="gap-0">
                      <FormControl>
                        <PermissionMatrix
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage className="px-4 pb-3" />
                    </FormItem>
                  )}
                />
              </Card>
            </TabsContent>

            {mayReadScopes && (
              <TabsContent value="scopes">
                <Card className="gap-0 overflow-hidden py-0">
                  <RoleDataScopes
                    roleId={record?.id as number | undefined}
                    roleCode={record?.code as string | undefined}
                    roleName={record?.name as string | undefined}
                  />
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/*
            The save bar floats above the panel rather than sitting flush at the
            bottom of the page, because the panel above it scrolls its own rows:
            a footer that had to be scrolled to would be behind whichever row
            happened to be last. It is a sheet of its own — border, fill and
            elevation — so it reads as the end of the form and not as a strip
            painted over the table.
          */}
          <div
            className={cn(
              "sticky bottom-0 z-30 flex flex-wrap items-center gap-3",
              "border-border bg-card/95 rounded-lg border px-4 py-3 shadow-e3 backdrop-blur"
            )}
          >
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
            >
              Huỷ
            </Button>

            {/* Said where the ambiguity actually is. On the permissions tab
                this button is the only way anything is written; on the other
                one it has nothing to do with what is on screen. */}
            {tab === "scopes" && (
              <span className="text-muted-foreground text-sm">
                Nút này lưu thông tin và quyền của vai trò. Mỗi phạm vi dữ liệu
                được lưu riêng.
              </span>
            )}

            {form.formState.isDirty && (
              <span className="text-muted-foreground ms-auto flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="bg-warning inline-block size-2 rounded-full"
                />
                Có thay đổi chưa lưu
              </span>
            )}
          </div>
        </form>
      </Form>
    </EditView>
  );
};
