import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClockAlert,
  CopyPlus,
  Lock,
  RotateCcw,
  Search,
  SearchX,
  Undo2,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  formatNumber,
  HeaderActions,
  MasterDetailLayout,
  PeriodList,
  StatusBadge,
  useReportYear,
  YearSelect,
  type ActionItem,
  type PeriodItem,
  type PrimaryAction,
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

import { CopySetupDialog } from "./copy-setup-dialog";
import {
  FIXTURE_YEAR,
  INITIAL_ASSIGNMENTS,
  INITIAL_PERIODS,
  TEMPLATES,
  TODAY,
  UNITS,
} from "./fixtures";
import {
  ClosePeriodDialog,
  ReopenDialog,
  WithdrawDialog,
} from "./lifecycle-dialogs";
import {
  assignedUnitIds,
  codeOfKey,
  daysBetween,
  fmt,
  fmtRange,
  footerNote,
  lockCellTooltip,
  lockLine,
  lockSource,
  matrixMode,
  periodView,
  unitOfKey,
  UNIT_GROUP_LABEL,
  type Period,
  type UnitGroup,
} from "./model";
import {
  OpenPeriodDialog,
  OpenPreviewSheet,
  SupplementDialog,
  type PreviewRow,
  type SupplementLine,
} from "./open-period-dialogs";
import { SetupMatrix, type CellInfo } from "./setup-matrix";

const PAGE_SIZE = 10;
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

type DialogKind =
  | "open"
  | "preview"
  | "supplement"
  | "close"
  | "reopen"
  | "copy"
  | "withdraw";

/** Bỏ dấu để tìm "bien hoa" ra "Biên Hoà". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Màn tự chọn kỳ phù hợp: kỳ đang mở → kỳ đã thiết lập → kỳ còn thiết lập được. */
function pickDefault(periods: Period[]): string | null {
  const free = periods.filter((p) => !lockSource(p, periods));
  return (
    free.find((p) => p.status === "open")?.id ??
    free.find((p) => p.status === "ready")?.id ??
    free.find((p) => p.status === "draft")?.id ??
    periods[0]?.id ??
    null
  );
}

function toSets(src: Record<string, string[]>): Record<string, Set<string>> {
  return Object.fromEntries(
    Object.entries(src).map(([id, keys]) => [id, new Set(keys)])
  );
}

export function PeriodSetup() {
  const navigate = useNavigate();
  const { year } = useReportYear();

  const [periods, setPeriods] = useState<Period[]>(INITIAL_PERIODS);
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>(
    () => toSets(INITIAL_ASSIGNMENTS)
  );
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    pickDefault(INITIAL_PERIODS)
  );
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(() => new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"all" | UnitGroup>("all");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);

  const hasPending = pendingAdd.size + pendingRemove.size > 0;
  const yearPeriods = year === FIXTURE_YEAR ? periods : [];
  const selected = yearPeriods.find((p) => p.id === selectedId) ?? null;

  // Đổi năm thì bỏ các ô đang chờ của năm cũ.
  useEffect(() => {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
  }, [year]);

  // Đóng tab khi còn ô chưa lưu: trình duyệt hỏi lại.
  useEffect(() => {
    if (!hasPending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPending]);

  const periodItems: PeriodItem[] = useMemo(
    () =>
      yearPeriods.map((p) => {
        const v = periodView(p, periods);
        return {
          id: p.id,
          name: p.name,
          range: fmtRange(p.from, p.to),
          kind: p.kind,
          tone: v.tone,
          statusLabel: v.label,
        };
      }),
    [yearPeriods, periods]
  );

  const saved: ReadonlySet<string> = selected
    ? (assignments[selected.id] ?? EMPTY_SET)
    : EMPTY_SET;
  const lock = selected ? lockSource(selected, periods) : null;
  const mode = selected ? matrixMode(selected, lock) : "view";
  const assigned = useMemo(() => assignedUnitIds(new Set(saved)), [saved]);

  /* ---------- Lọc + phân trang đơn vị ---------- */

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return UNITS.filter(
      (u) => (group === "all" || u.group === group) && (!q || fold(u.name).includes(q))
    );
  }, [search, group]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageUnits = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  /* ---------- Ô ma trận ---------- */

  const getCell = (key: string): CellInfo => {
    const isSaved = saved.has(key);
    const add = pendingAdd.has(key);
    const rem = pendingRemove.has(key);
    const visual = rem ? "pendingRemove" : add ? "pendingAdd" : isSaved ? "saved" : "empty";
    const checked = add || (isSaved && !rem);
    if (mode === "edit") return { visual, checked, toggleable: true };
    if (mode === "addOnly")
      return {
        visual,
        checked,
        toggleable: !isSaved,
        reason: isSaved ? "Biểu đã phát cho đơn vị nên không bỏ được." : undefined,
      };
    if (mode === "locked" && lock)
      return { visual, checked, toggleable: false, reason: lockCellTooltip(lock) };
    return { visual, checked, toggleable: false };
  };

  const setCells = (keys: string[], target: boolean) => {
    const add = new Set(pendingAdd);
    const rem = new Set(pendingRemove);
    for (const key of keys) {
      if (!getCell(key).toggleable) continue;
      const isSaved = saved.has(key);
      if (target) {
        if (isSaved) rem.delete(key);
        else add.add(key);
      } else if (isSaved) rem.add(key);
      else add.delete(key);
    }
    setPendingAdd(add);
    setPendingRemove(rem);
  };

  const clearPending = () => {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
  };

  /* ---------- Chọn kỳ ---------- */

  const selectPeriod = (id: string) => {
    setSelectedId(id);
    setPage(0);
    clearPending();
  };
  const requestSelect = (id: string) => {
    if (id === selectedId) return;
    if (hasPending) setSwitchTo(id);
    else selectPeriod(id);
  };

  /* ---------- Thao tác ---------- */

  const updatePeriod = (id: string, patch: Partial<Period>) =>
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const formsByUnit = useMemo(() => {
    const m = new Map<string, number>();
    saved.forEach((k) => {
      const u = unitOfKey(k);
      m.set(u, (m.get(u) ?? 0) + 1);
    });
    return m;
  }, [saved]);

  const previewRows: PreviewRow[] = UNITS.filter((u) => formsByUnit.has(u.id)).map(
    (u) => ({ unit: u, forms: formsByUnit.get(u.id) ?? 0 })
  );

  const supplementLines: SupplementLine[] = useMemo(() => {
    const byUnit = new Map<string, Set<string>>();
    pendingAdd.forEach((k) => {
      const u = unitOfKey(k);
      const set = byUnit.get(u) ?? new Set<string>();
      set.add(codeOfKey(k));
      byUnit.set(u, set);
    });
    return UNITS.flatMap((u, index) => {
      const codes = byUnit.get(u.id);
      if (!codes) return [];
      const route: SupplementLine["route"] = !assigned.has(u.id)
        ? "fresh"
        : index % 4 === 0
          ? "separate" // dữ liệu mẫu: cứ 4 đơn vị có 1 đơn vị đã nộp phiếu
          : "append";
      return [
        {
          unit: u,
          codes: TEMPLATES.map((t) => t.code).filter((c) => codes.has(c)),
          route,
        },
      ];
    });
  }, [pendingAdd, assigned]);

  const save = () => {
    if (!selected) return;
    const next = new Set(saved);
    pendingRemove.forEach((k) => next.delete(k));
    pendingAdd.forEach((k) => next.add(k));
    setAssignments((a) => ({ ...a, [selected.id]: next }));
    if (selected.status === "draft" && next.size > 0)
      updatePeriod(selected.id, { status: "ready" });
    else if (selected.status === "ready" && next.size === 0)
      updatePeriod(selected.id, { status: "draft" });
    const a = pendingAdd.size;
    const r = pendingRemove.size;
    const what =
      a && r ? `Đã lưu ${a} ô, gỡ ${r} ô` : a ? `Đã lưu ${a} ô` : `Đã gỡ ${r} ô`;
    toast.success(`${what} cho kỳ ${selected.name}.`);
    clearPending();
  };

  const discard = () => {
    clearPending();
    toast.info("Đã bỏ các thay đổi chưa lưu.");
  };

  const confirmOpen = () => {
    if (!selected) return;
    const units = previewRows.length;
    // Ngày nhận số liệu đã tới → Đang mở ngay; còn ở tương lai → Chưa mở (tự mở đúng ngày).
    const status: Period["status"] = selected.openFrom <= TODAY ? "open" : "published";
    updatePeriod(selected.id, {
      status,
      progress: { approved: 0, pendingReview: 0, notSubmitted: units },
    });
    setDialog(null);
    toast.success(
      status === "open"
        ? `${selected.name}: đã mở, tạo ${formatNumber(units)} phiếu.`
        : `${selected.name}: đã mở đợt, tạo ${formatNumber(units)} phiếu. Đơn vị nhập được từ ngày ${fmt(selected.openFrom)}.`
    );
  };

  const confirmSupplement = () => {
    if (!selected) return;
    const next = new Set(saved);
    pendingAdd.forEach((k) => next.add(k));
    setAssignments((a) => ({ ...a, [selected.id]: next }));
    const newTickets = supplementLines.filter((l) => l.route !== "append").length;
    const progress = selected.progress ?? { approved: 0, pendingReview: 0, notSubmitted: 0 };
    updatePeriod(selected.id, {
      progress: { ...progress, notSubmitted: progress.notSubmitted + newTickets },
    });
    setDialog(null);
    clearPending();
    toast.success(`Đã mở đợt bổ sung cho kỳ ${selected.name}.`);
  };

  const confirmClose = () => {
    if (!selected) return;
    updatePeriod(selected.id, { status: "closed", closedAt: TODAY });
    setDialog(null);
    toast.success(`Đã chốt kỳ ${selected.name}.`);
  };

  const confirmReopen = (deadline: string) => {
    if (!selected) return;
    updatePeriod(selected.id, { status: "open", deadline });
    setDialog(null);
    toast.success(`Đã gia hạn kỳ ${selected.name} đến ${fmt(deadline)} và mở lại.`);
  };

  const confirmWithdraw = () => {
    if (!selected) return;
    updatePeriod(selected.id, {
      status: saved.size > 0 ? "ready" : "draft",
      progress: undefined,
      closedAt: undefined,
    });
    setDialog(null);
    toast.success(`Đã thu hồi kỳ ${selected.name}. Kỳ quay về bước thiết lập.`);
  };

  const confirmCopy = (ids: string[]) => {
    let added = 0;
    const next = { ...assignments };
    for (const id of ids) {
      const target = new Set(next[id] ?? []);
      saved.forEach((k) => {
        if (!target.has(k)) {
          target.add(k);
          added += 1;
        }
      });
      next[id] = target;
    }
    setAssignments(next);
    setPeriods((ps) =>
      ps.map((p): Period =>
        ids.includes(p.id) && p.status === "draft" && (next[p.id]?.size ?? 0) > 0
          ? { ...p, status: "ready" }
          : p
      )
    );
    setDialog(null);
    toast.success(`Đã áp dụng ${formatNumber(added)} ô cho ${ids.length} kỳ.`);
  };

  /* ---------- Nút chính + ⋯ theo trạng thái (nguyen-tac §4, Ví dụ 1) ---------- */

  const plan = (): { primary?: PrimaryAction; items: ActionItem[] } | null => {
    if (!selected || lock) return null; // kỳ khoá cả kỳ: không nút chính, không ⋯
    const hasSaved = saved.size > 0;
    const copy = (reason?: string): ActionItem => ({
      key: "copy",
      label: "Áp dụng cho kỳ khác…",
      icon: CopyPlus,
      onSelect: () => setDialog("copy"),
      disabled: !!reason,
      reason,
    });
    const copyItem = () =>
      copy(hasSaved ? undefined : "Kỳ này chưa có thiết lập nào để áp dụng");
    const withdraw = (reason?: string): ActionItem => ({
      key: "withdraw",
      label: "Thu hồi & thiết lập lại",
      icon: RotateCcw,
      destructive: true,
      separatorBefore: true,
      onSelect: () => setDialog("withdraw"),
      disabled: !!reason,
      reason,
    });

    if (hasPending) {
      const items: ActionItem[] = [
        copy("Lưu thay đổi trước đã"),
        { key: "discard", label: "Bỏ thay đổi chưa lưu", icon: Undo2, onSelect: discard },
      ];
      return selected.status === "open"
        ? { primary: { label: "Mở đợt bổ sung", onClick: () => setDialog("supplement") }, items }
        : { primary: { label: "Lưu thay đổi", onClick: save }, items };
    }

    switch (selected.status) {
      case "draft":
        return {
          primary: {
            label: "Mở đợt báo cáo",
            disabled: true,
            reason: "Hãy gán biểu mẫu cho ít nhất một đơn vị rồi mới mở đợt được.",
          },
          items: [copyItem()],
        };
      case "ready":
        return {
          primary: { label: "Mở đợt báo cáo", onClick: () => setDialog("open") },
          items: [copyItem(), withdraw("Chỉ dùng được sau khi đã mở đợt")],
        };
      case "published":
        return {
          primary: {
            label: `Tự mở ngày ${fmt(selected.openFrom)}`,
            disabled: true,
            reason: `Đơn vị nhập được từ ngày ${fmt(selected.openFrom)}, kỳ tự mở vào ngày đó.`,
          },
          items: [copyItem(), withdraw()],
        };
      case "open":
        return {
          primary: { label: "Chốt đợt báo cáo", onClick: () => setDialog("close") },
          items: [copyItem(), withdraw()],
        };
      case "overdue":
        return {
          primary: { label: "Gia hạn & mở lại", onClick: () => setDialog("reopen") },
          items: [
            {
              key: "close",
              label: "Chốt đợt báo cáo",
              icon: Lock,
              onSelect: () => setDialog("close"),
            },
            copyItem(),
          ],
        };
      case "closed":
        return { items: [copyItem()] };
    }
  };

  const actions = plan();

  /* ---------- Dòng phụ dưới tên kỳ ---------- */

  const subtitle = (p: Period): ReactNode => {
    if (lock) return lockLine(lock);
    const pendingParts = [
      pendingAdd.size > 0 ? `${pendingAdd.size} ô chờ lưu` : null,
      pendingRemove.size > 0 ? `${pendingRemove.size} ô chờ gỡ` : null,
    ].filter(Boolean);
    const pendingText = pendingParts.length ? ` · ${pendingParts.join(", ")}` : "";
    const deadline = `Hạn nộp ${fmt(p.deadline)}`;
    const total = assigned.size;
    switch (p.status) {
      case "draft":
        return hasPending
          ? `${deadline}${pendingText}`
          : `${deadline} · Hãy gán biểu mẫu cho ít nhất một đơn vị rồi mới mở đợt được.`;
      case "ready":
        return `${deadline} · ${total}/${UNITS.length} đơn vị đã thiết lập${pendingText}`;
      case "published":
        return (
          <>
            <CalendarClock className="size-4 shrink-0" />
            Đơn vị nhập được từ ngày {fmt(p.openFrom)}
          </>
        );
      case "open": {
        const left = daysBetween(TODAY, p.deadline);
        const pr = p.progress ?? { approved: 0, pendingReview: 0, notSubmitted: total };
        const submitted = pr.approved + pr.pendingReview;
        const leftText = left > 0 ? `còn ${left} ngày` : "hôm nay là hạn cuối";
        return `${deadline} · ${leftText} · ${submitted}/${total} đơn vị đã nộp${pendingText}`;
      }
      case "overdue": {
        const pr = p.progress ?? { approved: 0, pendingReview: 0, notSubmitted: total };
        return (
          <>
            <ClockAlert className="size-4 shrink-0 text-destructive-text" />
            Hết hạn {fmt(p.deadline)} · {pr.notSubmitted}/{total} đơn vị chưa nộp
          </>
        );
      }
      case "closed":
        return (
          <>
            <Lock className="size-4 shrink-0" />
            Sở đã chốt số liệu ngày {p.closedAt ? fmt(p.closedAt) : fmt(p.deadline)} · chỉ xem
          </>
        );
    }
  };

  /* ---------- Hiển thị ---------- */

  const page_ = (
    <AsxhPage
      title="Thiết lập & điều hành"
      description="Chọn kỳ báo cáo, tích biểu cho từng đơn vị rồi mở đợt để các đơn vị bắt đầu nhập số liệu."
      actions={<YearSelect />}
      fill
    >
      {yearPeriods.length === 0 ? (
        <EmptyState
          variant="page"
          icon={CalendarX2}
          title={`Năm ${year} chưa có kỳ báo cáo`}
          description="Hãy tạo lịch báo cáo của năm này ở màn Lịch và kỳ báo cáo, các kỳ sẽ hiện ở đây."
          action={
            <Button variant="outline" onClick={() => navigate("/report-calendar")}>
              Mở Lịch và kỳ báo cáo
            </Button>
          }
        />
      ) : (
        <MasterDetailLayout
          aside={
            <PeriodList
              periods={periodItems}
              selectedId={selected?.id ?? null}
              onSelect={requestSelect}
            />
          }
        >
          {selected ? (
            <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-e1">
              {/* Đầu panel: tên kỳ + badge + dòng phụ */}
              <div className="flex flex-col gap-1.5 px-5 pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl leading-7 font-bold text-foreground">
                    {selected.name}
                  </h2>
                  <StatusBadge tone={periodView(selected, periods).tone}>
                    {periodView(selected, periods).label}
                  </StatusBadge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {subtitle(selected)}
                </p>
              </div>

              {/* Thanh công cụ */}
              <div className="flex flex-wrap items-center gap-3 border-y px-5 py-3">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Tìm theo tên đơn vị"
                    aria-label="Tìm theo tên đơn vị"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={group}
                  onValueChange={(v) => {
                    setGroup(v as "all" | UnitGroup);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Lọc theo khối">
                    <SelectValue>
                      Khối: {group === "all" ? "Tất cả" : UNIT_GROUP_LABEL[group].replace("Khối ", "")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="huyen">{UNIT_GROUP_LABEL.huyen}</SelectItem>
                    <SelectItem value="xa">{UNIT_GROUP_LABEL.xa}</SelectItem>
                  </SelectContent>
                </Select>
                <Legend />
                <div className="ms-auto flex items-center">
                  {actions && <HeaderActions primary={actions.primary} items={actions.items} />}
                </div>
              </div>

              {/* Thân ma trận */}
              {filtered.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                  <EmptyState
                    variant="inline"
                    icon={SearchX}
                    title="Không có đơn vị nào khớp"
                    description="Thử tìm bằng tên khác hoặc chọn lại ô Khối."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setGroup("all");
                        }}
                      >
                        Xoá lọc
                      </Button>
                    }
                  />
                </div>
              ) : (
                <SetupMatrix
                  units={pageUnits}
                  scopeUnits={filtered}
                  templates={TEMPLATES}
                  mode={mode}
                  getCell={getCell}
                  onSet={setCells}
                />
              )}

              {/* Chân: ghi chú chỉ xem + phân trang */}
              <MatrixFooter
                note={footerNote(selected, mode)}
                first={filtered.length === 0 ? 0 : current * PAGE_SIZE + 1}
                last={current * PAGE_SIZE + pageUnits.length}
                total={filtered.length}
                page={current}
                pages={pages}
                onPage={setPage}
              />
            </section>
          ) : (
            <section className="flex h-full min-h-0 flex-col rounded-lg border bg-card shadow-e1">
              <EmptyState
                variant="panel"
                icon={CalendarClock}
                title="Chọn một kỳ ở cột bên trái"
                description="Ma trận đơn vị và biểu mẫu của kỳ sẽ hiện ở đây."
              />
            </section>
          )}
        </MasterDetailLayout>
      )}
    </AsxhPage>
  );

  const switchTarget = switchTo ? periods.find((p) => p.id === switchTo) : null;

  return (
    <>
      {page_}

      {selected && (
        <>
          <OpenPeriodDialog
            open={dialog === "open"}
            onOpenChange={(o) => setDialog(o ? "open" : null)}
            period={selected}
            rows={previewRows}
            onShowPreview={() => setDialog("preview")}
            onConfirm={confirmOpen}
          />
          <OpenPreviewSheet
            open={dialog === "preview"}
            onOpenChange={(o) => setDialog(o ? "preview" : null)}
            period={selected}
            rows={previewRows}
            onBack={() => setDialog("open")}
            onConfirm={confirmOpen}
          />
          <SupplementDialog
            open={dialog === "supplement"}
            onOpenChange={(o) => setDialog(o ? "supplement" : null)}
            period={selected}
            lines={supplementLines}
            daysLeft={daysBetween(TODAY, selected.deadline)}
            onConfirm={confirmSupplement}
          />
          <ClosePeriodDialog
            open={dialog === "close"}
            onOpenChange={(o) => setDialog(o ? "close" : null)}
            period={selected}
            onConfirm={confirmClose}
          />
          <ReopenDialog
            open={dialog === "reopen"}
            onOpenChange={(o) => setDialog(o ? "reopen" : null)}
            period={selected}
            today={TODAY}
            onConfirm={confirmReopen}
          />
          <WithdrawDialog
            open={dialog === "withdraw"}
            onOpenChange={(o) => setDialog(o ? "withdraw" : null)}
            period={selected}
            ticketCount={assigned.size}
            onConfirm={confirmWithdraw}
          />
          <CopySetupDialog
            open={dialog === "copy"}
            onOpenChange={(o) => setDialog(o ? "copy" : null)}
            source={selected}
            periods={yearPeriods}
            onConfirm={confirmCopy}
          />
        </>
      )}

      <ConfirmDialog
        open={switchTo !== null}
        onOpenChange={(o) => {
          if (!o) setSwitchTo(null);
        }}
        title="Bỏ thay đổi chưa lưu?"
        description={
          <>
            Kỳ {selected?.name} còn{" "}
            {[
              pendingAdd.size > 0 ? `${pendingAdd.size} ô chờ lưu` : null,
              pendingRemove.size > 0 ? `${pendingRemove.size} ô chờ gỡ` : null,
            ]
              .filter(Boolean)
              .join(" và ")}
            . Nếu chuyển sang {switchTarget?.name ?? "kỳ khác"}, các thay đổi này sẽ mất.
          </>
        }
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        destructive
        onConfirm={() => {
          if (switchTo) selectPeriod(switchTo);
          setSwitchTo(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3.5 rounded-[3px] bg-primary" />
        Đã lưu
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3.5 rounded-[3px] bg-warning" />
        Chờ lưu
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-3.5 rounded-[3px] border border-destructive bg-destructive-subtle"
        />
        Chờ gỡ
      </span>
    </div>
  );
}

function MatrixFooter({
  note,
  first,
  last,
  total,
  page,
  pages,
  onPage,
}: {
  note: string | null;
  first: number;
  last: number;
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-2.5">
      {note && (
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          <span className="truncate" title={note}>
            {note}
          </span>
        </p>
      )}
      <div className="ms-auto flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Hiển thị {first}–{last} trong {total} đơn vị
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang đầu"
            disabled={page === 0}
            onClick={() => onPage(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang trước"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="px-2 text-sm font-medium whitespace-nowrap">
            Trang {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang sau"
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang cuối"
            disabled={page >= pages - 1}
            onClick={() => onPage(pages - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
