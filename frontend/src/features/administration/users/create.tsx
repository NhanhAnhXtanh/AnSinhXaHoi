import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import { CreateView } from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { InputPassword } from "@/shared/components/form/input-password";
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
import { RolePicker, type RoleRef } from "./role-picker";
import { PlacementPicker, type PlacementRef } from "./placement-picker";
import { StatusSwitchField } from "./status-switch-field";
import { RequiredMark, joinFullName, USER_FIELD_RULES } from "./user-form-fields";
import { AdminPageHeader } from "../record-actions";
import { errorDescription } from "../labels";
import type { UserStatus } from "@/domains/user/types";

/**
 * Giá trị của form tạo. `familyName` / `givenName` / `confirmPassword` chỉ sống
 * trên form: API nhận `fullName` một ô và một mật khẩu, nên khi gửi họ tên được
 * ghép lại và ô nhập lại mật khẩu được bỏ đi. Payload gửi đi vẫn đúng
 * `UserRequest` như trước.
 */
type UserFormValues = {
  familyName: string;
  givenName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  status: UserStatus;
  roles: RoleRef[];
  organization: PlacementRef;
  department: PlacementRef;
};

const DEFAULT_VALUES: UserFormValues = {
  familyName: "",
  givenName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  status: "active",
  roles: [],
  // `{ id: null }` thay vì bỏ trống: API đọc đó là "chưa gắn đơn vị", và giữ
  // giá trị của ô chọn luôn là một đối tượng ổn định.
  organization: { id: null },
  department: { id: null },
};

/**
 * Thêm người dùng.
 *
 * Đây là cách duy nhất để có tài khoản — không có tự đăng ký — nên mật khẩu do
 * người tạo đặt ở đây và báo riêng cho cán bộ.
 *
 * Lưới 12 cột, mỗi ô 4 cột: ba ô một hàng như Figma (310:26715).
 */
export const UserCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {
      successNotification: (_data, values) => ({
        type: "success",
        message: `Đã tạo người dùng ${
          (values as { fullName?: string } | undefined)?.fullName ?? ""
        }`.trim(),
      }),
      errorNotification: (error) => ({
        type: "error",
        message: "Không tạo được người dùng",
        description: errorDescription(error),
      }),
    },
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: UserFormValues) {
    // Đúng `UserRequest` của API: họ tên ghép lại thành một ô, không gửi ô
    // nhập lại mật khẩu. Ép kiểu vì `onFinish` nhận kiểu của form.
    const payload = {
      username: values.username,
      email: values.email,
      fullName: joinFullName(values.familyName, values.givenName),
      password: values.password,
      status: values.status,
      roles: values.roles,
      organization: values.organization,
      department: values.department,
    };
    onFinish(payload as unknown as UserFormValues);
  }

  return (
    <CreateView>
      <AdminPageHeader
        title="Thêm người dùng"
        description="Nhập thông tin tài khoản, chọn đơn vị công tác và vai trò cho cán bộ."
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0">
          <SectionedFormPanel>
            <FormSection
              title="Thông tin tài khoản"
              description="Họ tên, tên đăng nhập và mật khẩu đầu tiên của cán bộ."
            >
              <FormField
                control={form.control}
                name="familyName"
                rules={{ required: "Vui lòng nhập họ và tên đệm của cán bộ." }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Họ và tên đệm <RequiredMark />
                    </FormLabel>
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
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Tên <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Ví dụ: An"
                      />
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
                name="email"
                rules={USER_FIELD_RULES.email}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Thư điện tử <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        value={field.value ?? ""}
                        placeholder="Ví dụ: an.nv@dongnai.gov.vn"
                      />
                    </FormControl>
                    <FormDescription>
                      Dùng để liên hệ; cũng đăng nhập được thay cho tên đăng nhập.
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
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Tên đăng nhập <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Ví dụ: an.nv"
                      />
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
                name="password"
                rules={{
                  required: "Vui lòng đặt mật khẩu ban đầu.",
                  minLength: { value: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Mật khẩu ban đầu <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <InputPassword
                        {...field}
                        value={field.value ?? ""}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 8 ký tự"
                      />
                    </FormControl>
                    <FormDescription>
                      Hãy gửi mật khẩu này cho cán bộ và nhắc đổi sau lần đăng
                      nhập đầu.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                rules={{
                  required: "Vui lòng nhập lại mật khẩu.",
                  validate: (value) =>
                    value === form.getValues("password") ||
                    "Mật khẩu nhập lại chưa giống mật khẩu ban đầu.",
                }}
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>
                      Nhập lại mật khẩu <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <InputPassword
                        {...field}
                        value={field.value ?? ""}
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu vừa đặt"
                      />
                    </FormControl>
                    <FormDescription>Phải giống mật khẩu ban đầu.</FormDescription>
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
                Hai ô, một điều khiển: danh sách phòng ban lọc theo đơn vị chọn
                bên cạnh, đổi đơn vị thì phòng ban bị xoá. `contents` để hai ô
                nằm thẳng trên lưới của mục này.
              */}
              <PlacementPicker
                className="contents"
                itemClassName="md:col-span-4"
                organization={form.watch("organization")}
                department={form.watch("department")}
                onOrganizationChange={(value) =>
                  form.setValue("organization", value)
                }
                onDepartmentChange={(value) =>
                  form.setValue("department", value)
                }
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <StatusSwitchField
                    className="md:col-span-4"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormSection>

            <FormSection
              title="Vai trò"
              description="Việc cán bộ được làm trên hệ thống. Chọn ít nhất một vai trò để cán bộ thấy được màn hình làm việc."
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
                {form.formState.isSubmitting ? "Đang tạo..." : "Tạo người dùng"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Huỷ
              </Button>
            </FormSectionActions>
          </SectionedFormPanel>
        </form>
      </Form>
    </CreateView>
  );
};
