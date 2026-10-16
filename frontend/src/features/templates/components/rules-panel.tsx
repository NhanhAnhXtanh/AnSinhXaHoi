import { useId } from "react";
import { Play, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";

export type RuleScope = "form" | "set";

export type RuleDraft = {
  name: string;
  scope: RuleScope;
  enabled: boolean;
  code: string;
};

/**
 * Khung "Soạn công thức và quy tắc nhập" bên phải bảng thiết kế (khung
 * 311:88923): tên quy tắc, phạm vi, bật/tắt, vùng soạn nền tối, nhật ký chạy thử.
 */
export function RulesPanel({
  formName,
  rule,
  onChange,
  readOnly,
  log,
  onRun,
  onClose,
  className,
}: {
  /** "1a" — để viết lựa chọn "Chỉ biểu 1a". */
  formName: string;
  rule: RuleDraft;
  onChange: (rule: RuleDraft) => void;
  readOnly: boolean;
  log: { time: string; text: string }[];
  onRun: () => void;
  onClose: () => void;
  className?: string;
}) {
  const nameId = useId();
  const scopeId = useId();
  const enabledId = useId();
  const codeId = useId();

  return (
    <aside
      aria-label="Soạn công thức và quy tắc nhập"
      className={cn("bg-card flex min-h-0 flex-col border-l", className)}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          Soạn công thức và quy tắc nhập
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={onRun}>
          <Play aria-hidden />
          Chạy thử
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Đóng khung quy tắc"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={nameId}>Tên quy tắc</Label>
          <Input
            id={nameId}
            value={rule.name}
            readOnly={readOnly}
            autoComplete="off"
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={scopeId}>Áp dụng cho</Label>
          <Select
            value={rule.scope}
            disabled={readOnly}
            onValueChange={(v) => onChange({ ...rule, scope: v as RuleScope })}
          >
            <SelectTrigger id={scopeId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="form">Chỉ biểu {formName}</SelectItem>
              <SelectItem value="set">Mọi biểu trong bộ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch
            id={enabledId}
            checked={rule.enabled}
            disabled={readOnly}
            onCheckedChange={(checked) => onChange({ ...rule, enabled: checked })}
          />
          <Label htmlFor={enabledId} className="font-normal">
            Bật quy tắc này
          </Label>
        </div>
      </div>

      {/* Vùng soạn nền tối: dùng tông của thanh bên để đọc tốt ở cả chế độ sáng và tối. */}
      <div className="bg-sidebar text-sidebar-foreground flex min-h-0 flex-1 flex-col">
        <label htmlFor={codeId} className="sr-only">
          Nội dung quy tắc
        </label>
        <textarea
          id={codeId}
          value={rule.code}
          readOnly={readOnly}
          spellCheck={false}
          onChange={(e) => onChange({ ...rule, code: e.target.value })}
          className={cn(
            "min-h-0 flex-1 resize-none bg-transparent px-4 py-3",
            "font-mono text-xs leading-5 whitespace-pre outline-none",
            "focus-visible:ring-sidebar-ring/60 focus-visible:ring-2 focus-visible:ring-inset"
          )}
        />

        <div className="border-sidebar-border border-t px-4 py-3">
          <p className="text-overline text-sidebar-foreground/70 mb-1.5">
            Nhật ký chạy thử
          </p>
          {log.length === 0 ? (
            <p className="text-sidebar-foreground/70 text-xs leading-5">
              Bấm Chạy thử để thử quy tắc trên bảng đang thiết kế.
            </p>
          ) : (
            <ul
              aria-live="polite"
              className="max-h-28 overflow-y-auto font-mono text-xs leading-5"
            >
              {log.map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-sidebar-foreground/70 shrink-0 tabular-nums">
                    {line.time}
                  </span>
                  <span className="min-w-0">{line.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
