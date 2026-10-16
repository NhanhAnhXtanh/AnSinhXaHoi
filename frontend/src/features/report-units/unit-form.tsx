import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  useFormField,
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
  type ReportUnit,
  type UnitType,
} from "./fixtures";
import { childrenOf, descendantIds } from "./store";

/** Giá trị của ô Đơn vị cấp trên khi để trống — Select không nhận value rỗng. */
const NO_PARENT = "__none__";

export type UnitFormValues = {
  code: string;
  name: string;
  /** "" = không có cấp trên. */
  parentId: string;
  /** "" = chưa chọn. */
  type: string;
  active: boolean;
  receivesReports: boolean;
};

export type UnitFormResult = {
  code: string;
  name: string;
  parentId: string | null;
  type: UnitType;
  active: boolean;
  receivesReports: boolean;
};

function buildSchema(units: ReportUnit[], editing: ReportUnit | undefined) {
  const blockedParents = editing
    ? new Set([editing.id, ...descendantIds(units, editing.id)])
    : new Set<string>();

  return z
    .object({
      code: z
        .string()
        .trim()
        .min(1, "Hãy nhập mã quan hệ ngân sách.")
        .regex(/^\d{7}$/, "Mã quan hệ ngân sách gồm 7 chữ số, ví dụ 1052345."),
      name: z
        .string()
        .trim()
        .min(1, "Hãy nhập tên đơn vị.")
        .max(255, "Tên đơn vị dài quá 255 ký tự. Hãy rút gọn lại."),
      parentId: z.string(),
      type: z
        .string()
        .refine((v) => (UNIT_TYPES as string[]).includes(v), "Hãy chọn loại đơn vị."),
      active: z.boolean(),
      receivesReports: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (
        !editing &&
        units.some((u) => u.code === v.code.trim())
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["code"],
          message: "Mã này đã có đơn vị khác dùng. Hãy nhập mã khác.",
        });
      }
      if (v.parentId && blockedParents.has(v.parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentId"],
          message:
            "Đơn vị cấp trên không được là chính đơn vị này hoặc một đơn vị cấp dưới của nó. Hãy chọn đơn vị khác.",
        });
      }
    });
}

/** Gợi ý dưới ô; khi ô có lỗi thì nhường chỗ cho dòng lỗi (như Figma). */
function FieldHint({ children }: { children: ReactNode }) {
  const { error } = useFormField();
  if (error) return null;
  return <p className="text-muted-foreground text-xs leading-4">{children}</p>;
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
const ITEM_CLASS = "gap-1.5";

/**
 * Form Đơn vị, dùng chung cho Thêm và Sửa. Lưới 3 cột đều theo Figma
 * (310:31992 / 310:35692): Mã | Tên | Cấp trên ; Loại | Trạng thái | Phiếu báo cáo.
 */
export function UnitForm({
  units,
  editing,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  units: ReportUnit[];
  /** Đơn vị đang sửa; bỏ trống = thêm mới. */
  editing?: ReportUnit;
  defaultValues: UnitFormValues;
  onSubmit: (values: UnitFormResult) => void;
  onCancel: () => void;
}) {
  const schema = useMemo(() => buildSchema(units, editing), [units, editing]);
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const [askCascade, setAskCascade] = useState(false);

  /** Đơn vị cấp dưới đang hoạt động — để hỏi trước khi tắt (UC-02). */
  const activeDescendants = useMemo(() => {
    if (!editing) return 0;
    const ids = descendantIds(units, editing.id);
    return units.filter((u) => ids.has(u.id) && u.active).length;
  }, [units, editing]);

  /** Danh sách chọn cấp trên: dạng cây, bỏ chính nó và cấp dưới của nó. */
  const parentOptions = useMemo(() => {
    const blocked = editing
      ? new Set([editing.id, ...descendantIds(units, editing.id)])
      : new Set<string>();
    const out: { unit: ReportUnit; level: number }[] = [];
    const walk = (parentId: string | null, level: number) => {
      for (const u of childrenOf(units, parentId)) {
        if (blocked.has(u.id)) continue;
        if (u.active || u.id === defaultValues.parentId) out.push({ unit: u, level });
        walk(u.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [units, editing, defaultValues.parentId]);

  function submit(values: UnitFormValues) {
    onSubmit({
      code: values.code.trim(),
      name: values.name.trim(),
      parentId: values.parentId || null,
      type: values.type as UnitType,
      active: values.active,
      receivesReports: values.receivesReports,
    });
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
                name="code"
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
                        className={editing ? "bg-muted disabled:opacity-100 text-muted-foreground" : undefined}
                      />
                    </FormControl>
                    <FieldHint>
                      {editing
                        ? "Mã đã lưu nên không đổi được."
                        : "Nhập tay, không đổi được sau khi lưu."}
                    </FieldHint>
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
                        <SelectItem value={NO_PARENT}>
                          Không có — đây là đơn vị cao nhất
                        </SelectItem>
                        {parentOptions.map(({ unit, level }) => (
                          <SelectItem
                            key={unit.id}
                            value={unit.id}
                            style={{
                              paddingInlineStart: `calc(var(--spacing) * ${2 + level * 4})`,
                            }}
                          >
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldHint>Để trống nếu đây là đơn vị cao nhất.</FieldHint>
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
                name="type"
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Lưu
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Huỷ
            </Button>
          </FormActions>
        </FormPanel>
      </form>

      <ConfirmDialog
        open={askCascade}
        onOpenChange={setAskCascade}
        title="Ngừng hoạt động đơn vị này?"
        description={`Đơn vị này có ${activeDescendants} đơn vị cấp dưới đang hoạt động. Khi lưu, toàn bộ đơn vị cấp dưới và tài khoản của chúng sẽ ngừng hoạt động theo. Khi kích hoạt lại, các đơn vị cấp dưới không tự hoạt động lại.`}
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
