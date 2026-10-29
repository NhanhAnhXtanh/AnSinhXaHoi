// Cấu trúc trả về của `GET /api/asxh_dashboard?year=&units=` — khớp
// `backend/.../module/asxh/home/api/dto/HomeDashboardResponse.java`. Hai phía
// giữ hợp đồng bằng tay: sửa một bên thì sửa bên kia.
//
// Quy ước giá trị enum giữ như từng enum phía máy chủ: trạng thái phiếu chữ hoa
// ("DRAFT"), trạng thái / loại kỳ và loại đơn vị chữ thường ("open", "ubnd_xa"),
// các enum riêng của trang chủ chữ hoa ("OVERDUE", "NOT_SUBMITTED").

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "RETURNED"
  | "LOCKED"
  | "CANCELLED"
  | "SUPERSEDED";

export type PeriodStatus =
  | "draft"
  | "ready"
  | "published"
  | "open"
  | "overdue"
  | "closed"
  | "locked"
  | "cancelled";

export type PeriodKind = "thang" | "quy" | "sau_thang" | "nam";

export type ReportUnitType = "tinh" | "so" | "ubnd_huyen" | "ubnd_xa" | "truong" | "khac";

/** Số phiếu theo tình trạng; `locked` = đã chốt đợt mà chưa nộp. */
export type Counts = {
  total: number;
  entering: number;
  pending: number;
  returned: number;
  approved: number;
  locked: number;
};

export type Capabilities = {
  /** Được xem chế độ "Theo đơn vị" (quyền màn Thiết lập & điều hành). */
  viewUnits: boolean;
  /** Được duyệt phiếu — việc "chờ duyệt" mở sang màn Duyệt phiếu. */
  approve: boolean;
};

export type Kpi = {
  counts: Counts;
  /** Đang nhập + bị trả lại. */
  needAction: number;
  /** Chờ duyệt + đã duyệt. */
  submitted: number;
  /** Phiếu đang nhập thuộc kỳ đã quá hạn nộp. */
  overdue: number;
  receivingPeriodCount: number;
};

export type PeriodCard = {
  id: number;
  name: string;
  kind: PeriodKind;
  fromDate: string;
  toDate: string;
  openFrom: string | null;
  deadline: string | null;
  status: PeriodStatus;
  overdue: boolean;
  /** Dương = còn N ngày, 0 = hạn hôm nay, âm = đã quá; null = chưa đặt hạn. */
  daysLeft: number | null;
  counts: Counts;
};

export type TodoKind = "OVERDUE" | "PENDING" | "RETURNED" | "ENTERING";

export type TodoItem = {
  reportId: number;
  kind: TodoKind;
  unitId: number;
  unitName: string;
  periodId: number;
  periodName: string;
  deadline: string | null;
  daysLeft: number | null;
  submittedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
};

export type UnitState = "NOT_SUBMITTED" | "RETURNED" | "PARTIAL" | "COMPLETE";

export type CellState =
  | "NOT_STARTED"
  | "ENTERING"
  | "RETURNED"
  | "PARTIAL"
  | "PENDING"
  | "APPROVED";

export type UnitPeriod = {
  id: number;
  name: string;
  deadline: string | null;
  overdue: boolean;
};

export type UnitReport = {
  id: number;
  periodId: number;
  publicationNo: number;
  status: ReportStatus;
  sheetsTotal: number;
  sheetsDone: number;
  /** Tên ngắn các biểu chưa xong ("1a", "1b"…). */
  pendingSheets: string[];
  submittedAt: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
};

export type UnitRow = {
  id: number;
  name: string;
  type: ReportUnitType;
  state: UnitState;
  sheetsTotal: number;
  sheetsDone: number;
  lastSubmittedAt: string | null;
  /** Khoá là id kỳ dạng chuỗi (khoá JSON); kỳ không có phiếu thì không có khoá. */
  periodStates: Record<string, CellState>;
  reports: UnitReport[];
};

export type UnitSummary = {
  unitCount: number;
  reportCount: number;
  complete: number;
  notSubmitted: number;
  partial: number;
  returned: number;
  returnedReports: number;
};

export type TypeShare = { type: ReportUnitType; total: number; complete: number };

export type UnitBoard = {
  periods: UnitPeriod[];
  summary: UnitSummary;
  typeShares: TypeShare[];
  items: UnitRow[];
};

export type HomeDashboard = {
  year: number;
  today: string;
  hasPeriods: boolean;
  capabilities: Capabilities;
  kpi: Kpi;
  periods: PeriodCard[];
  todo: { total: number; items: TodoItem[] };
  /** null khi không yêu cầu chế độ đơn vị hoặc không có quyền xem. */
  units: UnitBoard | null;
};
