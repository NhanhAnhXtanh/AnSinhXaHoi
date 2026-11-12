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
  FileX2,
  Lock,
  RotateCcw,
  Search,
  SearchX,
  TriangleAlert,
  Undo2,
  UsersRound,
} from "lucide-react";
import { useCan, useWarnAboutChange } from "@refinedev/core";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  formatNumber,
  HeaderActions,
  LoadingState,
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
import { ClosePeriodDialog, ReopenDialog, WithdrawDialog } from "./lifecycle-dialogs";
import {
  assignedUnitIds,
  daysBetween,
  errorText,
  fmt,
  fmtRange,
  fold,
  footerNote,
  lockLine,
  lockShortReason,
  matrixMode,
  periodView,
  supplementRouteOf,
  templateOfKey,
  todayIso,
  unitOfKey,
  UNIT_GROUP_LABEL,
  type Period,
  type PeriodLock,
  type Template,
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
import {
  useMatrixAxes,
  useSelectedPeriod,
  useSetupActions,
  useYearPeriods,
  type CellRef,
} from "./use-period-setup";

/** Số đơn vị mỗi trang của ma trận; 0 = tất cả trên một trang. */
const PAGE_SIZES = [10, 20, 50, 0] as const;
const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const FALLBACK_ERROR = "Chưa thực hiện được. Bạn thử lại sau ít phút.";

type DialogKind = "open" | "preview" | "supplement" | "close" | "reopen" | "copy" | "withdraw";

/** Màn tự chọn kỳ phù hợp: kỳ đang mở → kỳ đã thiết lập → kỳ còn thiết lập được. */
function pickDefault(periods: Period[], locks: ReadonlyMap<string, PeriodLock>): string | null {
  const free = periods.filter((p) => !locks.has(p.id));
  return (
    free.find((p) => p.status === "open")?.id ??
    free.find((p) => p.status === "ready")?.id ??
    free.find((p) => p.status === "draft")?.id ??
    periods[0]?.id ??
    null
  );
}

function toRefs(keys: Iterable<string>): CellRef[] {
  return [...keys].map((k) => ({ unitId: Number(unitOfKey(k)), templateId: Number(templateOfKey(k)) }));
}

export function PeriodSetup() {
  const navigate = useNavigate();
  // `?ky={id}`: màn khác (Lịch sử mở đợt) mở sẵn đúng kỳ này thay vì kỳ mặc định.
  const [searchParams] = useSearchParams();
  const wantedPeriod = searchParams.get("ky");
  const { year } = useReportYear();
  const today = useMemo(() => todayIso(), []);

  /* ---------- Dữ liệu ---------- */

  const yearData = useYearPeriods(year);
  const { periods, locks } = yearData;
  const axes = useMatrixAxes();
  const actions = useSetupActions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = periods.find((p) => p.id === selectedId) ?? null;
  const current = useSelectedPeriod(selected);
  const saved = selected ? current.saved : EMPTY_SET;
  const issued = current.issued;
  const progress = current.progress;

  const [pendingAdd, setPendingAdd] = useState<Set<string>>(() => new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"all" | UnitGroup>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);

  const hasPending = pendingAdd.size + pendingRemove.size > 0;

  // Đổi năm thì bỏ các ô đang chờ và để màn tự chọn lại kỳ của năm mới.
  useEffect(() => {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setSelectedId(null);
    setPage(0);
  }, [year]);

  // Kỳ đang chọn không còn trong danh sách (đổi năm, kỳ bị xoá) → tự chọn kỳ phù hợp.
  useEffect(() => {
    if (periods.length === 0) return;
    if (selectedId && periods.some((p) => p.id === selectedId)) return;
    setSelectedId(
      wantedPeriod && periods.some((p) => p.id === wantedPeriod) ? wantedPeriod : pickDefault(periods, locks)
    );
  }, [periods, locks, selectedId, wantedPeriod]);

  // Rời màn (bấm mục menu khác…) hoặc đổi năm khi còn ô chưa lưu: hộp hỏi chung của ứng
  // dụng (UnsavedChangesGuard) — trước đây các ô chờ lưu mất mà không hỏi.
  const { setWarnWhen } = useWarnAboutChange();
  useEffect(() => {
    setWarnWhen(hasPending);
    return () => setWarnWhen(false);
  }, [hasPending, setWarnWhen]);

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
      periods.map((p) => {
        const v = periodView(p, locks.get(p.id) ?? null);
        return {
          id: p.id,
          name: p.name,
          range: fmtRange(p.from, p.to),
          kind: p.kind,
          tone: v.tone,
          statusLabel: v.label,
        };
      }),
    [periods, locks]
  );

  const lock = selected ? (locks.get(selected.id) ?? null) : null;
  // Quyền ghi (máy chủ kiểm lại): tích ma trận / áp dụng cho kỳ khác cần
  // `period_assignments:write`; mở đợt, chốt, gia hạn, thu hồi cần `publications:write`.
  // Tài khoản chỉ có quyền xem (vd. cán bộ duyệt phiếu) trước đây vẫn thấy đủ nút rồi gặp 403.
  const { data: canEditData } = useCan({ resource: "period_assignments", action: "edit" });
  const { data: canOperateData } = useCan({ resource: "publications", action: "create" });
  const canEditMatrix = canEditData?.can === true;
  const canOperate = canOperateData?.can === true;
  const baseMode = selected ? matrixMode(selected, lock) : "view";
  const mode = canEditMatrix || baseMode === "locked" ? baseMode : "view";
  const assigned = useMemo(() => assignedUnitIds(saved), [saved]);

  /** Cột ma trận: biểu đang ban hành + biểu đã gán cho kỳ mà nay đã ngừng ban hành. */
  const templates: Template[] = useMemo(() => {
    const ids = new Set(axes.templates.map((t) => t.id));
    return [...axes.templates, ...current.assignedTemplates.filter((t) => !ids.has(t.id))];
  }, [axes.templates, current.assignedTemplates]);

  const unitsById = useMemo(() => new Map(axes.units.map((u) => [u.id, u])), [axes.units]);

  /* ---------- Lọc + phân trang đơn vị ---------- */

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return axes.units.filter(
      (u) => (group === "all" || u.group === group) && (!q || fold(u.name).includes(q))
    );
  }, [axes.units, search, group]);
  const perPage = pageSize === 0 ? Math.max(1, filtered.length) : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pages - 1);
  const pageUnits = filtered.slice(currentPage * perPage, (currentPage + 1) * perPage);
  const groupsPresent = useMemo(
    () =>
      (Object.keys(UNIT_GROUP_LABEL) as UnitGroup[]).filter((g) =>
        axes.units.some((u) => u.group === g)
      ),
    [axes.units]
  );

  /* ---------- Ô ma trận ---------- */

  const getCell = (key: string): CellInfo => {
    const isSaved = saved.has(key);
    const add = pendingAdd.has(key);
    const rem = pendingRemove.has(key);
    const visual = rem ? "pendingRemove" : add ? "pendingAdd" : isSaved ? "saved" : "empty";
    const checked = add || (isSaved && !rem);
    if (mode === "locked" && lock)
      return { visual, checked, toggleable: false, reason: lockShortReason(lock) };
    // Ô đã phát phiếu cho đơn vị: không bỏ tích được nữa (UC-22 5a).
    if (isSaved && issued.has(key))
      return {
        visual,
        checked,
        toggleable: false,
        reason: "Đơn vị đã có phiếu cho biểu này nên không bỏ được.",
      };
    if (mode === "edit") return { visual, checked, toggleable: true };
    if (mode === "addOnly")
      return {
        visual,
        checked,
        toggleable: !isSaved,
        reason: isSaved ? "Biểu đã phát cho đơn vị nên không bỏ được." : undefined,
      };
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

  /* ---------- Số liệu cho hộp thoại ---------- */

  const formsByUnit = useMemo(() => {
    const m = new Map<string, number>();
    saved.forEach((k) => {
      const u = unitOfKey(k);
      m.set(u, (m.get(u) ?? 0) + 1);
    });
    return m;
  }, [saved]);

  const previewRows: PreviewRow[] = useMemo(
    () =>
      [...formsByUnit.entries()].flatMap(([unitId, forms]) => {
        const unit = unitsById.get(unitId);
        return unit ? [{ unit, forms }] : [];
      }),
    [formsByUnit, unitsById]
  );

  const supplementLines: SupplementLine[] = useMemo(() => {
    const byUnit = new Map<string, Set<string>>();
    pendingAdd.forEach((k) => {
      const u = unitOfKey(k);
      const set = byUnit.get(u) ?? new Set<string>();
      set.add(templateOfKey(k));
      byUnit.set(u, set);
    });
    return axes.units.flatMap((u) => {
      const ids = byUnit.get(u.id);
      if (!ids) return [];
      return [
        {
          unit: u,
          codes: templates.filter((t) => ids.has(t.id)).map((t) => t.code),
          route: supplementRouteOf(u.id, current.reports),
        },
      ];
    });
  }, [pendingAdd, axes.units, templates, current.reports]);

  /* ---------- Thao tác (gọi máy chủ) ---------- */

  const reloadAll = () => {
    yearData.refetch();
    current.refetch();
  };

  /** Chạy một thao tác ghi: toast câu báo của máy chủ, tải lại; lỗi → toast câu tiếng Việt. */
  const run = async (
    task: () => Promise<string | null>,
    fallbackOk: string,
    after?: () => void
  ) => {
    try {
      const message = await task();
      toast.success(message || fallbackOk);
      setDialog(null);
      after?.();
    } catch (error) {
      toast.error(errorText(error, FALLBACK_ERROR));
    } finally {
      reloadAll();
    }
  };

  const save = () => {
    if (!selected) return;
    void run(
      () => actions.saveMatrix(selected.id, toRefs(pendingAdd), toRefs(pendingRemove)),
      `Đã lưu thay đổi cho kỳ ${selected.name}.`,
      clearPending
    );
  };

  const discard = () => {
    clearPending();
    toast.info("Đã bỏ các thay đổi chưa lưu.");
  };

  const confirmOpen = () => {
    if (!selected) return;
    void run(() => actions.publish(selected.id), `${selected.name}: đã mở đợt.`);
  };

  // Kỳ đang mở: lưu ô mới trên ma trận = phát ngay đợt bổ sung (cùng một giao dịch ở máy chủ).
  const confirmSupplement = () => {
    if (!selected) return;
    void run(
      () => actions.saveMatrix(selected.id, toRefs(pendingAdd), []),
      `Đã mở đợt bổ sung cho kỳ ${selected.name}.`,
      clearPending
    );
  };

  const confirmClose = () => {
    if (!selected) return;
    void run(() => actions.close(selected.id), `Đã chốt kỳ ${selected.name}.`);
  };

  const confirmReopen = (deadline: string, reason: string) => {
    if (!selected) return;
    void run(
      () => actions.extend(selected.id, deadline, reason),
      `Đã gia hạn kỳ ${selected.name} đến ${fmt(deadline)} và mở lại.`
    );
  };

  const confirmWithdraw = (confirmName: string) => {
    if (!selected) return;
    void run(
      () => actions.withdraw(selected.id, confirmName),
      `Đã thu hồi kỳ ${selected.name}. Kỳ quay về bước thiết lập.`
    );
  };

  const confirmCopy = (ids: string[]) => {
    if (!selected) return;
    void run(
      () => actions.copy(selected.id, ids),
      `Đã áp dụng thiết lập cho ${formatNumber(ids.length)} kỳ.`
    );
  };

  /* ---------- Nút chính + ⋯ theo trạng thái (nguyen-tac §4, Ví dụ 1) ---------- */

  const plan = (): { primary?: PrimaryAction; items: ActionItem[] } | null => {
    if (!selected || lock) return null; // kỳ khoá cả kỳ: không nút chính, không ⋯
    const busy = actions.pending;
    const hasSaved = saved.size > 0;
    const copy = (reason?: string): ActionItem => ({
      key: "copy",
      label: "Áp dụng cho kỳ khác…",
      icon: CopyPlus,
      onSelect: () => setDialog("copy"),
      disabled: !!reason,
      reason,
    });
    const copyItem = () => copy(hasSaved ? undefined : "Kỳ này chưa có thiết lập nào để áp dụng");
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
        ? {
            primary: {
              label: "Mở đợt bổ sung",
              onClick: () => setDialog("supplement"),
              loading: busy,
              disabled: busy,
            },
            items,
          }
        : {
            primary: { label: "Lưu thay đổi", onClick: save, loading: busy, disabled: busy },
            items,
          };
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
          primary: {
            label: "Mở đợt báo cáo",
            onClick: () => setDialog("open"),
            disabled: busy,
            loading: busy,
          },
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
          primary: {
            label: "Chốt đợt báo cáo",
            onClick: () => setDialog("close"),
            disabled: busy,
            loading: busy,
          },
          items: [copyItem(), withdraw()],
        };
      case "overdue":
        return {
          primary: {
            label: "Gia hạn & mở lại",
            onClick: () => setDialog("reopen"),
            disabled: busy,
            loading: busy,
          },
          items: [
            { key: "close", label: "Chốt đợt báo cáo", icon: Lock, onSelect: () => setDialog("close") },
            copyItem(),
            withdraw(),
          ],
        };
      case "closed":
      case "locked":
        return { items: [copyItem()] };
      case "cancelled":
        return null;
    }
  };

  const rawActions = plan();
  // Bỏ nút / mục mà tài khoản không có quyền: nút chính khi còn ô chờ lưu là Lưu / Mở đợt bổ
  // sung (quyền ma trận), còn lại là thao tác điều hành kỳ.
  const headerActions = rawActions && {
    primary: (hasPending ? canEditMatrix : canOperate) ? rawActions.primary : undefined,
    items: rawActions.items.filter((i) =>
      i.key === "copy" || i.key === "discard" ? canEditMatrix : canOperate
    ),
  };

  /* ---------- Dòng phụ dưới tên kỳ ---------- */

  const subtitle = (p: Period): ReactNode => {
    if (lock) return lockLine(lock);
    const pendingParts = [
      pendingAdd.size > 0 ? `${pendingAdd.size} ô chờ lưu` : null,
      pendingRemove.size > 0 ? `${pendingRemove.size} ô chờ gỡ` : null,
    ].filter(Boolean);
    const pendingText = pendingParts.length ? ` · ${pendingParts.join(", ")}` : "";
    const deadline = p.deadline ? `Hạn nộp ${fmt(p.deadline)}` : "Chưa đặt hạn nộp";
    const total = assigned.size;
    switch (p.status) {
      case "draft":
        return hasPending
          ? `${deadline}${pendingText}`
          : `${deadline} · Hãy gán biểu mẫu cho ít nhất một đơn vị rồi mới mở đợt được.`;
      case "ready":
        return `${deadline} · ${formatNumber(total)}/${formatNumber(axes.units.length)} đơn vị đã thiết lập${pendingText}`;
      case "published":
        return (
          <>
            <CalendarClock className="size-4 shrink-0" />
            Đơn vị nhập được từ ngày {fmt(p.openFrom)}
          </>
        );
      case "open": {
        const left = p.deadline ? daysBetween(today, p.deadline) : null;
        const leftText =
          left === null ? null : left > 0 ? `còn ${left} ngày` : left === 0 ? "hôm nay là hạn cuối" : "đã quá hạn";
        const units = progress.unitsWithReports || total;
        return [
          deadline,
          leftText,
          `${formatNumber(progress.unitsSubmitted)}/${formatNumber(units)} đơn vị đã nộp${pendingText}`,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "overdue": {
        const units = progress.unitsWithReports || total;
        return (
          <>
            <ClockAlert className="size-4 shrink-0 text-destructive-text" />
            Hết hạn {fmt(p.deadline)} · {formatNumber(units - progress.unitsSubmitted)}/
            {formatNumber(units)} đơn vị chưa nộp
          </>
        );
      }
      case "closed":
      case "locked":
        return (
          <>
            <Lock className="size-4 shrink-0" />
            Sở đã chốt số liệu{p.updatedAt ? ` ngày ${fmt(p.updatedAt)}` : ""} · chỉ xem
          </>
        );
      case "cancelled":
        return "Kỳ này đã huỷ · chỉ xem";
    }
  };

  /* ---------- Thân panel phải ---------- */

  const matrixBody = (): ReactNode => {
    if (axes.isLoading || current.isLoading)
      return <LoadingState label="Đang tải đơn vị và biểu mẫu…" />;
    if (axes.isError || current.isError)
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Không tải được ma trận thiết lập"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                axes.refetch();
                current.refetch();
              }}
            >
              Tải lại
            </Button>
          }
        />
      );
    if (axes.units.length === 0)
      return (
        <EmptyState
          icon={UsersRound}
          title="Chưa có đơn vị nào nhận báo cáo"
          description="Hãy thêm đơn vị và bật nhận báo cáo ở màn Danh sách đơn vị, đơn vị sẽ hiện ở đây."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/report-units")}>
              Mở Danh sách đơn vị
            </Button>
          }
        />
      );
    if (templates.length === 0)
      return (
        <EmptyState
          icon={FileX2}
          title="Chưa có biểu mẫu nào đang ban hành"
          description="Hãy ban hành ít nhất một biểu ở màn Bộ biểu mẫu rồi quay lại thiết lập."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/templates")}>
              Mở Bộ biểu mẫu
            </Button>
          }
        />
      );
    if (filtered.length === 0)
      return (
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
      );
    return (
      <SetupMatrix
        units={pageUnits}
        scopeUnits={filtered}
        templates={templates}
        mode={mode}
        getCell={getCell}
        onSet={setCells}
      />
    );
  };

  /* ---------- Hiển thị ---------- */

  const pageBody = (): ReactNode => {
    if (yearData.isLoading) return <LoadingState variant="page" label="Đang tải các kỳ báo cáo…" />;
    if (yearData.isError)
      return (
        <EmptyState
          variant="page"
          icon={TriangleAlert}
          title="Không tải được danh sách kỳ báo cáo"
          description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
          action={
            <Button variant="outline" onClick={yearData.refetch}>
              Tải lại
            </Button>
          }
        />
      );
    if (periods.length === 0)
      return (
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
      );
    return (
      <MasterDetailLayout
        aside={
          <PeriodList periods={periodItems} selectedId={selected?.id ?? null} onSelect={requestSelect} />
        }
      >
        {selected ? (
          <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-e1">
            {/* Đầu panel: tên kỳ + badge + dòng phụ */}
            <div className="flex flex-col gap-1.5 px-5 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl leading-7 font-bold text-foreground">{selected.name}</h2>
                <StatusBadge tone={periodView(selected, lock).tone}>
                  {periodView(selected, lock).label}
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
                  {groupsPresent.map((g) => (
                    <SelectItem key={g} value={g}>
                      {UNIT_GROUP_LABEL[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Legend />
              <div className="ms-auto flex items-center">
                {headerActions && (
                  <HeaderActions primary={headerActions.primary} items={headerActions.items} />
                )}
              </div>
            </div>

            {/* Thân ma trận */}
            {matrixBody()}

            {/* Chân: ghi chú chỉ xem + phân trang */}
            <MatrixFooter
              note={
                !canEditMatrix && baseMode !== mode
                  ? "Tài khoản của bạn chỉ được xem thiết lập, không tích hoặc bỏ biểu mẫu được."
                  : footerNote(selected, mode)
              }
              first={filtered.length === 0 ? 0 : currentPage * perPage + 1}
              last={currentPage * perPage + pageUnits.length}
              total={filtered.length}
              page={currentPage}
              pages={pages}
              onPage={setPage}
              pageSize={pageSize}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(0);
              }}
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
    );
  };

  const switchTarget = switchTo ? periods.find((p) => p.id === switchTo) : null;

  return (
    <>
      <AsxhPage
        title="Thiết lập & điều hành"
        description="Chọn kỳ báo cáo, tích biểu cho từng đơn vị rồi mở đợt để các đơn vị bắt đầu nhập số liệu."
        actions={<YearSelect />}
        fill
      >
        {pageBody()}
      </AsxhPage>

      {selected && (
        <>
          <OpenPeriodDialog
            open={dialog === "open"}
            onOpenChange={(o) => setDialog(o ? "open" : null)}
            period={selected}
            rows={previewRows}
            pending={actions.pending}
            onShowPreview={() => setDialog("preview")}
            onConfirm={confirmOpen}
          />
          <OpenPreviewSheet
            open={dialog === "preview"}
            onOpenChange={(o) => setDialog(o ? "preview" : null)}
            period={selected}
            rows={previewRows}
            pending={actions.pending}
            onBack={() => setDialog("open")}
            onConfirm={confirmOpen}
          />
          <SupplementDialog
            open={dialog === "supplement"}
            onOpenChange={(o) => setDialog(o ? "supplement" : null)}
            period={selected}
            lines={supplementLines}
            daysLeft={selected.deadline ? daysBetween(today, selected.deadline) : null}
            pending={actions.pending}
            onConfirm={confirmSupplement}
          />
          <ClosePeriodDialog
            open={dialog === "close"}
            onOpenChange={(o) => setDialog(o ? "close" : null)}
            period={selected}
            progress={progress}
            pending={actions.pending}
            onConfirm={confirmClose}
          />
          <ReopenDialog
            open={dialog === "reopen"}
            onOpenChange={(o) => setDialog(o ? "reopen" : null)}
            period={selected}
            today={today}
            pending={actions.pending}
            onConfirm={confirmReopen}
          />
          <WithdrawDialog
            open={dialog === "withdraw"}
            onOpenChange={(o) => setDialog(o ? "withdraw" : null)}
            period={selected}
            progress={progress}
            pending={actions.pending}
            onConfirm={confirmWithdraw}
          />
          <CopySetupDialog
            open={dialog === "copy"}
            onOpenChange={(o) => setDialog(o ? "copy" : null)}
            source={selected}
            periods={periods}
            locks={locks}
            pending={actions.pending}
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
  pageSize,
  onPageSize,
}: {
  note: string | null;
  first: number;
  last: number;
  total: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** 0 = tất cả. */
  pageSize: number;
  onPageSize: (size: number) => void;
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
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger size="sm" className="w-28" aria-label="Số đơn vị mỗi trang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n === 0 ? "Tất cả" : `${n} / trang`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
