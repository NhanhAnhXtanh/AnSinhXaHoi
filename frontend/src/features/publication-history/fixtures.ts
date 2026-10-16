// Dữ liệu mẫu — thay bằng API khi backend có

export type PublicationKind = "first" | "supplement";
export type PublicationStatus = "processing" | "created" | "failed" | "withdrawn";
export type ItemResult = "created" | "existed" | "failed" | "processing";

export type HistoryEvent = {
  at: string; // yyyy-MM-ddTHH:mm
  label: string;
  by: string;
  /** Mốc không có thời điểm gốc, được suy ra từ dữ liệu khác. */
  inferred?: boolean;
};

export type PublicationItem = {
  unitId: string;
  unitName: string;
  unitGroup: string;
  forms: number;
  result: ItemResult;
  message?: string;
  history: HistoryEvent[];
};

export type Publication = {
  id: string;
  year: number;
  periodId: string;
  periodName: string;
  periodRange: string;
  kind: PublicationKind;
  status: PublicationStatus;
  openedAt: string; // yyyy-MM-ddTHH:mm
  openedBy: string;
  openedByOrg: string;
  items: PublicationItem[];
};

const HUYEN = "Khối huyện, thành phố";
const XA = "Khối xã, phường";
const ORG = "Sở Tài chính Đồng Nai";

const UNITS: { id: string; name: string; group: string }[] = [
  ["UBND TP. Biên Hoà", HUYEN],
  ["UBND TP. Long Khánh", HUYEN],
  ["UBND huyện Trảng Bom", HUYEN],
  ["UBND huyện Long Thành", HUYEN],
  ["UBND huyện Vĩnh Cửu", HUYEN],
  ["UBND xã Phú Hữu", XA],
  ["UBND huyện Nhơn Trạch", HUYEN],
  ["UBND huyện Xuân Lộc", HUYEN],
  ["UBND huyện Cẩm Mỹ", HUYEN],
  ["UBND huyện Thống Nhất", HUYEN],
  ["UBND huyện Định Quán", HUYEN],
  ["UBND huyện Tân Phú", HUYEN],
  ["UBND xã Long Phước", XA],
  ["UBND phường Trấn Biên", XA],
  ["UBND xã Bàu Hàm", XA],
  ["UBND xã Phước Thiền", XA],
  ["UBND xã Long Tân", XA],
  ["UBND xã Đại Phước", XA],
  ["UBND xã Tam An", XA],
  ["UBND xã An Phước", XA],
  ["UBND xã Bình An", XA],
  ["UBND xã Xuân Đường", XA],
  ["UBND xã Sông Ray", XA],
  ["UBND phường Xuân Lập", XA],
  ["UBND phường Bảo Vinh", XA],
  ["UBND phường Hố Nai", XA],
  ["UBND xã Tân Triều", XA],
  ["UBND xã Thạnh Phú", XA],
  ["UBND xã Trị An", XA],
  ["UBND xã Hiếu Liêm", XA],
  ["UBND xã La Ngà", XA],
  ["UBND xã Phú Lý", XA],
  ["UBND xã Gia Kiệm", XA],
  ["UBND xã Dầu Giây", XA],
  ["UBND xã Xuân Bắc", XA],
  ["UBND xã Xuân Định", XA],
  ["UBND xã Xuân Hoà", XA],
  ["UBND xã Nam Cát Tiên", XA],
  ["UBND xã Phú Vinh", XA],
  ["UBND xã Thanh Sơn", XA],
].map(([name, group], i) => ({
  id: `dv-${String(i + 1).padStart(2, "0")}`,
  name: name as string,
  group: group as string,
}));

/** Số biểu phát cho từng đơn vị (lặp vòng). */
const FORM_PATTERN = [17, 17, 14, 17, 4, 4, 17, 16, 15, 13, 12, 18, 18, 10, 9, 14, 13, 16, 11, 12];

function addMinutes(at: string, minutes: number): string {
  const [d, t] = at.split("T");
  const [y, mo, da] = (d ?? "1970-01-01").split("-").map(Number);
  const [h, mi] = (t ?? "00:00").split(":").map(Number);
  const date = new Date(y ?? 1970, (mo ?? 1) - 1, da ?? 1, h ?? 0, mi ?? 0);
  date.setMinutes(date.getMinutes() + minutes);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

const DAY = 24 * 60;

/** Diễn biến mẫu của một dòng (đơn vị × đợt) sau khi lập phiếu. */
function historyOf(
  openedAt: string,
  index: number,
  status: PublicationStatus,
  result: ItemResult
): HistoryEvent[] {
  if (result === "failed" || result === "processing") return [];
  const events: HistoryEvent[] = [
    {
      at: openedAt,
      label: result === "existed" ? "Phiếu đã có từ trước, giữ nguyên" : "Lập phiếu cho đơn vị",
      by: "Hệ thống",
    },
  ];
  const unit = "Cán bộ đơn vị";
  const reviewer = "Trần Văn Hùng";
  if (index % 3 === 0) {
    events.push(
      { at: addMinutes(openedAt, 5 * DAY + 120), label: "Đơn vị nộp phiếu", by: unit },
      { at: addMinutes(openedAt, 7 * DAY + 45), label: "Sở phê duyệt", by: reviewer }
    );
  } else if (index % 3 === 1) {
    events.push(
      { at: addMinutes(openedAt, 6 * DAY + 30), label: "Đơn vị nộp phiếu", by: unit },
      {
        at: addMinutes(openedAt, 8 * DAY + 200),
        label: "Sở trả lại · Lý do: thiếu số liệu biểu 1b",
        by: reviewer,
      },
      { at: addMinutes(openedAt, 10 * DAY + 90), label: "Đơn vị nộp lại", by: unit }
    );
  }
  if (status === "withdrawn") {
    events.push({
      at: addMinutes(openedAt, 18 * 60 + 40),
      label: "Sở thu hồi đợt, phiếu bị xoá",
      by: "Nguyễn Thị Thu",
    });
  } else if (index % 3 === 0) {
    events.push({
      at: addMinutes(openedAt, 7 * DAY + 46),
      label: "Khoá phiếu sau khi duyệt",
      by: "Hệ thống",
      inferred: true,
    });
  }
  return events;
}

function build(
  base: Omit<Publication, "items">,
  unitIndexes: number[],
  opts: {
    results?: Record<number, ItemResult>;
    messages?: Record<number, string>;
    forms?: Record<number, number>;
  } = {}
): Publication {
  const items = unitIndexes.flatMap((ui, k) => {
    const u = UNITS[ui];
    if (!u) return [];
    const result: ItemResult =
      opts.results?.[k] ??
      (base.status === "processing" ? "processing" : base.status === "failed" ? "failed" : "created");
    return [
      {
        unitId: u.id,
        unitName: u.name,
        unitGroup: u.group,
        forms: opts.forms?.[k] ?? FORM_PATTERN[k % FORM_PATTERN.length] ?? 10,
        result,
        message: opts.messages?.[k],
        history: historyOf(base.openedAt, k, base.status, result),
      },
    ];
  });
  return { ...base, items };
}

const range = (n: number, from = 0) => Array.from({ length: n }, (_, k) => from + k);

/** 8 đợt mở của năm 2026, mới nhất trước. */
export const PUBLICATIONS: Publication[] = [
  build(
    {
      id: "dot-08",
      year: 2026,
      periodId: "q4-2026",
      periodName: "Quý IV/2026",
      periodRange: "01/10 – 31/12/2026",
      kind: "first",
      status: "created",
      openedAt: "2026-10-05T14:10",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    range(24),
    {
      results: { 4: "existed", 6: "failed" },
      messages: {
        4: "Đơn vị đã có phiếu của kỳ này từ trước.",
        6: "Đơn vị đang tạm dừng nhận báo cáo nên chưa tạo được phiếu.",
      },
    }
  ),
  build(
    {
      id: "dot-07",
      year: 2026,
      periodId: "q2-2026",
      periodName: "Quý II/2026",
      periodRange: "01/04 – 30/06/2026",
      kind: "supplement",
      status: "processing",
      openedAt: "2026-05-28T10:40",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    [12, 13],
    { forms: { 0: 2, 1: 2 } }
  ),
  build(
    {
      id: "dot-06",
      year: 2026,
      periodId: "q2-2026",
      periodName: "Quý II/2026",
      periodRange: "01/04 – 30/06/2026",
      kind: "supplement",
      status: "created",
      openedAt: "2026-05-20T09:15",
      openedBy: "Trần Văn Hùng",
      openedByOrg: ORG,
    },
    [5, 14, 15],
    { forms: { 0: 3, 1: 3, 2: 3 } }
  ),
  build(
    {
      id: "dot-05",
      year: 2026,
      periodId: "q3-2026",
      periodName: "Quý III/2026",
      periodRange: "01/07 – 30/09/2026",
      kind: "first",
      status: "created",
      openedAt: "2026-07-02T08:30",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    range(38)
  ),
  build(
    {
      id: "dot-04",
      year: 2026,
      periodId: "q3-2026",
      periodName: "Quý III/2026",
      periodRange: "01/07 – 30/09/2026",
      kind: "first",
      status: "withdrawn",
      openedAt: "2026-07-01T15:20",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    range(40)
  ),
  build(
    {
      id: "dot-03",
      year: 2026,
      periodId: "q2-2026",
      periodName: "Quý II/2026",
      periodRange: "01/04 – 30/06/2026",
      kind: "first",
      status: "created",
      openedAt: "2026-04-01T08:10",
      openedBy: "Trần Văn Hùng",
      openedByOrg: ORG,
    },
    range(40)
  ),
  build(
    {
      id: "dot-02",
      year: 2026,
      periodId: "q1-2026",
      periodName: "Quý I/2026",
      periodRange: "01/01 – 31/03/2026",
      kind: "supplement",
      status: "failed",
      openedAt: "2026-02-18T16:45",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    [16],
    {
      forms: { 0: 3 },
      messages: { 0: "Đơn vị đã ngừng nhận báo cáo nên chưa tạo được phiếu." },
    }
  ),
  build(
    {
      id: "dot-01",
      year: 2026,
      periodId: "q1-2026",
      periodName: "Quý I/2026",
      periodRange: "01/01 – 31/03/2026",
      kind: "first",
      status: "created",
      openedAt: "2026-01-05T09:00",
      openedBy: "Nguyễn Thị Thu",
      openedByOrg: ORG,
    },
    range(40)
  ),
];
