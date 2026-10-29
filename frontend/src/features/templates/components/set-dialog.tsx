import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

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

import type { TemplateActions } from "../api";
import type { TemplateSet } from "../types";

/**
 * Hộp Tạo / Sửa bộ mẫu (UC-09, khung 311:84908): tên bắt buộc + mô tả.
 * Không có ô trạng thái (BR-09.3); mã bộ mẫu do hệ thống tự sinh.
 */
export function SetDialog({
  actions,
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  actions: TemplateActions;
  open: boolean;
  /** Bộ mẫu đang sửa; không có = tạo mới. */
  editing?: TemplateSet | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (set: TemplateSet) => void;
}) {
  const nameId = useId();
  const descId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setError(null);
    setBusy(false);
  }, [open, editing]);

  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("Hãy nhập tên bộ mẫu.");
      return;
    }
    setBusy(true);
    const result = editing
      ? await actions.updateSet(editing.id, { name, description })
      : await actions.createSet({ name, description });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(
      editing
        ? `Đã lưu bộ mẫu “${result.value.name}”.`
        : `Đã tạo bộ mẫu “${result.value.name}”.`
    );
    onOpenChange(false);
    onSaved?.(result.value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa bộ mẫu" : "Tạo bộ mẫu"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Tên mới hiện ngay ở mọi màn có dùng bộ mẫu này."
              : "Đặt tên cho bộ mẫu mới. Sau đó bạn thêm các biểu mẫu vào bộ."}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>
              Tên bộ mẫu <span className="text-destructive-text">*</span>
            </Label>
            <Input
              id={nameId}
              value={name}
              autoFocus
              autoComplete="off"
              placeholder="Ví dụ: Biểu mẫu ASXH năm 2027"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id={errorId} className="text-destructive-text text-xs">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={descId}>Mô tả (không bắt buộc)</Label>
            <Input
              id={descId}
              value={description}
              autoComplete="off"
              placeholder="Ghi chú ngắn về bộ mẫu"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button type="submit" disabled={busy}>
              {editing ? "Lưu" : "Tạo bộ mẫu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
