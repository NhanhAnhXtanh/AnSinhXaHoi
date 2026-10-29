import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { formatDate } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

import type { TemplateActions } from "../api";
import type { FormKind, TemplateForm, TemplateSet } from "../types";
import { KIND_LABEL, firstOfNextMonth, parseVnDate } from "../model";

type Field = "name" | "kind" | "date";

/**
 * Hộp Tạo biểu mẫu (UC-10, khung 311:85173): tên ngắn, tên đầy đủ (không bắt
 * buộc — trống thì lấy "Biểu <tên ngắn>"), loại biểu, áp dụng từ ngày. Tạo ra
 * phiên bản 1 (nháp) của biểu. Hai cách kết thúc: Lưu nháp (ở lại màn, biểu
 * mới được chọn) hoặc Tạo và mở thiết kế.
 */
export function CreateFormDialog({
  actions,
  set,
  onOpenChange,
  onCreated,
}: {
  actions: TemplateActions;
  /** Bộ mẫu nhận biểu mới; null = hộp đóng. */
  set: TemplateSet | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (
    created: { form: TemplateForm; firstVersionId: string | null },
    openDesigner: boolean
  ) => void;
}) {
  const nameId = useId();
  const titleId = useId();
  const kindId = useId();
  const dateId = useId();
  const [shownSet, setShownSet] = useState<TemplateSet | null>(set);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<FormKind>("chi-tiet");
  const [date, setDate] = useState("");
  const [invalid, setInvalid] = useState<Set<Field>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!set) return;
    setShownSet(set);
    setName("");
    setTitle("");
    setBusy(false);
    setKind("chi-tiet");
    setDate(formatDate(firstOfNextMonth()));
    setInvalid(new Set());
    setError(null);
  }, [set]);

  async function submit(openDesigner: boolean) {
    if (!set || busy) return;
    const bad = new Set<Field>();
    if (!name.trim()) bad.add("name");
    const iso = parseVnDate(date);
    if (!date.trim()) bad.add("date");
    setInvalid(bad);
    if (bad.size > 0) {
      setError("Vui lòng nhập đủ các trường bắt buộc.");
      document.getElementById(bad.has("name") ? nameId : dateId)?.focus();
      return;
    }
    if (!iso) {
      setInvalid(new Set(["date"]));
      setError("Ngày chưa đúng. Hãy nhập theo dạng ngày/tháng/năm, ví dụ 01/11/2026.");
      document.getElementById(dateId)?.focus();
      return;
    }
    setBusy(true);
    const result = await actions.createForm({
      setId: set.id,
      shortName: name,
      name: title.trim() || `Biểu ${name.trim()}`,
      kind,
      effectiveFrom: iso,
    });
    setBusy(false);
    if (!result.ok) {
      setInvalid(new Set(["name"]));
      setError(result.error);
      return;
    }
    toast.success(`Đã tạo biểu ${result.value.form.name} (phiên bản 1, nháp).`);
    onOpenChange(false);
    onCreated(result.value, openDesigner);
  }

  const clear = (field: Field) => {
    if (!invalid.has(field)) return;
    const next = new Set(invalid);
    next.delete(field);
    setInvalid(next);
    if (next.size === 0) setError(null);
  };

  return (
    <Dialog open={set !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo biểu mẫu</DialogTitle>
          <DialogDescription>
            Biểu mẫu mới sẽ nằm trong bộ “{shownSet?.name}”.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>
              Tên biểu <span className="text-destructive-text">*</span>
            </Label>
            <Input
              id={nameId}
              value={name}
              autoFocus
              autoComplete="off"
              placeholder="Ví dụ: 1k"
              aria-invalid={invalid.has("name") || undefined}
              onChange={(e) => {
                setName(e.target.value);
                clear("name");
              }}
            />
            <p className="text-muted-foreground text-xs">
              Tên ngắn, hiện trên thẻ của biểu.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>Tên đầy đủ (không bắt buộc)</Label>
            <Input
              id={titleId}
              value={title}
              autoComplete="off"
              placeholder="Ví dụ: Kinh phí thực hiện chính sách bảo trợ xã hội"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={kindId}>
              Loại biểu <span className="text-destructive-text">*</span>
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FormKind)}>
              <SelectTrigger id={kindId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as FormKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={dateId}>
              Áp dụng từ ngày <span className="text-destructive-text">*</span>
            </Label>
            <Input
              id={dateId}
              value={date}
              inputMode="numeric"
              autoComplete="off"
              placeholder="ngày/tháng/năm"
              aria-invalid={invalid.has("date") || undefined}
              onChange={(e) => {
                setDate(e.target.value);
                clear("date");
              }}
            />
            <p className="text-muted-foreground text-xs">
              Mặc định là ngày 1 của tháng sau.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-destructive-text text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void submit(false)}
            >
              Lưu nháp
            </Button>
            <Button type="submit" disabled={busy}>
              Tạo và mở thiết kế
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
