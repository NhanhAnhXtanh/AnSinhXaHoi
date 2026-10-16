import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Power, PowerOff, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  HeaderActions,
  RowActions,
  StatusBadge,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import type { ReportUnit } from "./fixtures";
import { addAccount, allUsernames, setAccountActive, useReportUnits } from "./store";

const INACTIVE_REASON = "Đơn vị đang ngừng hoạt động nên chưa làm được việc này.";

/**
 * Panel "Tài khoản của đơn vị" ở trang Sửa (Figma 310:35692). Cấp / tắt tài
 * khoản có hiệu lực ngay, không đợi nút Lưu của form đơn vị phía trên.
 */
export function UnitAccountsPanel({ unit }: { unit: ReportUnit }) {
  const [granting, setGranting] = useState(false);

  return (
    <section className="bg-card text-card-foreground border-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base leading-6 font-semibold">Tài khoản của đơn vị</h2>
          <p className="text-muted-foreground text-xs leading-4">
            Những người dùng được gắn với đơn vị này và đăng nhập để báo cáo.
          </p>
        </div>
        <HeaderActions
          secondary={[
            {
              label: "Cấp tài khoản",
              icon: UserPlus,
              onClick: () => setGranting(true),
              disabled: !unit.active,
              reason: INACTIVE_REASON,
            },
          ]}
        />
      </header>

      {unit.accounts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Đơn vị chưa có tài khoản nào"
          description="Bấm Cấp tài khoản để tạo tài khoản đăng nhập cho đơn vị."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">Tên đăng nhập</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead>Thư điện tử</TableHead>
              <TableHead className="w-44">Trạng thái</TableHead>
              <TableHead align="right" className="w-16 pe-6">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unit.accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="ps-6">{account.username}</TableCell>
                <TableCell>{account.fullName}</TableCell>
                <TableCell>{account.email}</TableCell>
                <TableCell>
                  <StatusBadge tone={account.active ? "success" : "neutral"}>
                    {account.active ? "Đang hoạt động" : "Ngừng hoạt động"}
                  </StatusBadge>
                </TableCell>
                <TableCell align="right" className="pe-6">
                  <RowActions
                    items={[
                      account.active
                        ? {
                            key: "deactivate",
                            label: "Ngừng hoạt động",
                            icon: PowerOff,
                            onSelect: () => {
                              setAccountActive(unit.id, account.id, false);
                              toast.success(
                                `Đã ngừng hoạt động tài khoản ${account.username}.`
                              );
                            },
                          }
                        : {
                            key: "reactivate",
                            label: "Kích hoạt lại",
                            icon: Power,
                            disabled: !unit.active,
                            reason: unit.active ? undefined : INACTIVE_REASON,
                            onSelect: () => {
                              setAccountActive(unit.id, account.id, true);
                              toast.success(
                                `Đã kích hoạt lại tài khoản ${account.username}.`
                              );
                            },
                          },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <GrantAccountDialog unit={unit} open={granting} onOpenChange={setGranting} />
    </section>
  );
}

type AccountFormValues = { username: string; fullName: string; email: string };

const EMPTY_ACCOUNT: AccountFormValues = { username: "", fullName: "", email: "" };

function GrantAccountDialog({
  unit,
  open,
  onOpenChange,
}: {
  unit: ReportUnit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const units = useReportUnits();
  const schema = useMemo(() => {
    const taken = allUsernames(units);
    return z.object({
      username: z
        .string()
        .trim()
        .min(1, "Hãy nhập tên đăng nhập.")
        .regex(
          /^[a-z0-9._-]{3,50}$/,
          "Tên đăng nhập gồm 3–50 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch ngang."
        )
        .refine((v) => !taken.has(v), "Tên đăng nhập này đã có người dùng. Hãy chọn tên khác."),
      fullName: z.string().trim().min(1, "Hãy nhập họ và tên người dùng."),
      email: z
        .string()
        .trim()
        .min(1, "Hãy nhập thư điện tử.")
        .email("Thư điện tử chưa đúng dạng, ví dụ ten@donvi.dongnai.gov.vn."),
    });
  }, [units]);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_ACCOUNT,
  });

  function close(next: boolean) {
    if (!next) form.reset(EMPTY_ACCOUNT);
    onOpenChange(next);
  }

  function submit(values: AccountFormValues) {
    addAccount(unit.id, {
      username: values.username.trim(),
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      active: true,
    });
    toast.success(`Đã cấp tài khoản ${values.username.trim()} cho ${unit.name}.`);
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cấp tài khoản</DialogTitle>
          <DialogDescription>
            Người dùng đăng nhập bằng tài khoản này để báo cáo cho {unit.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="grant-account-form"
            onSubmit={form.handleSubmit(submit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className="data-[error=true]:text-foreground">
                    Tên đăng nhập
                  </FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" placeholder="Ví dụ: ketoan.baovinh" />
                  </FormControl>
                  <FormMessage className="text-destructive-text text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className="data-[error=true]:text-foreground">
                    Họ và tên
                  </FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" placeholder="Ví dụ: Trần Thị Mai" />
                  </FormControl>
                  <FormMessage className="text-destructive-text text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className="data-[error=true]:text-foreground">
                    Thư điện tử
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="off"
                      placeholder="Ví dụ: mai.tt@baovinh.dongnai.gov.vn"
                    />
                  </FormControl>
                  <FormMessage className="text-destructive-text text-xs" />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Quay lại
          </Button>
          <Button type="submit" form="grant-account-form">
            <UserPlus aria-hidden />
            Cấp tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
