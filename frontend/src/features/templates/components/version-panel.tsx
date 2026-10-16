import type { LucideIcon } from "lucide-react";
import { ArrowRight, CopyPlus, Eye, Layers, Pencil, Send } from "lucide-react";

import {
  ActionMenu,
  EmptyState,
  StatusBadge,
  formatDate,
  formatDateTime,
  type ActionItem,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import type { TemplateForm, TemplateVersion } from "../types";
import {
  KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  canClone,
  formLabel,
  isEditable,
  successorOf,
  versionLabel,
} from "../model";

/**
 * Cột phải của Bộ biểu mẫu: tên biểu + dòng phụ, "Lịch sử phiên bản" dạng
 * thẻ (thẻ đang chọn viền màu chính, mỗi thẻ có ⋯), chân hai nút theo phiên
 * bản đang chọn: Mở thiết kế · Ban hành / Tạo phiên bản kế tiếp.
 */
export function VersionPanel({
  form,
  chain,
  selectedId,
  onSelect,
  itemsFor,
  onOpenDesigner,
  onPublish,
  onClone,
  className,
}: {
  form: TemplateForm | null;
  /** Phiên bản của biểu, mới nhất trước. */
  chain: TemplateVersion[];
  selectedId: string | null;
  onSelect: (versionId: string) => void;
  itemsFor: (version: TemplateVersion) => ActionItem[];
  onOpenDesigner: (version: TemplateVersion) => void;
  onPublish: (version: TemplateVersion) => void;
  onClone: (version: TemplateVersion) => void;
  className?: string;
}) {
  const selected = chain.find((v) => v.id === selectedId) ?? chain[0] ?? null;

  return (
    <section
      aria-label={form ? `Lịch sử phiên bản ${formLabel(form)}` : "Chi tiết biểu"}
      className={cn(
        "bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border shadow-e1",
        className
      )}
    >
      {!form ? (
        <EmptyState
          icon={Layers}
          title="Chưa chọn biểu"
          description="Chọn một biểu ở bảng giữa để xem các phiên bản của biểu."
        />
      ) : (
        <>
          <div className="flex flex-col gap-0.5 px-4 pt-4 pb-3">
            <h2 className="truncate text-base leading-6 font-semibold">
              {formLabel(form)}
            </h2>
            <p className="text-muted-foreground truncate text-xs leading-4">
              {[form.title, KIND_LABEL[form.kind]].filter(Boolean).join(" · ")}
            </p>
          </div>

          <h3 className="px-4 pb-2 text-sm font-semibold">Lịch sử phiên bản</h3>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {chain.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Biểu chưa có phiên bản nào"
                description="Các phiên bản đã bị xoá hết."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {chain.map((version) => (
                  <li key={version.id}>
                    <VersionCard
                      version={version}
                      selected={version.id === selected?.id}
                      items={itemsFor(version)}
                      onSelect={() => onSelect(version.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="flex flex-col gap-2 border-t p-4">
              <FooterButton
                icon={isEditable(selected.status) ? Pencil : Eye}
                label={isEditable(selected.status) ? "Mở thiết kế" : "Xem thiết kế"}
                onClick={() => onOpenDesigner(selected)}
              />
              <SecondButton
                chain={chain}
                version={selected}
                onPublish={onPublish}
                onClone={onClone}
                onSelect={onSelect}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function VersionCard({
  version,
  selected,
  items,
  onSelect,
}: {
  version: TemplateVersion;
  selected: boolean;
  items: ActionItem[];
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "bg-card flex cursor-pointer flex-col gap-1.5 rounded-lg border px-3.5 py-3",
        "transition-colors duration-150 outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        selected ? "border-primary" : "hover:bg-surface-subtle"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 font-semibold">
          {versionLabel(version)}
        </span>
        <StatusBadge tone={STATUS_TONE[version.status]}>
          {STATUS_LABEL[version.status]}
        </StatusBadge>
        <div
          className="ms-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ActionMenu
            items={items}
            label={`Thao tác với ${versionLabel(version).toLowerCase()}`}
          />
        </div>
      </div>
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs leading-4">
        <dt className="text-muted-foreground">Ban hành</dt>
        <dd className="tabular-nums">
          {version.publishedAt ? formatDateTime(version.publishedAt) : "—"}
        </dd>
        <dt className="text-muted-foreground">Hiệu lực từ</dt>
        <dd className="tabular-nums">
          {version.effectiveFrom ? formatDate(version.effectiveFrom) : "—"}
          {version.effectiveFrom && isEditable(version.status) && (
            <span className="text-muted-foreground"> (dự kiến)</span>
          )}
        </dd>
        <dt className="text-muted-foreground">Người phê duyệt</dt>
        <dd className="truncate">{version.approver ?? "—"}</dd>
      </dl>
    </div>
  );
}

function FooterButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  reason,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  reason?: string;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
  if (!disabled || !reason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex w-full rounded-md outline-none">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Nút thứ hai đổi chữ theo trạng thái phiên bản đang chọn (UC-13, UC-14):
 * nháp → Ban hành; đã ban hành → Tạo phiên bản kế tiếp, hoặc Chọn phiên bản
 * kế tiếp khi đã có; đã khoá / thu hồi → nút mờ kèm lý do.
 */
function SecondButton({
  chain,
  version,
  onPublish,
  onClone,
  onSelect,
}: {
  chain: TemplateVersion[];
  version: TemplateVersion;
  onPublish: (v: TemplateVersion) => void;
  onClone: (v: TemplateVersion) => void;
  onSelect: (id: string) => void;
}) {
  if (isEditable(version.status)) {
    return (
      <FooterButton
        icon={Send}
        label={`Ban hành ${versionLabel(version).toLowerCase()}`}
        onClick={() => onPublish(version)}
      />
    );
  }
  const next = successorOf(chain, version);
  if (next) {
    return (
      <FooterButton
        icon={ArrowRight}
        label={`Chọn ${versionLabel(next).toLowerCase()}`}
        onClick={() => onSelect(next.id)}
      />
    );
  }
  const allowed = canClone(chain, version);
  return (
    <FooterButton
      icon={CopyPlus}
      label="Tạo phiên bản kế tiếp"
      disabled={!allowed.ok}
      reason={allowed.ok ? undefined : allowed.reason}
      onClick={() => onClone(version)}
    />
  );
}
