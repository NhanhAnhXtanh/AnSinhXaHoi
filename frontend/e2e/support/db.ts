// Dọn dữ liệu e2e trực tiếp trong CSDL. Chỉ dùng cho những thứ API không cho xoá
// (phiếu đã duyệt, sổ Sở, báo cáo năm đã nộp — đều bất biến theo nghiệp vụ). Mỗi spec
// chiếm MỘT năm riêng (xem years.ts) và chỉ xoá đúng năm đó, nên chạy lại bao nhiêu lần,
// theo thứ tự nào cũng được, và không đụng số liệu năm khác (2026 của seed, test backend).
import pg from "pg";

/** CSDL mà e2e tuyệt đối không được chạm (DB thật của dự án). */
const FORBIDDEN_DB = [/asxh-react-dn/i, /report-stc/i];

export function databaseUrl(): string {
  const url =
    process.env.E2E_DATABASE_URL ?? "postgresql://postgres:123456@localhost:5432/dth-framework";
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (FORBIDDEN_DB.some((re) => re.test(name))) {
    throw new Error(`E2E từ chối chạy trên CSDL "${name}" — đây là CSDL thật.`);
  }
  return url;
}

/**
 * Xoá mọi dữ liệu nghiệp vụ của một năm: báo cáo năm, sổ Sở, sổ cái, phiếu, đợt phát hành,
 * thiết lập, kỳ và lịch năm. Một giao dịch — lỗi giữa chừng thì không xoá gì.
 */
export async function purgeYear(year: number): Promise<void> {
  if (!Number.isInteger(year) || year < 2035) {
    // Chỉ dọn năm dành riêng cho e2e; năm có số liệu seed/test backend không bao giờ lọt vào.
    throw new Error(`purgeYear: năm ${year} không phải năm dành cho e2e.`);
  }
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    const periods = `(SELECT p.id FROM asxh_report_periods p
                        JOIN asxh_report_calendars c ON c.id = p.calendar_id
                       WHERE c.year_no = $1)`;
    const reports = `(SELECT r.id FROM asxh_input_reports r WHERE r.period_id IN ${periods})`;
    const statements = [
      `DELETE FROM asxh_annual_reports WHERE report_year = $1`,
      `DELETE FROM asxh_dept_changes WHERE report_year = $1`,
      `DELETE FROM asxh_dept_reports WHERE report_year = $1 OR period_id IN ${periods}`,
      `DELETE FROM asxh_dept_ledger_years WHERE year_no = $1`,
      `DELETE FROM asxh_summary_snapshots WHERE period_id IN ${periods}`,
      `DELETE FROM asxh_ledger_write_audits WHERE report_id IN ${reports}`,
      `DELETE FROM asxh_ledger_entries WHERE period_id IN ${periods}`,
      `DELETE FROM asxh_input_reports WHERE period_id IN ${periods}`,
      `DELETE FROM asxh_publications WHERE period_id IN ${periods}`,
      `DELETE FROM asxh_period_assignments WHERE period_id IN ${periods}`,
      `DELETE FROM asxh_report_periods WHERE calendar_id IN
         (SELECT id FROM asxh_report_calendars WHERE year_no = $1)`,
      `DELETE FROM asxh_report_calendars WHERE year_no = $1`,
    ];
    for (const sql of statements) await client.query(sql, [year]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
