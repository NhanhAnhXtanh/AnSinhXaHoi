import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CheckCheck,
  Download,
  GitCompare,
  Inbox,
  Lock,
  Pencil,
  Save,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  MasterDetailLayout,
  PeriodList,
  SheetTabs,
  SpreadsheetView,
  StatusBadge,
  WorkCard,
  formatDateTime,
} from "@/shared/components/asxh";
import type {
  ActionItem,
  PeriodItem,
  PrimaryAction,
  SheetCell,
} from "@/shared/components/asxh";

import {
  CURRENT_USER,
  PERIOD_SHEETS,
  PERIOD_STATUS,
  type SavedVersion,
  type SummaryPeriod,
} from "./fixtures";
import { FullscreenButton, FullscreenFrame } from "./fullscreen-frame";
import { HistoryCompareDialog } from "./history-compare-dialog";
import { ScopePicker } from "./scope-picker";
import {
  aggregate,
  buildPeriodSheet,
  diffCells,
  sheetDef,
  unitsInScope,
  valuesAtVersion,
  withCells,
  type CellValue,
} from "./sheet-builder";
import { joinVi, nowIso } from "./utils";

/** Số Sở đang sửa: kỳ → biểu → bộ số lá. */
export type PeriodEdits = Record<string, Record<string, Record<string, CellValue>>>;

type DialogKind = "close" | "save" | "complete" | "discard" | "history" | null;

const SCOPE_LABEL: Record<string, string> = {
  tinh: "Toàn tỉnh Đồng Nai",
  "khoi-huyen": "Khối huyện",
  "khoi-xa": "Khối xã",
};

function defaultPeriodId(periods: SummaryPeriod[]): string | null {
  return (periods.find((p) => p.approved > 0) ?? periods[0])?.id ?? null;
}

/**
 * Chế độ "Theo kỳ": danh sách kỳ bên trái, bảng tổng hợp của kỳ đang chọn bên
 * phải. Nút chính đổi theo tình trạng kỳ: Chốt đợt → Lưu số liệu → Sửa số liệu
 * → (đang sửa) Lưu số liệu đã sửa + Kiểm tra & hoàn tất.
 */
export function PeriodMode({
  year,
  periods,
  onPeriodsChange,
  edits,
  onEditsChange,
  lockReason,
}: {
  year: number;
  periods: SummaryPeriod[];
  onPeriodsChange: (updater: (prev: SummaryPeriod[]) => SummaryPeriod[]) => void;
  edits: PeriodEdits;
  onEditsChange: (updater: (prev: PeriodEdits) => PeriodEdits) => void;
  /** Năm đã nộp / đã được duyệt: lý do không sửa được số (null = sửa được). */
  lockReason: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => defaultPeriodId(periods));
  const [scope, setScope] = useState("tinh");
  const [sheetKey, setSheetKey] = useState(PERIOD_SHEETS[0].key);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [full, setFull] = useState(false);
  const exitFull = useCallback(() => setFull(false), []);

  const period = periods.find((p) => p.id === selectedId) ?? null;

  const items = useMemo<PeriodItem[]>(
    () =>
      periods.map((p) => ({
        id: p.id,
        name: p.name,
        range: p.range,
        kind: p.kind,
        tone: PERIOD_STATUS[p.status].tone,
        statusLabel: PERIOD_STATUS[p.status].label,
      })),
    [periods]
  );

  const updatePeriod = (id: string, patch: (p: SummaryPeriod) => SummaryPeriod) =>
    onPeriodsChange((prev) => prev.map((p) => (p.id === id ? patch(p) : p)));

  const selectPeriod = (id: string) => {
    setSelectedId(id);
    setScope("tinh");
  };

  const list = (
    <PeriodList
      periods={items}
      selectedId={selectedId}
      onSelect={selectPeriod}
      empty={
        <EmptyState
          icon={CalendarClock}
          title="Chưa có kỳ báo cáo nào"
          description="Hãy tạo lịch ở màn Lịch và kỳ báo cáo trước."
        />
      }
    />
  );

  if (!period) {
    return (
      <MasterDetailLayout aside={list}>
        <WorkCard title={`Năm ${year}`}>
          <EmptyState
            icon={CalendarClock}
            title="Chưa có kỳ báo cáo nào"
            description="Hãy tạo lịch ở màn Lịch và kỳ báo cáo trước."
          />
        </WorkCard>
      </MasterDetailLayout>
    );
  }

  // ------------------------------------------------------------ Tình trạng kỳ
  const def = sheetDef(sheetKey);
  const status = PERIOD_STATUS[period.status];
  const isOpen = period.status === "dang-mo" || period.status === "qua-han";
  const isClosed = period.status === "da-chot";
  const noData = period.approved === 0;
  const current: SavedVersion | undefined = period.versions[period.versions.length - 1];
  const saved = Boolean(current);
  const editing = saved && period.draft !== null && !lockReason;
  const periodEdits = edits[period.id] ?? {};

  // ------------------------------------------------------------ Số trên bảng
  const scopeUnits = unitsInScope(saved ? "tinh" : scope, period.approved);
  const values = (() => {
    if (current) {
      const atVersion = valuesAtVersion(def, period, current.no);
      const edited = editing ? periodEdits[sheetKey] : undefined;
      return edited ? withCells(atVersion, edited) : atVersion;
    }
    return aggregate(def, period.id, period.months, scopeUnits);
  })();

  const scopeLabel = saved
    ? SCOPE_LABEL.tinh
    : (SCOPE_LABEL[scope] ?? scopeUnits[0]?.name ?? SCOPE_LABEL.tinh);
  const built = buildPeriodSheet(
    def,
    values,
    `${scopeLabel} · ${period.name} · Đơn vị tính: nghìn đồng${editing ? " · Ô nền màu là ô Sở được sửa số" : ""}`,
    editing
  );

  const onCellChange = (rowIndex: number, colIndex: number, value: SheetCell) => {
    const leaf = built.rowLeaf[rowIndex];
    if (!leaf || !current) return;
    const col = colIndex === 2 ? "people" : colIndex === 3 ? "money" : null;
    if (!col) return;
    const n = typeof value === "number" ? Math.max(0, Math.round(value)) : 0;
    onEditsChange((prev) => {
      const forPeriod = prev[period.id] ?? {};
      const base = forPeriod[sheetKey] ?? valuesAtVersion(def, period, current.no).cells;
      return {
        ...prev,
        [period.id]: {
          ...forPeriod,
          [sheetKey]: { ...base, [leaf]: { ...base[leaf], [col]: n } },
        },
      };
    });
  };

  /** Các ô Sở đã sửa so với lần lưu hiện hành, gom mọi biểu. */
  const pendingPatches = current
    ? Object.entries(periodEdits).flatMap(([key, cells]) =>
        diffCells(key, valuesAtVersion(sheetDef(key), period, current.no).cells, cells)
      )
    : [];

  // ------------------------------------------------------------ Thao tác
  const doClose = () => {
    updatePeriod(period.id, (p) => ({
      ...p,
      status: "da-chot",
      pending: 0,
      versions: [
        {
          no: 1,
          savedAt: nowIso(),
          savedBy: CURRENT_USER,
          note: "Chốt đợt và lưu số liệu tổng hợp",
          tag: "Tất cả biểu",
          patches: [],
        },
      ],
    }));
    setScope("tinh");
    toast.success(`Đã chốt đợt báo cáo ${period.name} và lưu số liệu tổng hợp.`);
  };

  const doSave = () => {
    updatePeriod(period.id, (p) => ({
      ...p,
      versions: [
        {
          no: 1,
          savedAt: nowIso(),
          savedBy: CURRENT_USER,
          note: "Lưu lần đầu từ các phiếu đã duyệt",
          tag: "Tất cả biểu",
          patches: [],
        },
      ],
    }));
    setScope("tinh");
    toast.success(`Đã lưu số liệu tổng hợp ${period.name}.`);
  };

  const doSaveDraft = () => {
    updatePeriod(period.id, (p) => ({
      ...p,
      draft: Array.from(new Set([...(p.draft ?? []), sheetKey])),
    }));
    toast.success(`Đã lưu số đang sửa của biểu ${def.short}.`);
  };

  const clearEdits = () =>
    onEditsChange((prev) => {
      const next = { ...prev };
      delete next[period.id];
      return next;
    });

  const doComplete = () => {
    const changedSheets = Array.from(new Set(pendingPatches.map((p) => p.sheet)));
    const nextNo = (current?.no ?? 0) + 1;
    updatePeriod(period.id, (p) => ({
      ...p,
      draft: null,
      versions:
        pendingPatches.length > 0
          ? [
              ...p.versions,
              {
                no: nextNo,
                savedAt: nowIso(),
                savedBy: CURRENT_USER,
                note: `Sở sửa số liệu biểu ${joinVi(changedSheets)}`,
                patches: pendingPatches,
              },
            ]
          : p.versions,
    }));
    clearEdits();
    toast.success(
      pendingPatches.length > 0
        ? `Đã hoàn tất — số liệu ${period.name} được lưu thành phiên bản ${nextNo}.`
        : "Đã hoàn tất, số liệu không đổi."
    );
  };

  const doDiscard = () => {
    updatePeriod(period.id, (p) => ({ ...p, draft: null }));
    clearEdits();
    toast.info(`Đã bỏ các số đang sửa, bảng trở về phiên bản ${current?.no ?? 1}.`);
  };

  const doRestore = (versionNo: number) => {
    if (!current) return;
    const target = period.versions.find((v) => v.no === versionNo);
    if (!target) return;
    const patches = PERIOD_SHEETS.flatMap((s) =>
      diffCells(
        s.key,
        valuesAtVersion(s, period, current.no).cells,
        valuesAtVersion(s, period, versionNo).cells
      )
    );
    const nextNo = current.no + 1;
    updatePeriod(period.id, (p) => ({
      ...p,
      versions: [
        ...p.versions,
        {
          no: nextNo,
          savedAt: nowIso(),
          savedBy: CURRENT_USER,
          note: `Khôi phục số liệu phiên bản ${versionNo}`,
          patches,
        },
      ],
    }));
    toast.success(`Đã khôi phục số liệu phiên bản ${versionNo} thành phiên bản ${nextNo}.`);
  };

  const doExport = () =>
    toast.success(`Đã xuất Excel biểu ${def.short} · ${period.name}.`);

  // ------------------------------------------------------------ Đầu thẻ
  let primary: PrimaryAction | undefined;
  let secondary: PrimaryAction[] | undefined;
  if (isOpen) {
    primary = {
      label: "Chốt đợt",
      icon: Lock,
      onClick: () => setDialog("close"),
      disabled: noData,
      reason: noData ? "Chưa có phiếu nào được duyệt nên chưa chốt đợt được." : undefined,
    };
  } else if (isClosed && !lockReason) {
    if (!saved) {
      primary = { label: "Lưu số liệu", icon: Save, onClick: () => setDialog("save") };
    } else if (!editing) {
      primary = {
        label: "Sửa số liệu",
        icon: Pencil,
        onClick: () => updatePeriod(period.id, (p) => ({ ...p, draft: [] })),
      };
    } else {
      secondary = [{ label: "Lưu số liệu đã sửa", icon: Save, onClick: doSaveDraft }];
      primary = {
        label: "Kiểm tra & hoàn tất",
        icon: CheckCheck,
        onClick: () => setDialog("complete"),
      };
    }
  }

  const menu: ActionItem[] = [
    {
      key: "export",
      label: "Xuất Excel",
      icon: Download,
      onSelect: doExport,
      disabled: noData,
      reason: noData ? "Chưa có số liệu để xuất." : undefined,
    },
    {
      key: "history",
      label: "Lịch sử và so sánh",
      icon: GitCompare,
      onSelect: () => setDialog("history"),
      disabled: !saved,
      reason: saved ? undefined : "Kỳ này chưa lưu số liệu tổng hợp.",
    },
    ...(editing
      ? [
          {
            key: "discard",
            label: "Bỏ các số đang sửa",
            icon: Undo2,
            destructive: true,
            onSelect: () => setDialog("discard"),
          } satisfies ActionItem,
        ]
      : []),
  ];

  let meta: ReactNode;
  if (period.status === "chua-mo") {
    meta = `Kỳ chưa mở đợt báo cáo nên chưa có số liệu · 0/${period.total} đơn vị`;
  } else if (isOpen && noData) {
    meta = `Chưa có phiếu nào được duyệt nên chưa chốt đợt được · 0/${period.total} đơn vị`;
  } else if (isOpen && period.approved < period.total) {
    meta = (
      <span className="text-warning-text inline-flex items-center gap-1.5">
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
        Mới có {period.approved}/{period.total} đơn vị được duyệt
        {period.pending > 0
          ? `, còn ${period.pending} phiếu chờ duyệt nên số liệu chưa đầy đủ`
          : " nên số liệu chưa đầy đủ"}
      </span>
    );
  } else if (!current) {
    meta = `Số liệu của ${period.approved}/${period.total} đơn vị đã được duyệt · Cập nhật ${formatDateTime(period.updatedAt)}`;
  } else if (editing) {
    const draftNote =
      pendingPatches.length > 0
        ? `Đang sửa ${pendingPatches.length} ô${period.draft?.length ? ` · đã lưu nháp biểu ${joinVi(period.draft)}` : ", chưa lưu"}`
        : period.draft?.length
          ? `Đang sửa · đã lưu nháp biểu ${joinVi(period.draft)}`
          : "Đang sửa, chưa lưu";
    meta = `Số liệu tổng hợp · Phiên bản ${current.no} · ${draftNote}`;
  } else {
    meta = `Số liệu tổng hợp · Phiên bản ${current.no} · Lưu ${formatDateTime(current.savedAt)} · ${current.savedBy}${lockReason ? ` · ${lockReason}` : ""}`;
  }

  const scopeDisabledReason = editing
    ? "Đang sửa số liệu toàn tỉnh nên không đổi được phạm vi."
    : saved
      ? "Số liệu đã lưu tính chung toàn tỉnh nên không đổi được phạm vi."
      : noData
        ? "Chưa có đơn vị nào được duyệt."
        : undefined;

  const actions = (
    <>
      <ScopePicker
        value={saved ? "tinh" : scope}
        onChange={setScope}
        units={unitsInScope("tinh", period.approved)}
        disabled={Boolean(scopeDisabledReason)}
        disabledReason={scopeDisabledReason}
      />
      <HeaderActions primary={primary} secondary={secondary} items={menu} />
    </>
  );

  const showEmpty = noData;
  const emptyIcon: LucideIcon = period.status === "chua-mo" ? CalendarClock : Inbox;

  return (
    <MasterDetailLayout aside={list}>
      <FullscreenFrame full={full} onExit={exitFull}>
        <WorkCard
          title={period.name}
          badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
          meta={meta}
          actions={actions}
          footer={
            <SheetTabs
              tabs={PERIOD_SHEETS.map((s) => ({
                key: s.key,
                label: s.short,
                done: editing ? Boolean(period.draft?.includes(s.key)) : undefined,
              }))}
              value={sheetKey}
              onChange={setSheetKey}
              maxVisible={6}
              overflowLabel={(n) => `+${n} biểu khác`}
              trailing={<FullscreenButton full={full} onToggle={() => setFull((f) => !f)} />}
            />
          }
        >
          {showEmpty ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="rounded-lg border border-dashed px-10">
                <EmptyState
                  icon={emptyIcon}
                  title={
                    period.status === "chua-mo"
                      ? "Kỳ này chưa mở đợt báo cáo"
                      : "Chưa có phiếu nào được duyệt"
                  }
                  description="Số liệu tổng hợp sẽ hiện ở đây khi phiếu đầu tiên của kỳ này được duyệt."
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
                <SpreadsheetView
                  sheet={built.sheet}
                  readOnly={!editing}
                  onCellChange={editing ? onCellChange : undefined}
                />
              </div>
            </div>
          )}
        </WorkCard>
      </FullscreenFrame>

      <ConfirmDialog
        open={dialog === "close"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Chốt đợt báo cáo ${period.name}?`}
        description={`Đơn vị sẽ không nhập thêm được số liệu cho kỳ này và kỳ không mở lại được.${
          period.pending > 0
            ? ` Còn ${period.pending} phiếu chờ duyệt sẽ không được tính vào số liệu tổng hợp.`
            : ""
        }`}
        confirmLabel={`Chốt đợt ${period.name}`}
        onConfirm={doClose}
      />
      <ConfirmDialog
        open={dialog === "save"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Lưu số liệu tổng hợp?"
        description={`Số tổng hợp hiện tại của mọi biểu trong ${period.name} sẽ được lưu lại. Sau đó bạn vẫn có thể sửa số ngay trên màn này. Mỗi kỳ chỉ lưu được một lần.`}
        confirmLabel="Lưu số liệu"
        onConfirm={doSave}
      />
      <ConfirmDialog
        open={dialog === "complete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Kiểm tra & hoàn tất số liệu ${period.name}?`}
        description={
          pendingPatches.length > 0
            ? `Có ${pendingPatches.length} ô khác lần lưu trước. Số liệu sẽ được lưu thành phiên bản ${(current?.no ?? 0) + 1}. Sau đó bạn vẫn có thể bấm "Sửa số liệu" để sửa tiếp.`
            : "Không có ô nào khác lần lưu trước. Hoàn tất để đánh dấu đã sửa xong, số liệu giữ nguyên."
        }
        confirmLabel="Hoàn tất"
        onConfirm={doComplete}
      />
      <ConfirmDialog
        open={dialog === "discard"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Bỏ các số đang sửa?"
        description={`Các số đã sửa của ${period.name} sẽ bị bỏ, bảng trở về số của phiên bản ${current?.no ?? 1}.`}
        confirmLabel="Bỏ số đang sửa"
        destructive
        onConfirm={doDiscard}
      />
      {saved && (
        <HistoryCompareDialog
          open={dialog === "history"}
          onOpenChange={(o) => !o && setDialog(null)}
          period={period}
          scopeLabel="Toàn tỉnh"
          restoreDisabledReason={
            lockReason ?? (editing ? "Hoàn tất hoặc bỏ các số đang sửa trước đã." : null)
          }
          onRestore={doRestore}
        />
      )}
    </MasterDetailLayout>
  );
}
