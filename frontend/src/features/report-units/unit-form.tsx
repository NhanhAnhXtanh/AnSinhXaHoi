import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWarnAboutChange } from "@refinedev/core";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/shared/components/asxh";
import { FormActions, FormPanel } from "@/shared/components/form/form-panel";
import { Button } from "@/shared/ui/button";
import {
  Form,
  FormControl,
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

import {
  UNIT_TYPES,
  UNIT_TYPE_LABELS,
  apiErrorMessage,
  apiFieldErrors,
  childIndex,
  descendantIds,
  type ReportUnit,
  type UnitType,
} from "./model";

/** Giá trị của ô Đơn vị cấp trên khi để trống — Select không nhận value rỗng. */
const NO_PARENT = "__none__";

export type UnitFormValues = {
  budgetCode: string;
  name: string;
  /** "" = không có cấp trên; còn lại là id dạng chuỗi (Select chỉ nhận chuỗi). */
  parentId: string;
  /** "" = chưa chọn. */
  unitType: string;
  active: boolean;
  receivesReports: boolean;
};

export type UnitFormResult = {
  budgetCode: string;
  name: string;
  parentId: number | null;
  unitType: UnitType;
  active: boolean;
  receivesReports: boolean;
};

/** Tên ô của form — để trang gắn lỗi máy chủ trả về vào đúng ô. */
export type UnitFormField = keyof UnitFormValues;

export type UnitFormHelpers = {
  setFieldError: (field: UnitFormField, message: string) => void;
};

/** Tên trường máy chủ → ô của form. */
const SERVER_FIELDS: Record<string, UnitFormField> = {
  budgetCode: "budgetCode",
  name: "name",
  parent: "parentId",
  unitType: "unitType",
};

/**
 * Đặt lỗi máy chủ trả về vào đúng ô (mã trùng, cấp trên tạo vòng, lỗi kiểm tra
 * từng ô); lỗi không thuộc ô nào thì hiện thông báo nổi.
 */
export function showServerError(
  error: unknown,
  setFieldError: UnitFormHelpers["setFieldError"],
  fallback: string
) {
  let placed = false;
  for (const [key, message] of Object.entries(apiFieldErrors(error))) {
    const field = SERVER_FIELDS[key];
    if (field) {
      setFieldError(field, message);
      placed = true;
    }
  }
  if (placed) return;
  const message = apiErrorMessage(error, fallback);
  if (/^Mã đơn vị/.test(message)) setFieldError("budgetCode", message);
  else if (/^Đơn vị cha/.test(message)) setFieldError("parentId", message);
  else toast.error(message);
}

function buildSchema(units: ReportUnit[], editing: ReportUnit | undefined) {
  const index = childIndex(units);
  const blockedParents = editing
    ? new Set([editing.id, ...descendantIds(index, editing.id)])
    : new Set<number>();
  const takenCodes = new Set(units.map((u) => u.budgetCode.toLocaleLowerCase("vi")));

  return z
    .object({
      budgetCode: z
        .string()
        .trim()
        .min(1, "Hãy nhập mã quan hệ ngân sách.")
        .max(32, "Mã quan hệ ngân sách dài quá 32 ký tự.")
        .regex(
          /^[A-Za-z0-9._-]+$/,
          "Mã chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang, ví dụ 1052345."
        ),
      name: z
        .string()
        .trim()
        .min(1, "Hãy nhập tên đơn vị.")
        .max(255, "Tên đơn vị dài quá 255 ký tự. Hãy rút gọn lại."),
      parentId: z.string(),
      unitType: z
        .string()
        .refine((v) => (UNIT_TYPES as string[]).includes(v), "Hãy chọn loại đơn vị."),
      active: z.boolean(),
      receivesReports: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!editing && takenCodes.has(v.budgetCode.trim().toLocaleLowerCase("vi"))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["budgetCode"],
          message: "Mã đơn vị này đã tồn tại. Vui lòng nhập mã khác.",
        });
      }
      if (v.parentId && blockedParents.has(Number(v.parentId))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentId"],
          message:
            "Đơn vị cấp trên không được là chính đơn vị này hoặc một đơn vị cấp dưới của nó. Hãy chọn đơn vị khác.",
        });
      }
    });
}

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

const LABEL_CLASS = "data-[error=true]:text-foreground";
const MESSAGE_CLASS = "text-destructive-text text-xs leading-4";
// content-start: ô thấp hơn ô cùng hàng (vd. ô bên cạnh đang hiện dòng lỗi)
// không bị lưới kéo giãn các hàng bên trong, nên nhãn và ô nhập vẫn thẳng hàng.
const ITEM_CLASS = "content-start gap-1.5";

/**
 * Form Đơn vị, dùng chung cho Thêm và Sửa. Lưới 3 cột đều theo Figma
 * (310:31992 / 310:35692): Mã | Tên | Cấp trên ; Loại | Trạng thái | Phiếu báo cáo.
 *
 * Rời trang khi còn thay đổi chưa lưu: form báo cho Refine qua `setWarnWhen`, và
 * `UnsavedChangesGuard` của khung ứng dụng hỏi bằng hộp thoại của ứng dụng (CLAUDE.md
 * "Leaving a form with unsaved edits"). Nút Huỷ điều hướng bình thường nên cũng được hỏi.
 */
export function UnitForm({
  units,
  editing,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  /** Cả cây đơn vị — để dựng ô cấp trên và kiểm mã trùng. */
  units: ReportUnit[];
  /** Đơn vị đang sửa; bỏ trống = thêm mới. */
  editing?: ReportUnit;
  defaultValues: UnitFormValues;
  /** Trả `true` khi đã lưu (trang tự chuyển đi), `false` khi máy chủ từ chối. */
  onSubmit: (values: UnitFormResult, helpers: UnitFormHelpers) => Promise<boolean>;
  onCancel: () => void;
}) {
  const schema = useMemo(() => buildSchema(units, editing), [units, editing]);
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { setWarnWhen } = useWarnAboutChange();
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    setWarnWhen(isDirty);
  }, [isDirty, setWarnWhen]);

  const [askCascade, setAskCascade] = useState(false);
  const [saving, setSaving] = useState(false);

  const index = useMemo(() => childIndex(units), [units]);

  /** Đơn vị cấp dưới đang hoạt động — để hỏi trước khi tắt (UC-02). */
  const activeDescendants = useMemo(() => {
    if (!editing) return 0;
    const ids = descendantIds(index, editing.id);
    return units.filter((u) => ids.has(u.id) && u.active).length;
  }, [units, index, editing]);

  /** Danh sách chọn cấp trên: dạng cây, bỏ chính nó và cấp dưới của nó. */
  const parentOptions = useMemo(() => {
    const blocked = editing
      ? new Set([editing.id, ...descendantIds(index, editing.id)])
      : new Set<number>();
    const out: { unit: ReportUnit; level: number }[] = [];
    const walk = (parentId: number | null, level: number) => {
      for (const u of index.get(parentId) ?? []) {
        if (blocked.has(u.id)) continue;
        if (u.active || String(u.id) === defaultValues.parentId) out.push({ unit: u, level });
        walk(u.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [index, editing, defaultValues.parentId]);

  async function submit(values: UnitFormValues) {
    // Tắt cảnh báo trước khi gửi: trang chuyển về danh sách ngay khi lưu xong.
    setWarnWhen(false);
    setSaving(true);
    try {
      const ok = await onSubmit(
        {
          budgetCode: values.budgetCode.trim(),
          name: values.name.trim(),
          parentId: values.parentId ? Number(values.parentId) : null,
          unitType: values.unitType as UnitType,
          active: values.active,
          receivesReports: values.receivesReports,
        },
        {
          setFieldError: (field, message) =>
            form.setError(field, { type: "server", message }, { shouldFocus: true }),
        }
      );
      if (!ok) setWarnWhen(form.formState.isDirty);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <FormPanel>
          <section className="flex flex-col gap-4">
            <h2 className="text-base leading-6 font-semibold">Thông tin đơn vị</h2>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="budgetCode"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>
                      Mã quan hệ ngân sách <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ví dụ: 1052345"
                        disabled={Boolean(editing)}
                        className={
                          editing
                            ? "bg-muted disabled:opacity-100 text-muted-foreground"
                            : undefined
                        }
                      />
                    </FormControl>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>
                      Tên đơn vị <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        placeholder="Ví dụ: UBND xã Phú Hữu"
                      />
                    </FormControl>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>Đơn vị cấp trên</FormLabel>
                    <Select
                      value={field.value === "" ? undefined : field.value}
                      onValueChange={(v) => field.onChange(v === NO_PARENT ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue placeholder="Chọn đơn vị cấp trên" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PARENT}>Không có</SelectItem>
                        {parentOptions.map(({ unit, level }) => (
                          <SelectItem
                            key={unit.id}
                            value={String(unit.id)}
                            style={{
                              paddingInlineStart: `calc(var(--spacing) * ${2 + level * 4})`,
                            }}
                          >
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-base leading-6 font-semibold">Phân loại và trạng thái</h2>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>
                      Loại đơn vị <RequiredMark />
                    </FormLabel>
                    <Select
                      value={field.value === "" ? undefined : field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue placeholder="Chọn loại đơn vị" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {UNIT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>Trạng thái</FormLabel>
                    <div className="flex h-9 items-center gap-2">
                      <FormControl>
                        <Switch
                          ref={field.ref}
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            if (!checked && editing?.active && activeDescendants > 0) {
                              setAskCascade(true);
                              return;
                            }
                            field.onChange(checked);
                          }}
                        />
                      </FormControl>
                      <span className="text-sm">
                        {field.value ? "Đang hoạt động" : "Ngừng hoạt động"}
                      </span>
                    </div>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receivesReports"
                render={({ field }) => (
                  <FormItem className={ITEM_CLASS}>
                    <FormLabel className={LABEL_CLASS}>Phiếu báo cáo</FormLabel>
                    <div className="flex h-9 items-center gap-2">
                      <FormControl>
                        <Switch
                          ref={field.ref}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <span className="text-sm">
                        {field.value
                          ? "Được nhận phiếu báo cáo"
                          : "Không nhận phiếu báo cáo"}
                      </span>
                    </div>
                    <FormMessage className={MESSAGE_CLASS} />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <FormActions>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle aria-hidden className="animate-spin" />}
              Lưu
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Huỷ
            </Button>
          </FormActions>
        </FormPanel>
      </form>

      <ConfirmDialog
        open={askCascade}
        onOpenChange={setAskCascade}
        title="Ngừng hoạt động đơn vị này?"
        description={`Đơn vị này có ${activeDescendants} đơn vị cấp dưới đang hoạt động. Khi lưu, toàn bộ đơn vị cấp dưới sẽ ngừng hoạt động theo. Khi kích hoạt lại, các đơn vị cấp dưới không tự hoạt động lại.`}
        confirmLabel="Ngừng hoạt động"
        cancelLabel="Quay lại"
        onConfirm={() => {
          form.setValue("active", false, { shouldDirty: true });
          setAskCascade(false);
        }}
      />
    </Form>
  );
}
