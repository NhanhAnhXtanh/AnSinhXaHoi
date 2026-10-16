import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { formatNumber } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

/** Màu ô biểu tượng của thẻ chỉ số. */
export type StatTone = "primary" | "warning" | "success" | "destructive";

const STAT_TONE: Record<StatTone, string> = {
  primary: "bg-accent text-primary",
  warning: "bg-warning-subtle text-warning-text",
  success: "bg-success-subtle text-success-text",
  destructive: "bg-destructive-subtle text-destructive-text",
};

/** Thẻ chỉ số: ô biểu tượng 40px + số lớn + một dòng giải thích. */
export function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: StatTone;
  value: number;
  label: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-xl border bg-card p-5 shadow-e1">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          STAT_TONE[tone]
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-2xl leading-8 font-semibold tabular-nums">
          {formatNumber(value)}
        </span>
        <span className="text-muted-foreground truncate text-[13px] leading-5">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Hàng bốn thẻ chỉ số. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

/** Khung trắng của một khối trên Trang chủ. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-4 rounded-xl border bg-card p-6 shadow-e1",
        className
      )}
    >
      {children}
    </section>
  );
}

/** Đầu khung: tiêu đề bên trái, liên kết "… →" bên phải. */
export function PanelHeader({
  title,
  linkLabel,
  linkTo,
}: {
  title: ReactNode;
  linkLabel?: string;
  linkTo?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <h2 className="min-w-0 flex-1 truncate text-base leading-6 font-semibold">
        {title}
      </h2>
      {linkLabel && linkTo && <ArrowLink to={linkTo}>{linkLabel}</ArrowLink>}
    </div>
  );
}

export function ArrowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-primary",
        "hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Dòng chữ nhạt thay cho nội dung khi khối không có gì để hiện. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/**
 * Thanh xếp chồng: mỗi đoạn rộng theo tỉ lệ trên tổng, phần còn lại để nền.
 * Màu từng đoạn là lớp nền token (`bg-success`…).
 */
export function StackedBar({
  segments,
  total,
  className,
  label,
}: {
  segments: { key: string; value: number; fill: string }[];
  total: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex h-2 w-full overflow-hidden rounded-full bg-accent", className)}
    >
      {segments.map((s) =>
        s.value > 0 && total > 0 ? (
          <div
            key={s.key}
            className={cn("h-full", s.fill)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ) : null
      )}
    </div>
  );
}

/**
 * Vòng tròn tỉ lệ (donut) vẽ bằng SVG: mỗi đoạn là một vòng tròn có
 * `stroke-dasharray` bằng độ dài cung, dời bằng `stroke-dashoffset`.
 * Màu lấy từ lớp token (`stroke-success`…), không có mã màu rời.
 */
export function Donut({
  segments,
  total,
  size = 200,
  thickness = 22,
  children,
  label,
}: {
  segments: { key: string; value: number; stroke: string }[];
  total: number;
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const arcs = toArcs(segments, total, c);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-accent"
        />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeDasharray={`${a.len} ${c - a.len}`}
            strokeDashoffset={-a.start}
            className={a.stroke}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** Độ dài và điểm bắt đầu của từng cung trên chu vi `c`; bỏ đoạn bằng 0. */
function toArcs(
  segments: { key: string; value: number; stroke: string }[],
  total: number,
  c: number
): { key: string; stroke: string; len: number; start: number }[] {
  if (total <= 0) return [];
  const arcs: { key: string; stroke: string; len: number; start: number }[] = [];
  let start = 0;
  for (const s of segments) {
    const len = (s.value / total) * c;
    if (len > 0) arcs.push({ key: s.key, stroke: s.stroke, len, start });
    start += len;
  }
  return arcs;
}
