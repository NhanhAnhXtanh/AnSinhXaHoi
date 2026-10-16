import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

/**
 * Ô chỉ đọc "Cấp tài khoản" (Figma 310:26715): suy ra từ ô Đơn vị công tác ngay bên cạnh,
 * không ai nhập (BR-69.1). Có đơn vị ⇒ cấp Đơn vị (chỉ thấy phiếu của đơn vị mình); không có
 * ⇒ Sở hoặc UBND (việc là Sở hay UBND do vai trò quyết định).
 */
export function AccountLevelField({
  hasUnit,
  className,
}: {
  hasUnit: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label className="text-muted-foreground" htmlFor="account-level">
        Cấp tài khoản
      </Label>
      <Input
        id="account-level"
        readOnly
        disabled
        value={hasUnit ? "Đơn vị" : ""}
        placeholder="Sở hoặc UBND"
      />
      <p className="text-muted-foreground text-xs">
        Tự xác định theo đơn vị công tác: có đơn vị thì tài khoản là cấp Đơn vị.
      </p>
    </div>
  );
}
