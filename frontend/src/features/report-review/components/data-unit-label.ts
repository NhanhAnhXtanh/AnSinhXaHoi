import type { ReportDataUnits } from "../api";

type Unit = ReportDataUnits["sheets"][number]["units"][number];

/** Tên đơn vị được nhập hộ; mã không có trong danh mục thì hiện chính mã đó. */
export const unitLabel = (u: Unit) => (u.known ? (u.name ?? u.budgetCode) : `mã ${u.budgetCode}`);
