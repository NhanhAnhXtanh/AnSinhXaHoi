import { useEffect } from "react";
import { useForm } from "@refinedev/react-hook-form";

import { EditView } from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import {
  FormSection,
  FormSectionActions,
  SectionedFormPanel,
} from "@/shared/components/form/form-section";
import { RolePicker } from "./role-picker";
import { ReportUnitPicker } from "./report-unit-picker";
import { AccountLevelField } from "./account-level-field";
import { ResetPasswordCard } from "./reset-password-card";
import { StatusSwitchField } from "./status-switch-field";
import { UserHeaderActions } from "./user-actions";
import { UserStatusBadge } from "./user-status-badge";
import {
  RequiredMark,
  joinFullName,
  splitFullName,
  USER_FIELD_RULES,
} from "./user-form-fields";
import { AdminPageHeader } from "../record-actions";
import { errorDescription, formatDateTimeVi } from "../labels";
import type { User } from "@/domains/user/types";
import { useWarnWhenChanged } from "@/shared/components/form/use-warn-when-changed";
import { useBackOr } from "@/shared/hooks/use-back-or";

/**
 * Rút đơn vị báo cáo về dạng `{ id }` API đọc, giữ nguyên ba trạng thái API phân biệt.
 *
 * `null` nghĩa là không gửi — giữ nguyên, đúng cho tài khoản chưa gắn đơn vị
 * và không ai chạm vào. `{ id: null }` là cách ô chọn nói "bỏ gắn", phải giữ
 * nguyên. Còn lại là bản tóm tắt API trả về, gửi lại chỉ mã số của nó.
 */
function toRef(value: unknown): { id: number | null } | null {
  if (value == null) return null;
  const id = (value as { id?: number | string | null }).id;
  return { id: id == null ? null : Number(id) };
}

/**
 * Sửa tài khoản.
 *
 * Một panel ngang trang theo Figma (310:36846): bốn ô một hàng — Họ và tên đệm
 * | Tên | Tên đăng nhập | Thư điện tử — rồi đơn vị công tác và trạng thái, rồi
 * vai trò. Thẻ "Đặt lại mật khẩu" nằm riêng bên dưới: đặt mật khẩu là điểm cuối
 * khác và đăng xuất cán bộ khỏi mọi máy, nên nó không phải một ô của form.
 */
export const UserEdit = () => {
  // Huỷ: về trang trước trong app; mở thẳng / sau F5 thì về danh sách (navigate(-1) đứng yên).
  const goBack = useBackOr("/users");

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Cảnh báo chưa lưu do useWarnWhenChanged lo (so với giá trị lúc mở).
    warnWhenUnsavedChanges: false,
    refineCoreProps: {
      successNotification: () => ({
        type: "success",
        message: "Đã lưu thay đổi tài khoản",
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không lưu được tài khoản",
        description: errorDescription(error),
      }),
    },
  });
  useWarnWhenChanged(form, form.formState.defaultValues);

  const user = query?.data?.data as User | undefined;
  const userId = user?.id;

  /**
   * Đổ bản ghi vào form một lần.
   *
   * `reportUnit` do `ReportUnitPicker` điều khiển chứ không qua `FormField`,
   * nên cách đổ từng ô của thư viện sẽ bỏ sót nó. `reset`
   * ghi cả bản ghi vào giá trị form; `keepDirtyValues` để lần tải lại sau
   * không xoá mất chỗ đang sửa. Họ tên được tách thành hai ô ở đây.
   */
  const { reset } = form;
  useEffect(() => {
    if (!user) return;
    reset({ ...user, ...splitFullName(user.fullName) }, { keepDirtyValues: true });
  }, [user, reset]);

  function onSubmit(values: Record<string, unknown>) {
    // `roles` về từ API là đối tượng đầy đủ, gửi lại dạng `{ id }`.
    const roles = Array.isArray(values.roles)
      ? (values.roles as { id: number }[]).map((role) => ({ id: role.id }))
      : values.roles;

    // Tổ chức / phòng ban của khung quản trị gốc không còn trên form (Figma chỉ có đơn vị
    // báo cáo): bỏ khỏi payload để API giữ nguyên, thay vì gửi lại bản tóm tắt cũ.
    const { familyName, givenName, ...rest } = values;
    delete rest.organization;
    delete rest.department;

    onFinish({
      ...rest,
      fullName: joinFullName(
        familyName as string | undefined,
        givenName as string | undefined
      ),
      roles,
      reportUnit: toRef(values.reportUnit),
    });
  }

  const displayName = user ? user.fullName || user.username : "Sửa tài khoản";

  return (
    <EditView>
      <AdminPageHeader
        title={displayName}
        badge={user ? <UserStatusBadge status={user.status} /> : undefined}
        description={
          user ? (
            <>
              Tài khoản {user.username} · Đăng nhập gần nhất{" "}
              {user.lastLoginAt ? formatDateTimeVi(user.lastLoginAt) : "chưa có"}
            </>
          ) : undefined
        }
        actions={user ? <UserHeaderActions user={user} editing /> : undefined}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0">
          <SectionedFormPanel>
            <FormSection
              title="Thông tin tài khoản"
              description="Họ tên và tên đăng nhập của cán bộ. Mật khẩu đổi ở khung “Đặt lại mật khẩu” bên dưới."
            >
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Họ và tên đệm</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Ví dụ: Nguyễn Văn"
                      />
                    </FormControl>
                    <FormDescription>Họ và chữ đệm của cán bộ.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="givenName"
                rules={{ required: "Vui lòng nhập tên của cán bộ." }}
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>
                      Tên <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>
                      Tên gọi của cán bộ, hiện trên các màn hình.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                rules={USER_FIELD_RULES.username}
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>
                      Tên đăng nhập <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>
                      Dùng để đăng nhập. Không được trùng với tài khoản khác.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={USER_FIELD_RULES.email}
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>
                      Thư điện tử <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>Dùng để liên hệ khi cần.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection
              title="Đơn vị công tác và trạng thái"
              description="Nơi cán bộ làm việc và việc cho phép hay không cho phép đăng nhập."
            >
              {/*
                Ba ô một hàng như Figma 310:36846. Đơn vị đang lưu được truyền
                vào để ô chọn hiện đúng tên ngay cả trước khi danh sách về — và
                cả khi tài khoản này không có quyền xem danh sách đơn vị.
              */}
              <ReportUnitPicker
                className="md:col-span-4"
                value={form.watch("reportUnit")}
                onChange={(value) =>
                  form.setValue("reportUnit", value, { shouldDirty: true })
                }
                current={user?.reportUnit}
              />

              <AccountLevelField
                className="md:col-span-4"
                hasUnit={form.watch("reportUnit")?.id != null}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <StatusSwitchField
                    className="md:col-span-4"
                    value={field.value}
                    onChange={field.onChange}
                    savedStatus={user?.status}
                  />
                )}
              />
            </FormSection>

            <FormSection
              title="Vai trò"
              description="Việc cán bộ được làm trên hệ thống. Giữ nhiều vai trò thì được làm gộp các việc của tất cả vai trò đó."
            >
              <FormField
                control={form.control}
                name="roles"
                rules={{
                  validate: (value) =>
                    (Array.isArray(value) && value.length > 0) ||
                    "Vui lòng chọn ít nhất một vai trò.",
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-12">
                    <FormControl>
                      <RolePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSectionActions>
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
              {form.formState.isDirty && (
                <span className="text-muted-foreground ms-auto flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="bg-warning inline-block size-2 rounded-full"
                  />
                  Có thay đổi chưa lưu
                </span>
              )}
            </FormSectionActions>
          </SectionedFormPanel>
        </form>
      </Form>

      {userId != null && <ResetPasswordCard userId={userId} />}
    </EditView>
  );
};
