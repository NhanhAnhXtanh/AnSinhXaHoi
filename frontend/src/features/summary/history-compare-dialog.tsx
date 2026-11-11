import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CircleCheck,
  FileSpreadsheet,
  GitCompare,
  History,
  Info,
  Layers,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCustomMutation } from "@refinedev/core";
import { toast } from "sonner";

import { ConfirmDialog, LoadingState, formatDateTime, formatNumber } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import {
  JSON_HEADERS,
  deptReportUrl,
  errorMessage,
  useApiArray,
  useApiObject,
  type CompareResult,
  type CompareSheet as ApiCompareSheet,
  type SaveResult,
  type VersionEntry,
} from "./api";
import { formatSigned, formatSignedPercent, initials, joinVi } from "./utils";

// ---------------------------------------------------------------- So sánh

type CompareRow = {
  key: string;
  label: string;
  col: "people" | "money";
  a: number;
  b: number;
  aEmpty: boolean;
  bEmpty: boolean;
};

type SheetCompare = {
  key: string;
  short: string;
  rows: CompareRow[];
  totalA: number;
  totalB: number;
  changed: number;
};

const num = (v: number | null) => v ?? 0;

/** Đơn vị kinh phí: cả 20 biểu ASXH ghi "Đơn vị: Triệu đồng" — ghi khác đi là đọc lệch 1.000 lần. */
const MONEY_UNIT = "triệu đồng";

/** Số của hai phiên bản đặt cạnh nhau, từng biểu, từng chỉ tiêu (đã cộng qua đơn vị). */
function toSheetCompare(sheet: ApiCompareSheet): SheetCompare {
  const rows: CompareRow[] = [];
  for (const r of sheet.rows) {
    const hasMoney = r.amountA !== null || r.amountB !== null;
    if (hasMoney) {
      rows.push({
        key: `${r.indicatorCode}|money`,
        label: r.indicatorName,
        col: "money",
        a: num(r.amountA),
        b: num(r.amountB),
        aEmpty: r.amountA === null,
        bEmpty: r.amountB === null,
      });
    }
    // Số đối tượng chỉ đưa vào bảng khi có đổi, hoặc khi chỉ tiêu không có kinh phí.
    if (!hasMoney || num(r.quantityA) !== num(r.quantityB)) {
      rows.push({
        key: `${r.indicatorCode}|people`,
        label: hasMoney ? `${r.indicatorName} — số đối tượng` : r.indicatorName,
        col: "people",
        a: num(r.quantityA),
        b: num(r.quantityB),
        aEmpty: r.quantityA === null,
        bEmpty: r.quantityB === null,
      });
    }
  }
  const money = rows.filter((r) => r.col === "money");
  return {
    key: String(sheet.templateId),
    short: sheet.shortName,
    rows,
    totalA: money.reduce((s, r) => s + r.a, 0),
    totalB: money.reduce((s, r) => s + r.b, 0),
    changed: rows.filter((r) => r.a !== r.b).length,
  };
}

// ---------------------------------------------------------------- Hộp thoại

/**
 * "Lịch sử và so sánh số liệu" (Figma 310:28695, UC-56): trái là các lần lưu
 * của kỳ (thẻ đánh dấu bản A / B), phải là hai bản đặt cạnh nhau — bốn thẻ tóm
 * tắt, tab biểu có số thay đổi, bảng so sánh tô màu ô tăng / giảm. Chân hộp:
 * khôi phục số liệu bản A thành phiên bản mới.
 */
export function HistoryCompareDialog({
  open,
  onOpenChange,
  reportId,
  periodName,
  scopeLabel,
  restoreDisabledReason,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportId: number;
  periodName: string;
  scopeLabel: string;
  /** Lý do không khôi phục được (null = được). */
  restoreDisabledReason: string | null;
  onRestored: (result: SaveResult) => void;
}) {
  const versionsState = useApiArray<VersionEntry>(open ? deptReportUrl(reportId, "/versions") : null, undefined);
  // Mới trước (máy chủ trả đúng thứ tự này).
  const versions = useMemo(() => versionsState.data ?? [], [versionsState.data]);
  const latest = versions[0]?.versionNo ?? 0;

  const [aNo, setANo] = useState(0);
  const [bNo, setBNo] = useState(0);
  const [onlyChanged, setOnlyChanged] = useState(false);
  /** Tab biểu người dùng bấm (null = tự chọn biểu đầu tiên có thay đổi). */
  const [tab, setTab] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const { mutateAsync: post, mutation } = useCustomMutation<SaveResult>();

  // Mỗi lần mở / có danh sách: bản B là bản hiện hành, bản A là lần lưu ngay trước đó.
  useEffect(() => {
    if (!open || versions.length === 0) return;
    setBNo(versions[0].versionNo);
    setANo((versions[1] ?? versions[0]).versionNo);
    setOnlyChanged(false);
    setTab(null);
  }, [open, versions]);

  const compareState = useApiObject<CompareResult>(
    open && aNo > 0 && bNo > 0 ? deptReportUrl(reportId, "/compare") : null,
    { versionA: aNo, versionB: bNo },
    "sheets"
  );
  const sheets = useMemo(
    () => (compareState.data ? compareState.data.sheets.map(toSheetCompare) : []),
    [compareState.data]
  );

  const summary = useMemo(() => {
    const all = sheets.flatMap((s) => s.rows);
    const changed = all.filter((r) => r.a !== r.b);
    const up = changed.filter((r) => r.b > r.a).length;
    const down = changed.length - up;
    const totalA = sheets.reduce((s, x) => s + x.totalA, 0);
    const totalB = sheets.reduce((s, x) => s + x.totalB, 0);
    const moneyRows = all.filter((r) => r.col === "money");
    const decreased = moneyRows.filter((r) => r.b < r.a);
    const worst = decreased.reduce<CompareRow | null>(
      (w, r) => (!w || r.b - r.a < w.b - w.a ? r : w),
      null
    );
    const affected = sheets.filter((s) => s.changed > 0);
    const sheetDeltas = sheets.map((s) => Math.abs(s.totalB - s.totalA));
    return {
      changed: changed.length,
      up,
      down,
      totalA,
      totalB,
      decreased: decreased.length,
      indicators: moneyRows.length,
      worst,
      affected,
      sheetDeltas,
    };
  }, [sheets]);

  const identical = summary.changed === 0;
  const single = versions.length < 2;
  const active = sheets.find((s) => s.key === tab) ?? summary.affected[0] ?? sheets[0];

  /** Đổi cặp bản A / B; tab biểu quay về biểu đầu tiên có thay đổi. */
  const choose = (a: number, b: number) => {
    setANo(a);
    setBNo(b);
    setTab(null);
  };
  const versionA = versions.find((v) => v.versionNo === aNo);

  const pickCard = (no: number) => {
    if (no === aNo) return;
    choose(no, no === bNo ? aNo : bNo);
  };

  const restoreReason =
    restoreDisabledReason ?? (aNo === latest ? "Phiên bản đang chọn đã là bản hiện hành." : null);

  const doRestore = async () => {
    try {
      const { data } = await post({
        url: deptReportUrl(reportId, "/restore"),
        method: "post",
        values: { versionNo: aNo },
        config: JSON_HEADERS,
        successNotification: false,
        errorNotification: false,
      });
      setConfirmRestore(false);
      onOpenChange(false);
      toast.success(
        data.newVersion
          ? `Đã khôi phục số liệu phiên bản ${aNo} thành phiên bản ${data.ledgerVersion}.`
          : "Số liệu hiện hành đã giống phiên bản này, không có gì thay đổi."
      );
      onRestored(data);
    } catch (error) {
      toast.error(errorMessage(error, "Chưa khôi phục được số liệu. Bạn thử lại sau ít phút."));
    }
  };

  let body: ReactNode;
  if (versionsState.isLoading || (compareState.isLoading && !compareState.data)) {
    body = <LoadingState label="Đang tải các lần lưu…" />;
  } else if (versionsState.error || compareState.error) {
    body = (
      <div
        role="alert"
        className="bg-destructive-subtle text-destructive-text flex gap-2.5 rounded-lg px-3.5 py-3 text-sm"
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          {errorMessage(
            versionsState.error ?? compareState.error,
            "Chưa tải được lịch sử số liệu. Bạn thử lại sau ít phút."
          )}
        </p>
      </div>
    );
  } else if (identical) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
        <div className="bg-success-subtle text-success-text mb-2 flex size-14 items-center justify-center rounded-full">
          {single ? <History aria-hidden className="size-6" /> : <CircleCheck aria-hidden className="size-6" />}
        </div>
        <h3 className="text-xl leading-7 font-semibold">
          {single
            ? "Kỳ này mới lưu một lần"
            : aNo === bNo
              ? "Bạn đang chọn cùng một phiên bản"
              : "Hai phiên bản này giống nhau"}
        </h3>
        <p className="text-muted-foreground max-w-md text-sm leading-6">
          {single
            ? "Khi số liệu được lưu thêm lần nữa, bạn có thể đặt hai lần lưu cạnh nhau để so sánh."
            : aNo === bNo
              ? "Hãy chọn hai phiên bản khác nhau để so sánh."
              : `Phiên bản ${aNo} và Phiên bản ${bNo} có số liệu giống hệt nhau ở mọi biểu. Bạn có thể chọn hai phiên bản khác để so sánh.`}
        </p>
      </div>
    );
  } else {
    body = (
      <>
        {/* Bốn thẻ tóm tắt */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            icon={GitCompare}
            iconClass="bg-accent text-foreground"
            value={formatNumber(summary.changed)}
            caption="ô thay đổi"
            note={`${summary.up} ô tăng · ${summary.down} ô giảm`}
          >
            <div className="bg-accent flex h-1.5 overflow-hidden rounded-full">
              <div className="bg-success h-full" style={{ width: `${(summary.up / summary.changed) * 100}%` }} />
              <div
                className="bg-destructive h-full"
                style={{ width: `${(summary.down / summary.changed) * 100}%` }}
              />
            </div>
          </StatCard>

          <StatCard
            icon={summary.totalB >= summary.totalA ? TrendingUp : TrendingDown}
            iconClass={
              summary.totalB >= summary.totalA
                ? "bg-success-subtle text-success-text"
                : "bg-destructive-subtle text-destructive-text"
            }
            value={formatSignedPercent(summary.totalB - summary.totalA, summary.totalA)}
            valueClass={summary.totalB >= summary.totalA ? "text-success-text" : "text-destructive-text"}
            caption={`Tổng kinh phí ${summary.totalB >= summary.totalA ? "tăng" : "giảm"}`}
            note={`${formatSigned(summary.totalB - summary.totalA)} ${MONEY_UNIT}`}
          >
            <Sparkbars values={summary.sheetDeltas} />
          </StatCard>

          <StatCard
            icon={TrendingDown}
            iconClass="bg-destructive-subtle text-destructive-text"
            value={formatNumber(summary.decreased)}
            caption="chỉ tiêu giảm"
            note={
              summary.worst
                ? `Nhiều nhất: ${summary.worst.label.toLocaleLowerCase("vi")}`
                : "Không có chỉ tiêu nào giảm"
            }
          >
            <Meter value={summary.decreased} max={summary.indicators} barClass="bg-destructive" />
          </StatCard>

          <StatCard
            icon={Layers}
            iconClass="bg-accent text-primary"
            value={`${summary.affected.length}/${sheets.length}`}
            caption="biểu bị ảnh hưởng"
            note={`Biểu ${joinVi(summary.affected.map((s) => s.short))}`}
          >
            <Meter value={summary.affected.length} max={sheets.length} barClass="bg-primary" />
          </StatCard>
        </div>

        {/* Tab biểu */}
        <div role="tablist" aria-label="Biểu" className="flex gap-1 overflow-x-auto border-b">
          {sheets.map((s) => {
            const selected = s.key === active?.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(s.key)}
                className={cn(
                  "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm",
                  "outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  selected
                    ? "border-primary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent font-medium"
                )}
              >
                Biểu {s.short}
                {s.changed > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] leading-4.5 font-semibold tabular-nums",
                      selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                    )}
                  >
                    {s.changed}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {active && <CompareTable sheet={active} aNo={aNo} bNo={bNo} onlyChanged={onlyChanged} />}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none",
          "h-[min(860px,calc(100svh-2rem))] w-[min(1360px,calc(100vw-2rem))]"
        )}
      >
        {/* Đầu hộp thoại */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b py-4 ps-6 pe-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-accent text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
              <GitCompare aria-hidden className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-xl leading-6.5 font-semibold">Lịch sử và so sánh số liệu</DialogTitle>
              <DialogDescription className="text-[13px] leading-4.5">
                {periodName} · {scopeLabel} · Kinh phí tính bằng {MONEY_UNIT}
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng">
              <X aria-hidden />
            </Button>
          </DialogClose>
        </div>

        {/* Thân */}
        <div className="flex min-h-0 flex-1">
          <aside className="bg-surface-subtle hidden w-85 shrink-0 flex-col gap-3.5 overflow-y-auto border-e py-5 ps-5 pe-4 md:flex">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Các lần lưu</h3>
              <span className="text-muted-foreground text-xs">{versions.length} lần lưu</span>
            </div>
            <ol className="flex flex-col">
              {versions.map((v, i, arr) => (
                <VersionCard
                  key={v.versionNo}
                  version={v}
                  slot={v.versionNo === aNo ? "A" : v.versionNo === bNo ? "B" : null}
                  last={i === arr.length - 1}
                  onPick={() => pickCard(v.versionNo)}
                />
              ))}
            </ol>
            <div className="bg-info-subtle text-info-text flex gap-2.5 rounded-lg px-3.5 py-3 text-xs leading-4.5">
              <Info aria-hidden className="mt-px size-4 shrink-0" />
              <p>
                Bấm vào một lần lưu để đặt làm bản A hoặc bản B. Số liệu hai bản sẽ được đặt cạnh nhau ở
                bên phải.
              </p>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {/* Thanh so sánh */}
            <div className="flex flex-wrap items-center gap-2.5">
              <VersionSelect slot="A" value={aNo} versions={versions} onChange={(n) => choose(n, bNo)} />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Đổi chỗ bản A và bản B"
                title="Đổi chỗ bản A và bản B"
                onClick={() => choose(bNo, aNo)}
              >
                <ArrowLeftRight aria-hidden />
              </Button>
              <VersionSelect slot="B" value={bNo} versions={versions} onChange={(n) => choose(aNo, n)} />
              <div className="flex-1" />
              <div className="flex items-center gap-2.5">
                <Switch
                  id="compare-only-changed"
                  checked={onlyChanged}
                  onCheckedChange={setOnlyChanged}
                  disabled={identical}
                />
                <Label htmlFor="compare-only-changed" className="text-sm font-normal">
                  Chỉ hiện ô thay đổi
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={identical || !active}
                onClick={() => active && exportCompare(active, aNo, bNo, periodName)}
              >
                <FileSpreadsheet aria-hidden />
                Xuất Excel
              </Button>
            </div>

            {body}
          </section>
        </div>

        {/* Chân */}
        <div className="bg-surface-subtle flex shrink-0 items-center justify-between gap-2 border-t px-6 py-4">
          <RestoreButton
            reason={single ? "Kỳ này mới lưu một lần." : restoreReason}
            onClick={() => setConfirmRestore(true)}
          />
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Đóng
            </Button>
          </DialogClose>
        </div>

        <ConfirmDialog
          open={confirmRestore}
          onOpenChange={(o) => !mutation.isPending && setConfirmRestore(o)}
          title={`Khôi phục số liệu phiên bản ${aNo}?`}
          description={`Số liệu của phiên bản ${aNo}${versionA ? ` (lưu ${formatDateTime(versionA.occurredAt)})` : ""} sẽ được lưu thành phiên bản mới và trở thành bản hiện hành. Các lần lưu cũ vẫn được giữ để đối chiếu.`}
          confirmLabel={`Khôi phục phiên bản ${aNo}`}
          onConfirm={() => void doRestore()}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Xuất bảng so sánh của một biểu ra tệp CSV mở được bằng Excel (BOM UTF-8 để giữ dấu). */
function exportCompare(sheet: SheetCompare, aNo: number, bNo: number, periodName: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Chỉ tiêu", `Phiên bản ${aNo}`, `Phiên bản ${bNo}`, "Chênh lệch"].map(escape).join(","),
    ...sheet.rows.map((r) =>
      [escape(r.label), String(r.a), String(r.b), String(r.b - r.a)].join(",")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SoSanh_Bieu-${sheet.short}_PB${aNo}-PB${bNo}_${periodName.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`Đã xuất bảng so sánh biểu ${sheet.short}.`);
}

// ---------------------------------------------------------------- Thành phần nhỏ

function SlotMarker({ slot }: { slot: "A" | "B" }) {
  return (
    <span
      aria-label={`Bản ${slot}`}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
        slot === "A"
          ? "border-info bg-info-subtle text-info-text"
          : "border-warning bg-warning-subtle text-warning-text"
      )}
    >
      {slot}
    </span>
  );
}

function VersionSelect({
  slot,
  value,
  versions,
  onChange,
}: {
  slot: "A" | "B";
  value: number;
  versions: VersionEntry[];
  onChange: (no: number) => void;
}) {
  const current = versions.find((v) => v.versionNo === value);
  return (
    <Select value={value > 0 ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label={`Chọn bản ${slot}`} className="h-10 w-70 data-[size=default]:h-10">
        <span className="flex min-w-0 items-center gap-2.5">
          <SlotMarker slot={slot} />
          <span className="text-foreground font-medium">Phiên bản {value > 0 ? value : "—"}</span>
          {current && (
            <span className="text-muted-foreground truncate text-xs">{formatDateTime(current.occurredAt)}</span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.versionNo} value={String(v.versionNo)}>
            Phiên bản {v.versionNo} · {formatDateTime(v.occurredAt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function VersionCard({
  version,
  slot,
  last,
  onPick,
}: {
  version: VersionEntry;
  slot: "A" | "B" | null;
  last: boolean;
  onPick: () => void;
}) {
  const tag =
    version.action === "PERIOD_SAVED"
      ? "Tất cả biểu"
      : version.sheets.length > 0
        ? `Biểu ${joinVi(version.sheets)} · ${version.rowCount} ô đổi`
        : `${version.rowCount} ô đổi`;
  return (
    <li className="flex gap-3">
      <div className="flex w-3 shrink-0 flex-col items-center pt-5">
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", slot === "A" ? "bg-primary" : "bg-muted-foreground/40")}
        />
        {!last && <span aria-hidden className="bg-border mt-1 w-0.5 flex-1" />}
      </div>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={slot === "A"}
        className={cn(
          "bg-card mb-3 flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border p-3.5 text-left shadow-e1",
          "transition-colors outline-none hover:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          slot === "A" && "border-primary ring-primary/20 ring-1"
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
            {initials(version.actor)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold">Phiên bản {version.versionNo}</span>
              {version.current && (
                <span className="bg-info-subtle text-info-text rounded-full px-2 text-[11px] leading-4.5 font-medium">
                  Hiện hành
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-xs">{formatDateTime(version.occurredAt)}</span>
          </div>
          {slot && <SlotMarker slot={slot} />}
        </div>
        <p className="text-sm">{version.note || version.actionLabel}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-neutral-subtle text-neutral-text rounded-md px-2 py-0.5 font-medium">{tag}</span>
          <span className="text-muted-foreground truncate">Người lưu: {version.actor}</span>
        </div>
      </button>
    </li>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  value,
  valueClass,
  caption,
  note,
  children,
}: {
  icon: LucideIcon;
  iconClass: string;
  value: string;
  valueClass?: string;
  caption: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-2.5 rounded-xl border px-4 py-3.5 shadow-e1">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconClass)}>
          <Icon aria-hidden className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className={cn("text-2xl leading-7 font-semibold tabular-nums", valueClass)}>{value}</span>
          <span className="text-muted-foreground truncate text-[13px] leading-4.5">{caption}</span>
        </div>
      </div>
      {children}
      <p className="text-muted-foreground truncate text-xs" title={note}>
        {note}
      </p>
    </div>
  );
}

function Meter({ value, max, barClass }: { value: number; max: number; barClass: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bg-accent h-1.5 overflow-hidden rounded-full">
      <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Cột nhỏ: mức thay đổi kinh phí của từng biểu; biểu đổi nhiều nhất tô đậm. */
function Sparkbars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const top = values.indexOf(Math.max(...values));
  return (
    <div aria-hidden className="flex h-5 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-2.5 rounded-xs", i === top && v > 0 ? "bg-success" : "bg-success-subtle")}
          style={{ height: `${Math.max(20, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function DeltaChip({ a, b }: { a: number; b: number }) {
  const up = b > a;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        up ? "bg-success-subtle text-success-text" : "bg-destructive-subtle text-destructive-text"
      )}
    >
      <Icon aria-hidden className="size-3" />
      {formatSigned(b - a)} ({formatSignedPercent(b - a, a)})
    </span>
  );
}

function DeltaBar({ a, b, maxAbs }: { a: number; b: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.max(6, (Math.abs(b - a) / maxAbs) * 100) : 0;
  return (
    <div aria-hidden className="bg-accent h-1.5 w-20 shrink-0 overflow-hidden rounded-full">
      <div className={cn("h-full rounded-full", b >= a ? "bg-success" : "bg-destructive")} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CompareTable({
  sheet,
  aNo,
  bNo,
  onlyChanged,
}: {
  sheet: SheetCompare;
  aNo: number;
  bNo: number;
  onlyChanged: boolean;
}) {
  const rows = onlyChanged ? sheet.rows.filter((r) => r.a !== r.b) : sheet.rows;
  const maxAbs = Math.max(...sheet.rows.map((r) => Math.abs(r.b - r.a)), Math.abs(sheet.totalB - sheet.totalA), 1);
  const totalChanged = sheet.totalA !== sheet.totalB;

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          <col className="w-44" />
          <col className="w-44" />
          <col className="w-64" />
        </colgroup>
        <thead>
          <tr className="bg-surface-subtle text-muted-foreground h-10 border-b text-xs">
            <th scope="col" className="px-4 text-left font-medium">
              Chỉ tiêu · kinh phí tính bằng {MONEY_UNIT}
            </th>
            <th scope="col" className="px-4 text-right font-medium">
              <span className="inline-flex items-center gap-2">
                <SlotMarker slot="A" />
                Phiên bản {aNo}
              </span>
            </th>
            <th scope="col" className="px-4 text-right font-medium">
              <span className="inline-flex items-center gap-2">
                <SlotMarker slot="B" />
                Phiên bản {bNo}
              </span>
            </th>
            <th scope="col" className="px-4 text-left font-medium">
              Chênh lệch
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                Biểu {sheet.short} không có ô nào thay đổi giữa hai phiên bản.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const changed = r.a !== r.b;
            const up = r.b > r.a;
            return (
              <tr key={r.key} className="h-10 border-b">
                <td
                  className={cn("truncate px-4", changed ? "text-foreground" : "text-muted-foreground")}
                  title={r.label}
                >
                  {r.label}
                </td>
                <td
                  className={cn(
                    "px-4 text-right tabular-nums",
                    changed ? "text-muted-foreground line-through" : "text-muted-foreground"
                  )}
                >
                  {r.aEmpty ? "—" : formatNumber(r.a)}
                </td>
                <td
                  className={cn(
                    "px-4 text-right tabular-nums",
                    changed && "font-semibold",
                    changed && (up ? "bg-success-subtle" : "bg-destructive-subtle"),
                    !changed && "text-muted-foreground"
                  )}
                >
                  {r.bEmpty ? "—" : formatNumber(r.b)}
                </td>
                <td className="px-4">
                  {changed ? (
                    <span className="flex items-center gap-3">
                      <DeltaBar a={r.a} b={r.b} maxAbs={maxAbs} />
                      <DeltaChip a={r.a} b={r.b} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Không đổi</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface-subtle h-11 border-t-2 font-semibold">
            <td className="px-4">Tổng kinh phí</td>
            <td className={cn("px-4 text-right tabular-nums", totalChanged && "text-muted-foreground line-through")}>
              {formatNumber(sheet.totalA)}
            </td>
            <td
              className={cn(
                "px-4 text-right tabular-nums",
                totalChanged && (sheet.totalB > sheet.totalA ? "bg-success-subtle" : "bg-destructive-subtle")
              )}
            >
              {formatNumber(sheet.totalB)}
            </td>
            <td className="px-4">
              {totalChanged ? (
                <span className="flex items-center gap-3">
                  <DeltaBar a={sheet.totalA} b={sheet.totalB} maxAbs={maxAbs} />
                  <DeltaChip a={sheet.totalA} b={sheet.totalB} />
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">Không đổi</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RestoreButton({ reason, onClick }: { reason: string | null; onClick: () => void }) {
  const button = (
    <Button type="button" variant="outline" disabled={Boolean(reason)} onClick={onClick}>
      <RotateCcw aria-hidden />
      Khôi phục phiên bản này
    </Button>
  );
  if (!reason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
