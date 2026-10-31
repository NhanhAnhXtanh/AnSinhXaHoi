import { useDataProvider } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { EmptyState, formatDate, LoadingState } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  attachmentsUrl,
  ledgerAuditsUrl,
  reportHistoryUrl,
  type ApiAttachment,
  type ApiLedgerAudit,
  type ApiPublicationItem,
  type ApiReportHistory,
  type HistoryAction,
} from "./api";
import { hhmm, ledgerCounts } from "./model";

/** Một mốc trên dòng thời gian của một dòng đơn vị × biểu. */
type TimelineEvent = {
  at: Date;
  label: string;
  by: string;
  /** Lý do trả lại / lý do ghi số liệu không thành công. */
  note?: string;
  /** Mốc không có thời điểm gốc, được suy ra từ dữ liệu khác (BR-30.1). */
  inferred?: boolean;
};

type HistoryEvent = ApiReportHistory["events"][number];

const REPORT_TEXT: Partial<Record<HistoryAction, (e: HistoryEvent) => string>> = {
  SUBMITTED: (e) => (e.revisionNo > 1 ? "Đơn vị nộp lại phiếu" : "Đơn vị nộp phiếu"),
  RETURNED: () => "Sở trả lại phiếu",
  APPROVED: () => "Sở phê duyệt phiếu",
  LOCKED: () => "Phiếu khoá lại",
  CANCELLED: () => "Phiếu bị huỷ",
};

const SHEET_TEXT: Partial<Record<HistoryAction, (short: string) => string>> = {
  SHEET_SAVED: (b) => `Lưu số liệu biểu ${b}`,
  SHEET_COMPLETED: (b) => `Đánh dấu biểu ${b} đã nhập xong`,
  SHEET_NO_DATA: (b) => `Khai biểu ${b} không phát sinh số liệu`,
};

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lịch sử của MỘT dòng đơn vị × biểu từ lúc đợt phát biểu về sau (UC-30): mốc của phiếu chứa
 * biểu (nộp, trả lại, duyệt, khoá) + mốc của đúng biểu đó (lưu, đánh dấu xong) từ lịch sử phiếu
 * (UC-44), lần ghi số liệu từ nhật ký ghi, chứng từ đính kèm phiếu.
 *
 * Mốc của phiếu trước lúc biểu được thêm vào (đợt bổ sung thêm biểu vào phiếu đang nhập) không
 * thuộc dòng này nên bỏ. Không có quyền xem số liệu đã lưu / chứng từ thì bỏ qua phần đó.
 */
export function ItemHistory({
  item,
  openedBy,
}: {
  item: ApiPublicationItem;
  /** Người mở đợt. */
  openedBy: string;
}) {
  const dataProvider = useDataProvider();
  const ledgerAllowed = item.ledger !== null;

  const query = useQuery({
    queryKey: ["asxh", "publication-item-history", item.report.id, item.template.id, ledgerAllowed],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const provider = dataProvider();
      const get = async <T,>(url: string): Promise<T> => {
        const response = await provider.custom!({ url, method: "get" });
        return response.data as unknown as T;
      };
      const history = await get<ApiReportHistory>(reportHistoryUrl(item.report.id));
      const revisionIds = history.revisions.map((r) => r.id);
      // Phần phụ: thiếu quyền (403) hay lỗi riêng lẻ thì bỏ qua, lịch sử phiếu vẫn hiện.
      const optional = async <T,>(url: string): Promise<T[]> => {
        try {
          const rows = await get<T[]>(url);
          return Array.isArray(rows) ? rows : [];
        } catch {
          return [];
        }
      };
      const [audits, attachments] = await Promise.all([
        ledgerAllowed
          ? Promise.all(revisionIds.map((id) => optional<ApiLedgerAudit>(ledgerAuditsUrl(id)))).then((x) => x.flat())
          : Promise.resolve([] as ApiLedgerAudit[]),
        Promise.all(revisionIds.map((id) => optional<ApiAttachment>(attachmentsUrl(id)))).then((x) => x.flat()),
      ]);
      return { history, audits, attachments };
    },
  });

  if (query.isLoading) return <LoadingState label="Đang tải lịch sử của dòng…" />;
  if (query.isError || !query.data)
    return (
      <EmptyState
        variant="inline"
        icon={TriangleAlert}
        title="Chưa tải được lịch sử của dòng này"
        description="Đường truyền có thể đang chập chờn. Bạn thử tải lại."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Tải lại
          </Button>
        }
      />
    );

  const events = buildEvents(item, openedBy, query.data);
  return <Timeline events={events} />;
}

function buildEvents(
  item: ApiPublicationItem,
  openedBy: string,
  data: { history: ApiReportHistory; audits: ApiLedgerAudit[]; attachments: ApiAttachment[] }
): TimelineEvent[] {
  const issuedAt = toDate(item.issuedAt);
  const short = item.template.shortName ?? "";
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();
  const push = (e: TimelineEvent) => {
    const key = `${e.label}|${e.at.getTime()}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push(e);
  };
  // Mốc trước lúc biểu được phát không thuộc dòng này.
  const relevant = (at: Date) => !issuedAt || at.getTime() >= issuedAt.getTime();

  if (issuedAt)
    push({
      at: issuedAt,
      label:
        item.delivery === "NEW_REPORT"
          ? `Sở mở đợt, lập phiếu có biểu ${short}`
          : `Sở mở đợt bổ sung, thêm biểu ${short} vào phiếu đang nhập`,
      by: openedBy,
      inferred: item.derived,
    });

  for (const e of data.history.events) {
    const at = toDate(e.at);
    if (!at || !relevant(at)) continue;
    const by = e.by || "Hệ thống";
    if (e.sheet === null) {
      const text = REPORT_TEXT[e.action];
      if (!text) continue; // ISSUED: đã có mốc phát biểu ở trên.
      push({ at, label: text(e), by, note: e.action === "RETURNED" ? (e.note ?? undefined) : undefined, inferred: e.derived });
    } else if (e.sheet === short) {
      const text = SHEET_TEXT[e.action];
      if (text) push({ at, label: text(short), by, inferred: e.derived });
    }
  }

  for (const a of data.audits) {
    if (a.templateId !== item.template.id) continue;
    const at = toDate(a.operatedAt);
    if (!at) continue;
    push(
      a.result === "SUCCESS"
        ? {
            at,
            label: `Ghi nhận số liệu biểu ${short}: ${ledgerCounts(a)}`,
            by: a.operatedBy || "Hệ thống",
          }
        : {
            at,
            label: `Ghi nhận số liệu biểu ${short} không thành công`,
            by: a.operatedBy || "Hệ thống",
            note: a.failReason ?? undefined,
          }
    );
  }

  for (const f of data.attachments) {
    const at = toDate(f.createdAt);
    if (!at || !relevant(at)) continue;
    push({ at, label: `Đính kèm chứng từ: ${f.fileName}`, by: f.createdBy || "Hệ thống" });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">Chưa có diễn biến nào của biểu này.</p>;
  const hasInferred = events.some((e) => e.inferred);
  return (
    <div className="flex flex-col gap-2">
      <ol className="relative ms-1.5 flex flex-col gap-3 border-s ps-4">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 -start-[21px] size-2 rounded-full",
                i === events.length - 1 ? "bg-primary" : "bg-muted-foreground/50"
              )}
            />
            <div className="text-sm font-medium text-foreground">
              {e.label}
              {e.inferred && <span className="text-muted-foreground"> *</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(e.at)} {hhmm(e.at)} · {e.by}
            </div>
            {e.note && (
              <p className="mt-1 rounded-md border bg-card px-3 py-2 text-sm">Lý do: {e.note}</p>
            )}
          </li>
        ))}
      </ol>
      {hasInferred && (
        <p className="text-xs text-muted-foreground">
          Dấu * là mốc suy ra, không có thời điểm ghi nhận gốc.
        </p>
      )}
    </div>
  );
}
