import { useMemo, useState } from "react";
import { CopyPlus, Eye, FilePlus, Pencil, Search, SearchX, Send } from "lucide-react";

import {
  EmptyState,
  RowActions,
  StatusBadge,
  TwoLineCell,
  formatDate,
  formatDateTime,
  type ActionItem,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";

import type {
  ChangeLogEntry,
  FormKind,
  TemplateForm,
  TemplateSet,
  TemplateVersion,
} from "../fixtures";
import {
  KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  canClone,
  canPublish,
  formLabel,
  isEditable,
  versionLabel,
} from "../model";

export type FormRow = {
  form: TemplateForm;
  /** Phiên bản của biểu, mới nhất trước. */
  chain: TemplateVersion[];
  current: TemplateVersion | undefined;
};

type KindFilter = "all" | FormKind;

const th =
  "text-overline text-muted-foreground bg-surface-subtle sticky top-0 z-10 h-10 border-b px-3 text-left align-middle whitespace-nowrap";
const td = "h-14 border-b px-3 align-middle";

/**
 * Cột giữa của Bộ biểu mẫu: đầu bộ mẫu, hai tab (Biểu mẫu | Lịch sử thay đổi),
 * thanh tìm + lọc loại, bảng biểu, chân đếm dòng.
 */
export function FormsPanel({
  set,
  rows,
  logs,
  selectedFormId,
  onSelectForm,
  onCreateForm,
  onOpenDesigner,
  onPublish,
  onClone,
  className,
}: {
  set: TemplateSet;
  rows: FormRow[];
  logs: ChangeLogEntry[];
  selectedFormId: string | null;
  onSelectForm: (formId: string) => void;
  onCreateForm: () => void;
  onOpenDesigner: (version: TemplateVersion) => void;
  onPublish: (version: TemplateVersion) => void;
  onClone: (version: TemplateVersion) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<"forms" | "history">("forms");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return rows.filter(
      ({ form }) =>
        (kind === "all" || form.kind === kind) &&
        (!q ||
          formLabel(form).toLocaleLowerCase("vi").includes(q) ||
          (form.title ?? "").toLocaleLowerCase("vi").includes(q))
    );
  }, [rows, query, kind]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.at.localeCompare(a.at)),
    [logs]
  );

  function rowItems({ chain, current }: FormRow): ActionItem[] {
    const latest = chain[0];
    const items: ActionItem[] = [];
    if (latest) {
      const editable = isEditable(latest.status);
      items.push({
        key: "design",
        label: editable
          ? `Thiết kế ${versionLabel(latest).toLowerCase()}`
          : `Xem thiết kế ${versionLabel(latest).toLowerCase()}`,
        icon: editable ? Pencil : Eye,
        onSelect: () => onOpenDesigner(latest),
      });
      const publish = canPublish(latest);
      items.push({
        key: "publish",
        label: editable
          ? `Ban hành ${versionLabel(latest).toLowerCase()}`
          : "Ban hành",
        icon: Send,
        disabled: !publish.ok,
        reason: publish.ok ? undefined : "Không có phiên bản nháp nào.",
        onSelect: () => onPublish(latest),
      });
    }
    const base = current?.status === "published" ? current : undefined;
    const cloneable = base
      ? canClone(chain, base)
      : { ok: false as const, reason: "Chưa có phiên bản đã ban hành." };
    items.push({
      key: "clone",
      label: "Tạo phiên bản kế tiếp",
      icon: CopyPlus,
      disabled: !cloneable.ok,
      reason: cloneable.ok ? undefined : cloneable.reason,
      onSelect: () => base && onClone(base),
    });
    return items;
  }

  return (
    <section
      aria-label={set.name}
      className={cn(
        "bg-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1",
        className
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "forms" | "history")}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="flex flex-col gap-0.5 px-4 pt-4 pb-3">
          <h2 className="truncate text-base leading-6 font-semibold">
            {set.name}
          </h2>
          <p className="text-muted-foreground truncate text-xs leading-4">
            {rows.length} biểu · Tạo {formatDate(set.createdAt)} · Cập nhật{" "}
            {formatDate(set.updatedAt)}
            {set.description ? ` · ${set.description}` : ""}
          </p>
        </div>

        <div className="px-4 pb-3">
          <TabsList>
            <TabsTrigger value="forms" className="px-3">
              Biểu mẫu ({rows.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="px-3">
              Lịch sử thay đổi
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="forms"
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={FilePlus}
              title="Bộ này chưa có biểu mẫu nào"
              description="Tạo biểu mẫu đầu tiên rồi mở thiết kế để dựng bảng."
              action={
                <Button onClick={onCreateForm}>
                  <FilePlus aria-hidden />
                  Tạo biểu mẫu
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
                <div className="relative min-w-48 flex-1">
                  <Search
                    aria-hidden
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  />
                  <Input
                    type="search"
                    value={query}
                    placeholder="Tìm theo tên biểu…"
                    aria-label="Tìm theo tên biểu"
                    className="pl-9"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as KindFilter)}
                >
                  <SelectTrigger aria-label="Lọc theo loại biểu" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Loại: Tất cả</SelectItem>
                    <SelectItem value="chi-tiet">Loại: {KIND_LABEL["chi-tiet"]}</SelectItem>
                    <SelectItem value="tong-hop">Loại: {KIND_LABEL["tong-hop"]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="scrollbar-fade min-h-0 flex-1 overflow-auto border-t">
                {shown.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="Không có biểu nào khớp"
                    description="Thử tìm bằng từ khác hoặc chọn lại loại biểu."
                  />
                ) : (
                  <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className={th}>Tên biểu</th>
                        <th scope="col" className={cn(th, "w-32")}>Loại biểu</th>
                        <th scope="col" className={cn(th, "w-40")}>Phiên bản đang dùng</th>
                        <th scope="col" className={cn(th, "w-36")}>Hiệu lực</th>
                        <th scope="col" className={cn(th, "w-36")}>Trạng thái</th>
                        <th scope="col" className={cn(th, "w-14")}>
                          <span className="sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((row) => {
                        const { form, current } = row;
                        const selected = form.id === selectedFormId;
                        // Bản đang dùng thật (đã ban hành / đã khoá); biểu chỉ có nháp thì để "—".
                        const live =
                          current &&
                          (current.status === "published" ||
                            current.status === "locked")
                            ? current
                            : undefined;
                        return (
                          <tr
                            key={form.id}
                            aria-current={selected || undefined}
                            tabIndex={0}
                            onClick={() => onSelectForm(form.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectForm(form.id);
                              }
                            }}
                            className={cn(
                              "cursor-pointer transition-colors outline-none",
                              "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset",
                              selected ? "bg-accent" : "hover:bg-surface-subtle"
                            )}
                          >
                            <td className={td}>
                              <TwoLineCell
                                primary={formLabel(form)}
                                secondary={form.title}
                              />
                            </td>
                            <td className={td}>{KIND_LABEL[form.kind]}</td>
                            <td className={td}>
                              {live ? versionLabel(live) : "—"}
                            </td>
                            <td className={cn(td, "tabular-nums whitespace-nowrap")}>
                              {live?.effectiveFrom
                                ? `${formatDate(live.effectiveFrom)} – nay`
                                : "—"}
                            </td>
                            <td className={td}>
                              {current && (
                                <StatusBadge tone={STATUS_TONE[current.status]}>
                                  {STATUS_LABEL[current.status]}
                                </StatusBadge>
                              )}
                            </td>
                            <td className={cn(td, "pr-4")}>
                              <RowActions items={rowItems(row)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="text-muted-foreground border-t px-4 py-3 text-xs">
                Hiển thị {shown.length > 0 ? `1–${shown.length}` : "0"} trong{" "}
                {shown.length} biểu
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent
          value="history"
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <div className="scrollbar-fade min-h-0 flex-1 overflow-auto border-t">
            <table className="w-full min-w-[600px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "w-44")}>Thời gian</th>
                  <th scope="col" className={cn(th, "w-48")}>Người thực hiện</th>
                  <th scope="col" className={th}>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="h-11 border-b px-3 align-middle tabular-nums whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.at)}
                    </td>
                    <td className="h-11 border-b px-3 align-middle">{log.actor}</td>
                    <td className="h-11 border-b px-3 align-middle">{log.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-muted-foreground border-t px-4 py-3 text-xs">
            Hiển thị {sortedLogs.length > 0 ? `1–${sortedLogs.length}` : "0"}{" "}
            trong {sortedLogs.length} thay đổi
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
