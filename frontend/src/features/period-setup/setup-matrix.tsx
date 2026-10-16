import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { MatrixCheck, type CheckVisual } from "./matrix-check";
import {
  cellKey,
  UNIT_GROUP_LABEL,
  type MatrixMode,
  type Template,
  type Unit,
} from "./model";

export type CellInfo = {
  visual: CheckVisual;
  /** Đang tích (đã lưu và không chờ gỡ, hoặc chờ lưu). */
  checked: boolean;
  toggleable: boolean;
  /** Lý do không tích được, hiện khi rê chuột. */
  reason?: string;
};

type Aggregate = { visual: CheckVisual; allChecked: boolean; toggleable: boolean };

const UNIT_COL = "w-[300px] min-w-[300px] max-w-[300px]";
const FORM_COL = "w-16 min-w-16 max-w-16";

/**
 * Ma trận Đơn vị × Biểu: cột đơn vị dính trái, hàng tiêu đề dính trên, cuộn
 * hai chiều trong khung của nó. Ô tổng (góc, đầu cột, đầu hàng) tính trên mọi
 * đơn vị đang lọc — tích đầu cột là chọn cả cột.
 */
export function SetupMatrix({
  units,
  scopeUnits,
  templates,
  mode,
  getCell,
  onSet,
}: {
  /** Đơn vị của trang đang xem. */
  units: Unit[];
  /** Mọi đơn vị khớp bộ lọc — phạm vi của ô tổng cột và ô góc. */
  scopeUnits: Unit[];
  templates: Template[];
  mode: MatrixMode;
  getCell: (key: string) => CellInfo;
  onSet: (keys: string[], checked: boolean) => void;
}) {
  const muted = mode === "view" || mode === "locked";

  const aggregate = (keys: string[]): Aggregate => {
    let checked = 0;
    let toggleable = false;
    for (const k of keys) {
      const c = getCell(k);
      if (c.checked) checked += 1;
      if (c.toggleable) toggleable = true;
    }
    const allChecked = keys.length > 0 && checked === keys.length;
    return {
      allChecked,
      toggleable,
      visual: allChecked ? "saved" : checked > 0 ? "indeterminate" : "empty",
    };
  };

  const keysOf = (us: Unit[], ts: Template[]) =>
    us.flatMap((u) => ts.map((t) => cellKey(u.id, t.code)));

  const cornerKeys = keysOf(scopeUnits, templates);
  const corner = aggregate(cornerKeys);
  const lockReason =
    mode === "locked" && cornerKeys[0] ? getCell(cornerKeys[0]).reason : undefined;

  return (
    <div className="scrollbar-fade min-h-0 flex-1 overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                UNIT_COL,
                "sticky top-0 left-0 z-30 h-[60px] border-r border-b bg-surface-subtle px-4 text-left font-normal"
              )}
            >
              <div className="flex items-center gap-3">
                <WithReason reason={corner.toggleable ? undefined : lockReason}>
                  <MatrixCheck
                    visual={corner.visual}
                    disabled={!corner.toggleable}
                    label="Chọn tất cả đơn vị và biểu mẫu"
                    onToggle={() => onSet(cornerKeys, !corner.allChecked)}
                  />
                </WithReason>
                <span className="text-xs font-medium text-muted-foreground">
                  Đơn vị
                </span>
              </div>
            </th>
            {templates.map((t) => {
              const keys = keysOf(scopeUnits, [t]);
              const col = aggregate(keys);
              return (
                <th
                  key={t.code}
                  scope="col"
                  title={`Biểu ${t.code} — ${t.name}`}
                  className={cn(
                    FORM_COL,
                    "sticky top-0 z-20 h-[60px] border-b bg-surface-subtle font-normal"
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <WithReason reason={col.toggleable ? undefined : lockReason}>
                      <MatrixCheck
                        visual={col.visual}
                        disabled={!col.toggleable}
                        label={`Chọn cả cột biểu ${t.code}`}
                        onToggle={() => onSet(keys, !col.allChecked)}
                      />
                    </WithReason>
                    <span className="text-xs text-muted-foreground">{t.code}</span>
                  </div>
                </th>
              );
            })}
            {/* Cột đệm: giữ các cột biểu đúng 64px khi khung rộng hơn ma trận. */}
            <th
              aria-hidden
              className="sticky top-0 z-20 border-b bg-surface-subtle"
            />
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const rowKeys = keysOf([u], templates);
            const row = aggregate(rowKeys);
            return (
              <tr key={u.id}>
                <th
                  scope="row"
                  className={cn(
                    UNIT_COL,
                    "sticky left-0 z-10 h-[52px] border-r border-b bg-card px-4 text-left font-normal"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <WithReason reason={row.toggleable ? undefined : lockReason}>
                      <MatrixCheck
                        visual={row.visual}
                        disabled={!row.toggleable}
                        label={`Chọn mọi biểu cho ${u.name}`}
                        onToggle={() => onSet(rowKeys, !row.allChecked)}
                      />
                    </WithReason>
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "truncate text-sm font-medium",
                          muted ? "text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {u.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {UNIT_GROUP_LABEL[u.group]}
                      </div>
                    </div>
                  </div>
                </th>
                {templates.map((t) => {
                  const key = cellKey(u.id, t.code);
                  const cell = getCell(key);
                  return (
                    <td
                      key={t.code}
                      className={cn(
                        FORM_COL,
                        "h-[52px] border-b text-center align-middle",
                        cell.visual === "pendingAdd" && "bg-warning-subtle",
                        cell.visual === "pendingRemove" && "bg-destructive-subtle"
                      )}
                    >
                      <WithReason reason={cell.toggleable ? undefined : cell.reason}>
                        <MatrixCheck
                          visual={cell.visual}
                          disabled={!cell.toggleable}
                          label={`${u.name} — biểu ${t.code}`}
                          onToggle={() => onSet([key], !cell.checked)}
                        />
                      </WithReason>
                    </td>
                  );
                })}
                <td aria-hidden className="border-b" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WithReason({
  reason,
  children,
}: {
  reason?: string;
  children: ReactNode;
}) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
