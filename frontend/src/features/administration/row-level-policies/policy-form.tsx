import { useCustom, useSelect } from "@refinedev/core";
import type { UseFormReturn } from "react-hook-form";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
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
import { FormSection } from "@/shared/components/form/form-section";
import { ScopeBuilder } from "./scope-builder";
import { KIND_LABELS, KIND_OPTION_LABELS } from "./labels";
import { scopeCompleteMessage } from "./policy-values";
import { actionLabel, resourceLabel } from "../labels";
import {
  ACTIONS,
  EMPTY_SCOPE,
  type PolicyMetadata,
  type ScopeNode,
} from "@/domains/row-level-policy/types";

/**
 * The create and edit forms are the same form, so it lives here once.
 *
 * Nó trả về các `FormSection` (không có khung ngoài): màn tạo / sửa bọc trong
 * `SectionedFormPanel` cùng thanh nút, hộp thoại ở tab vai trò đặt thẳng vào
 * thân hộp. Bố cục theo Figma 311:81124.
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
      <FormSection
        title="Phạm vi này là gì"
        description="Chọn loại phạm vi, dữ liệu và vai trò áp dụng. “Mở rộng” cho một vai trò thấy thêm dữ liệu; “Hạn chế” thu hẹp dữ liệu của mọi người, không ai thoát được."
      >
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Loại phạm vi</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={lockIdentity || lockKind}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SCOPE">{KIND_OPTION_LABELS.SCOPE}</SelectItem>
                  <SelectItem value="FILTER">{KIND_OPTION_LABELS.FILTER}</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {lockIdentity
                  ? "Không đổi được: đổi loại là thành một phạm vi khác trên dữ liệu khác."
                  : lockKind
                    ? "Phạm vi hạn chế không gắn với vai trò nào, nên không tạo từ màn của một vai trò."
                    : "Các phạm vi mở rộng cộng dồn với nhau; phạm vi hạn chế luôn được áp dụng."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="resource"
          rules={{ required: "Vui lòng chọn dữ liệu áp dụng." }}
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Dữ liệu áp dụng</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ""}
                disabled={lockIdentity}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn loại dữ liệu" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {resourceOptions.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {resourceLabel(candidate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {lockIdentity
                  ? "Không đổi được sau khi đã tạo."
                  : "Chỉ liệt kê các loại dữ liệu có thể giới hạn."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="action"
          rules={{ required: "Vui lòng chọn thao tác." }}
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Thao tác</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn thao tác" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ACTIONS.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {actionLabel(candidate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {action === "write"
                  ? "Kiểm hai lần: với dòng đang có, và với dòng sau khi lưu."
                  : "Áp dụng mỗi khi mở danh sách hoặc xem một dòng dữ liệu."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/*
          Phạm vi hạn chế không có vai trò. Hiện ô bị khoá thay vì ẩn đi để thấy
          đó là quyết định, không phải ô bị quên.
        */}
        <FormField
          control={form.control}
          name="role.id"
          rules={{
            validate: (value) =>
              kind === "FILTER" ||
              value != null ||
              "Phạm vi mở rộng phải chọn vai trò được mở rộng.",
          }}
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Vai trò</FormLabel>
              {/*
                Mã vai trò là số trên API nhưng `Select` so sánh bằng chuỗi, nên
                đổi kiểu ở đúng chỗ này.
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
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        kind === "FILTER"
                          ? "Áp dụng cho mọi vai trò"
                          : roleQuery.isLoading
                            ? "Đang tải..."
                            : "Chọn vai trò"
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
              <FormDescription>
                {lockRole
                  ? "Cố định: phạm vi này thuộc vai trò đang sửa."
                  : kind === "FILTER"
                    ? "Phạm vi hạn chế áp dụng cho mọi người."
                    : "Chỉ cần chọn khi là phạm vi mở rộng."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          rules={{
            required: "Vui lòng đặt tên cho phạm vi.",
            maxLength: { value: 160, message: "Tối đa 160 ký tự." },
          }}
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>
                Tên phạm vi <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Ví dụ: Cán bộ đơn vị chỉ thấy phiếu của mình"
                />
              </FormControl>
              <FormDescription>
                Viết rõ ai được thấy gì để người khác đọc là hiểu.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Trạng thái</FormLabel>
              <div className="flex h-9 items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <span className="text-sm">
                  {(field.value ?? true) ? "Đang áp dụng" : "Tạm tắt"}
                </span>
              </div>
              <FormDescription>
                {kind === "FILTER"
                  ? "Tắt thì mọi người thoát khỏi giới hạn này."
                  : "Tắt thì vai trò không còn thấy phần dữ liệu phạm vi này mở ra."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          rules={{ maxLength: { value: 500, message: "Tối đa 500 ký tự." } }}
          render={({ field }) => (
            <FormItem className="md:col-span-8">
              <FormLabel>Mô tả</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={2}
                  className="min-h-9 resize-y"
                  placeholder="Vì sao có phạm vi này, để người đọc sau hiểu."
                />
              </FormControl>
              <FormDescription>Không bắt buộc.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="policyGroup"
          rules={{ maxLength: { value: 64, message: "Tối đa 64 ký tự." } }}
          render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormLabel>Nhóm hiển thị</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Ví dụ: Theo đơn vị"
                />
              </FormControl>
              <FormDescription>
                Chỉ để gom các dòng trên màn này, không ảnh hưởng dữ liệu.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>

      <FormSection
        title="Dòng dữ liệu được thấy"
        description="Chọn điều kiện để xác định những dòng dữ liệu mà phạm vi này cho thấy. Mọi lựa chọn đều lấy từ danh sách có sẵn, không phải viết công thức."
      >
        <div className="flex flex-col gap-4 md:col-span-12">
          {metadata && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Vai trò chưa có phạm vi riêng trên dữ liệu này:
              </span>
              <Badge
                variant={metadata.defaultScope === "FULL" ? "secondary" : "outline"}
              >
                {metadata.defaultScope === "FULL"
                  ? "thấy toàn bộ"
                  : "không thấy gì"}
              </Badge>
            </div>
          )}

          {metadata && metadata.designTime.length > 0 && (
            <Alert>
              <AlertDescription className="flex flex-col gap-1">
                <span className="font-medium">
                  Đang áp dụng thêm, được cài sẵn trong hệ thống và không sửa ở
                  đây:
                </span>
                {metadata.designTime.map((declared, index) => (
                  <span key={index} className="text-sm">
                    {KIND_LABELS[declared.kind] ?? declared.kind} ·{" "}
                    {actionLabel(declared.action)}
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
            rules={{ validate: scopeCompleteMessage }}
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
        </div>
      </FormSection>

      {/*
        Chỉ thao tác "Thêm, sửa" để lại một trạng thái mới, nên chỉ nó có điều
        kiện thứ hai. Hiện mục này cho Xem / Xoá là mời điền một điều kiện không
        bao giờ được dùng.
      */}
      {action === "write" && (
        <FormSection
          title="Sau khi lưu"
          description="Điều kiện ở trên quyết định dòng nào được sửa. Điều kiện này quyết định dòng được phép trông như thế nào sau khi lưu."
        >
          <FormField
            control={form.control}
            name="checkScope"
            rules={{ validate: scopeCompleteMessage }}
            render={({ field }) => (
              <FormItem className="space-y-4 md:col-span-12">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value === null || field.value === undefined}
                      onCheckedChange={(sameAsAbove) =>
                        // `null` và cây rỗng là hai điều ngược nhau: `null` dùng
                        // lại điều kiện ở trên, cây rỗng cho phép mọi trạng thái.
                        field.onChange(sameAsAbove ? null : EMPTY_SCOPE)
                      }
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Dòng sau khi lưu vẫn phải khớp điều kiện ở trên</FormLabel>
                    <FormDescription>
                      Bật sẵn, và nên bật khi điều kiện ở trên nói về việc dòng
                      đó <b>của ai</b> — đơn vị, phòng ban, người tạo. Nhờ vậy
                      không ai chuyển được dòng dữ liệu ra ngoài phạm vi mình
                      thấy để giấu nó đi.
                    </FormDescription>
                  </div>
                </div>

                {field.value !== null && field.value !== undefined && (
                  <>
                    <Alert>
                      <AlertDescription>
                        Tắt khi điều kiện ở trên nói về <b>trạng thái mà việc
                        sửa sẽ đổi</b>. Ví dụ “chỉ sửa được phiếu nháp” nếu áp cả
                        sau khi lưu thì phiếu nháp không bao giờ nộp được. Để
                        trống phần điều kiện bên dưới nếu cho phép mọi trạng
                        thái sau khi lưu.
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
        </FormSection>
      )}
    </Form>
  );
}
