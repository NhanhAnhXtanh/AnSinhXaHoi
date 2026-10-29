import { useMemo } from "react";

import { formatNumber } from "@/shared/components/asxh/format";
import { cn } from "@/shared/lib/utils";

export type SheetCell = string | number | null;

export type SheetRow = {
  cells: SheetCell[];
  kind?: "title" | "header" | "group" | "normal" | "total";
  editable?: boolean;
  /**
   * Cột nào của dòng được nhập (chỉ số từ 0). Bỏ trống → mọi ô số hoặc ô trống
   * trừ cột đầu (thường là STT).
   */
  editableCols?: number[];
};

export type SheetData = {
  columns: { label: string; width?: number; align?: "left" | "right" | "center" }[];
  rows: SheetRow[];
};

const DEFAULT_COL_WIDTH = 120;
const ROW_NUMBER_WIDTH = 48;

/** 0 → A, 25 → Z, 26 → AA … */
function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function isCellEditable(row: SheetRow, col: number): boolean {
  if (!row.editable) return false;
  if (row.editableCols) return row.editableCols.includes(col);
  if (col === 0) return false;
  const v = row.cells[col];
  return v === null || v === undefined || v === "" || typeof v === "number";
}

/** "1.234.567" / "1234567" / "1.234,5" → số; rỗng → null. */
function parseNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Bảng tính giả lập (chưa có SpreadJS): hàng tiêu đề cột A, B, C…, cột số hàng,
 * ô kẻ mảnh, cuộn hai chiều trong khung với hàng tiêu đề và cột số hàng dính.
 *
 * Kiểu dòng: `title` chữ đậm canh trái (được tràn sang ô trống bên cạnh),
 * `header` nền surface-subtle chữ đậm canh giữa, `group` đậm, `total` đậm nền
 * accent nhạt. Số luôn canh phải, chữ số đều (tabular-nums), viết kiểu 1.234.567.
 * Khi không `readOnly`, ô được nhập có nền info-subtle nhạt; có `onCellChange`
 * thì ô đó gõ được thật.
 */
export function SpreadsheetView({
  sheet,
  readOnly = false,
  minRows = 0,
  onCellChange,
  className,
}: {
  sheet: SheetData;
  readOnly?: boolean;
  /** Thêm hàng trống cho đủ số hàng này (trông như bảng tính thật). */
  minRows?: number;
  /** Nhận giá trị mới của ô khi rời ô. Chỉ dùng khi không `readOnly`. */
  onCellChange?: (rowIndex: number, colIndex: number, value: SheetCell) => void;
  className?: string;
}) {
  const { columns } = sheet;

  const rows = useMemo<SheetRow[]>(() => {
    const extra = Math.max(0, minRows - sheet.rows.length);
    if (extra === 0) return sheet.rows;
    const blank: SheetRow = { cells: [], kind: "normal" };
    return [...sheet.rows, ...Array.from({ length: extra }, () => blank)];
  }, [sheet.rows, minRows]);

  return (
    <div
      className={cn(
        "bg-card relative min-h-0 min-w-0 flex-1 overflow-auto",
        className
      )}
    >
      <table
        className="min-w-full table-fixed border-separate border-spacing-0 text-[13px] leading-4"
        style={{
          width:
            ROW_NUMBER_WIDTH +
            columns.reduce((s, c) => s + (c.width ?? DEFAULT_COL_WIDTH), 0),
        }}
      >
        <colgroup>
          <col style={{ width: ROW_NUMBER_WIDTH }} />
          {columns.map((c, i) => (
            <col key={i} style={{ width: c.width ?? DEFAULT_COL_WIDTH }} />
          ))}
        </colgroup>

        <thead>
          <tr className="h-6">
            <th
              aria-hidden
              className="bg-surface-subtle sticky top-0 left-0 z-30 border-r border-b"
            />
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                title={c.label}
                className="bg-surface-subtle text-muted-foreground sticky top-0 z-20 border-r border-b px-2 text-center font-normal"
              >
                {columnLetter(i)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, r) => {
            const kind = row.kind ?? "normal";
            const bold = kind !== "normal";
            return (
              <tr
                key={r}
                className={cn(
                  "h-7",
                  kind === "header" && "bg-surface-subtle",
                  kind === "total" && "bg-accent/50"
                )}
              >
                <th
                  scope="row"
                  className="bg-surface-subtle text-muted-foreground sticky left-0 z-10 border-r border-b px-1 text-center text-xs font-normal tabular-nums"
                >
                  {r + 1}
                </th>
                {columns.map((col, c) => {
                  const value = row.cells[c] ?? null;
                  const numeric = typeof value === "number";
                  const editable = !readOnly && isCellEditable(row, c);
                  const align =
                    kind === "header"
                      ? "center"
                      : kind === "title"
                        ? "left"
                        : numeric
                          ? "right"
                          : (col.align ?? "left");
                  const text = numeric ? formatNumber(value) : (value ?? "");

                  return (
                    <td
                      key={c}
                      className={cn(
                        "border-r border-b px-2",
                        kind === "title"
                          ? "relative overflow-visible whitespace-nowrap"
                          : "truncate",
                        bold && "font-semibold",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        (numeric || col.align === "right") && "tabular-nums",
                        editable && "bg-info-subtle/60"
                      )}
                    >
                      {editable && onCellChange ? (
                        <input
                          key={String(value)}
                          defaultValue={text}
                          aria-label={`Ô ${columnLetter(c)}${r + 1}`}
                          inputMode={numeric || value === null ? "decimal" : "text"}
                          className={cn(
                            "focus-visible:ring-ring/60 -mx-2 h-7 w-[calc(100%+1rem)] bg-transparent px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset",
                            align === "right" && "text-right tabular-nums"
                          )}
                          onBlur={(e) => {
                            const raw = e.currentTarget.value;
                            const next: SheetCell =
                              numeric || value === null
                                ? (parseNumber(raw) ?? (raw.trim() ? raw : null))
                                : raw;
                            if (next !== value) onCellChange(r, c, next);
                          }}
                        />
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

SpreadsheetView.displayName = "SpreadsheetView";
