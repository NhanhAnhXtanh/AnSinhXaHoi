# Chuyển dữ liệu từ bản Jmix sang bản React/Spring (ASXH Đồng Nai)

Bộ script này chép dữ liệu thật của bản Jmix (database `report-stc-dn`, schema `qt_*`) sang database của
bản React/Spring (schema `asxh_*` dựng bằng Liquibase của `backend`).

- **Nguồn** (chỉ đọc): mặc định `report-stc-dn-27-20261017`, bản khôi phục y nguyên từ máy chủ 27.118.20.16
  sáng 17/10/2026. Phiên dblink tới nguồn đặt `READ ONLY`, không câu nào ghi vào nguồn.
- **Đích**: mặc định `asxh-react-dn`. Lần chạy nào cũng **xoá sạch dữ liệu nghiệp vụ ASXH** của đích rồi
  chép lại, nên chạy lại bao nhiêu lần cũng ra cùng một kết quả (cùng bộ id).
- Toàn bộ phần ghi chạy trong **một transaction** (`psql --single-transaction`, `ON_ERROR_STOP`): lỗi ở bất
  kỳ câu nào thì rollback, đích giữ nguyên như trước khi chạy.

## Cách chạy

Cần: PostgreSQL client (`psql`), Python 3 (chỉ thư viện chuẩn, không cần psycopg2), quyền tạo extension
`dblink` trong database đích (user `postgres`).

```bash
# 1. Tạo database đích (một lần) và dựng schema bằng chính backend:
psql -U postgres -c 'CREATE DATABASE "asxh-react-dn"'
# chạy backend một lần trỏ vào DB mới (Liquibase dựng bảng), thấy "Started DthFrameworkApplication" thì tắt:
#   JAVA_HOME=...temurin-25  SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/asxh-react-dn
#   SPRING_DATASOURCE_PASSWORD=...  SERVER_PORT=8081  gradlew --no-daemon bootRun

# 2. Chuyển + đối soát:
python migrate.py

# Tuỳ chọn
python migrate.py --verify-only                 # chỉ đối soát, không ghi
python migrate.py --src-db report-stc-dn --dst-db asxh-react-dn --password ...   # đổi nguồn/đích
python migrate.py --report doi-soat.txt         # ghi bảng đối soát ra file
python migrate.py --keep-sql gen.sql            # giữ file SQL đã sinh để xem (có chứa chuỗi kết nối)
```

Tham số cũng đọc từ biến môi trường: `PSQL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `MIGRATE_SRC_DB`,
`MIGRATE_DST_DB`. Script từ chối dùng `dth-framework`, `report-stc`, `report-stc-dn`, `postgres` hoặc chính
database nguồn làm đích, và từ chối chạy nếu đích chưa có schema (thiếu changeset `166-add-user-report-unit`).

Thời gian: khoảng 1–2 phút (dữ liệu 63 MB).

## Các file

| File | Việc |
|---|---|
| `migrate.py` | Điều phối: kiểm tra an toàn, đọc danh mục cột của nguồn, sinh phần nạp `jmix_ref`, ghép `00` + nạp + `20` thành một file chạy trong một transaction, rồi chạy `30` |
| `sql/00-reset.sql` | Chốt chặn đúng DB đích; tạo `migration_id_map`; xoá tài khoản lần chuyển trước tạo và tài khoản gắn đơn vị (dev 167); xoá toàn bộ `asxh_*`; dựng lại schema `jmix_ref`; `CREATE EXTENSION dblink` |
| (sinh trong `migrate.py`) | Chép **thô** mọi bảng `qt_*` + `rf_user` (bỏ cột `password`) + `sec_role_assignment` sang `jmix_ref.*` qua dblink; mã băm mật khẩu chỉ nằm trong bảng tạm của transaction |
| `sql/20-map.sql` | Chép từ `jmix_ref` sang bảng `asxh_*`, `users`, `user_roles` |
| `sql/30-verify.sql` | Đối soát, đọc nguồn **trực tiếp** qua dblink (không qua bản sao) |

## Cấp id và bảng tra `migration_id_map`

Mỗi bảng đích được cấp id tuần tự theo thứ tự ổn định, ghi vào `public.migration_id_map` trước, rồi chèn
với id tường minh; cuối cùng đặt lại sequence identity = `max(id) + 1`. Bảng tra được giữ lại để đối soát:

| Cột | Ý nghĩa |
|---|---|
| `source_table` | bảng Jmix (`qt_input_report`…), hoặc khoá ghép: `qt_template_sheet.sheet_code` (biểu), `qt_dept_report(YEAR)` (báo cáo năm) |
| `source_uuid` | UUID dòng Jmix |
| `source_key` | khoá chữ: mã biểu `BM-xxxxxx`; với phiên bản mẫu là mã phiên bản Jmix `PB-xxxxxx` (bản mới không có cột này) |
| `target_table`, `target_id` | dòng tương ứng ở bản mới |
| `created` | `false` = gộp vào dòng sẵn có (tài khoản `admin`) |

Ví dụ: `select * from migration_id_map where source_table = 'qt_input_report' and source_uuid = '…'`.

## Bảng nào sang bảng nào

Dòng Jmix đã **xoá mềm** (`deleted_date` khác null) không chuyển — bản mới không có xoá mềm; vẫn còn ở `jmix_ref`.

| Jmix | Bản mới | Ghi chú |
|---|---|---|
| `qt_organization` | `asxh_report_units` | `code` → `budget_code` (giữ nguyên, script và số liệu Sở dùng mã này); cây `parent_id`; `org_type` SO/TRUONG/TINH/KHAC giữ, XA → `UBND_XA`; khối: XA → `XA`, còn lại `TINH` (như `ReportUnitType.defaultBlock`); `active`; `reporting_enabled` → `receives_reports` |
| `qt_report_calendar` | `asxh_report_calendars` | Jmix không lưu hạn nộp ở lịch: `deadline_days` = số ngày (hạn − cuối kỳ) gặp nhiều nhất trong các kỳ; `kinds` = các loại kỳ đang có |
| `qt_reporting_period` | `asxh_report_periods` | MONTH/QUARTER/HALF_YEAR/YEAR → THANG/QUY/SAU_THANG/NAM; mã + tên kỳ sinh đúng luật `PeriodPlanner` ("Tháng 3/2026", "Quý I/2029"…); `period_from/to` → `from_date/to_date`; `open_from`; `open_to` → `deadline`; trạng thái giữ nguyên; `deadline_manual` = hạn khác (cuối kỳ + số ngày của lịch) |
| `qt_report_template` | `asxh_template_sets` | bộ mẫu (kể cả bộ chưa có phiên bản) |
| chuỗi phiên bản theo `qt_template_sheet.sheet_code` | `asxh_templates` | `code` = `BM-xxxxxx`; `short_name` = `report_type` (1a, 1b…) hoặc tên phiên bản (`01-TongHop`, `test`); `name` = tên tờ biểu; `kind`: YEAR_SUMMARY → TONG_HOP, INPUT → CHI_TIET |
| `qt_template_version` + `qt_template_sheet` + `qt_template_script` | `asxh_template_versions` | `version_no` đánh lại 1..n theo ngày tạo trong từng biểu; `previous_version_id`; trạng thái giữ; `approved_at/by` → `published_at/by`; `revoked_*`; `workbook_json` = workbook thật; `script_text` = ghép script (xem dưới); `effective_to` tính lại như `TemplateVersionService.refreshEffectiveTo` |
| `qt_report_period_template` × `qt_report_period_scope` × `qt_report_period_scope_org` | `asxh_period_assignments` | mỗi ô (kỳ, đơn vị, biểu) một dòng; chỉ phạm vi INCLUDE còn hiệu lực |
| `qt_report_publication` | `asxh_publications` | INITIAL/SUPPLEMENTAL → LAN_DAU/BO_SUNG; `unit_count` = số đơn vị, `sheet_count` = số dòng item CREATED, `report_count` = `created_reports` |
| `qt_input_report` | `asxh_input_reports` | đơn vị, kỳ, đợt (`publication_id`), `revision_no`, `previous_revision_id`, trạng thái, người/ngày nộp, duyệt, lý do trả lại. Jmix không lưu "ai/khi nào trả lại": lấy theo phiên bản kế tiếp (Jmix tạo bản kế tiếp đúng lúc trả lại, như `InputReportService.returnReport`) |
| `qt_input_report_sheet` | `asxh_input_report_sheets` | `workbook_draft_json` → `data_json` (nguyên văn); trạng thái biểu giữ, riêng IN_PROGRESS chưa từng lưu (dataJson rỗng) → `NOT_STARTED` (Jmix không có trạng thái này) |
| `qt_input_report.treasury_confirmed` | `asxh_input_report_treasury_confirmations` | một dòng `confirmed = true` cho mỗi phiếu đã tích (thiếu dòng = chưa tích) |
| `qt_report_attachment` | `asxh_input_report_attachments` | chỉ **siêu dữ liệu** — xem "File đính kèm" |
| `qt_report_ledger` | `asxh_ledger_entries` | `org_id` → `unit_id` (đơn vị số liệu), `submitter_org_id` → `submitter_unit_id` (đơn vị nộp); thêm `sheet_id`, `template_id`, `template_version_id` theo tờ biểu của phiếu; `source = SCRIPT` |
| `qt_script_write_audit` | `asxh_ledger_write_audits` | `source = SCRIPT` |
| `qt_criterion.measure_kind` | `asxh_indicator_measures` | hiện nguồn chưa có tiêu chí nào khai `measure_kind` → 0 dòng |
| `qt_dept_report` (kind PERIOD) | `asxh_dept_reports` | một dòng mỗi kỳ |
| `qt_dept_report_sheet` (của kỳ) | `asxh_dept_report_sheets` | `workbook_draft_json` → `draft_json`, `version` → `revision` |
| `qt_dept_ledger` | `asxh_dept_ledger_lines` | `org_key` → `unit_key`, `org_id` → `unit_id`, khoảng phiên bản, `change_id` |
| `qt_dept_ledger_audit` | `asxh_dept_ledger_audits` | `sheet_code` → `template_id` |
| `qt_dept_change` | `asxh_dept_changes` | PERIOD_CLOSED → PERIOD_SAVED, SUBMITTED/APPROVED/RETURNED/REOPENED → YEAR_*; mốc của báo cáo năm: `report_id` trống, `annual_ref` = id phiếu năm |
| `qt_dept_report_source` | `asxh_dept_report_sources` | |
| `qt_dept_ledger_year` | `asxh_dept_ledger_years` | `lock_state` suy từ phiếu năm mới nhất (SUBMITTED/APPROVED → khoá; còn lại OPEN), câu `lock_note` đúng câu của `AnnualReportWorkflowService` |
| `qt_dept_report` (kind YEAR) | `asxh_annual_reports` | `submission_doc_no/date` → `doc_no/date`, `ubnd_decided_*` → `decided_*`; `reopened` = phiếu RETURNED mà quyết định cuối của UBND là "mở lại" |
| `qt_dept_report_sheet` (của năm) | `asxh_annual_report_sheets` | |
| `qt_dept_report_attachment` | `asxh_annual_report_attachments` | siêu dữ liệu |
| `rf_user` | `users` | tên đăng nhập, họ tên (`first_name` + `last_name`), email (thiếu → `<tên>@dongnai.local`), `active` → ACTIVE/INACTIVE, đơn vị → `report_unit_id`. Trùng tên với tài khoản sẵn có (`admin`) → gộp, giữ mật khẩu bản mới |
| `sec_role_assignment` | `user_roles` | system-full-access → ADMIN; user-officer → ORGANIZATION_REPORTER; report-officer/report-approver → REPORT_APPROVER; report-admin → REPORT_ADMIN; template-admin → TEMPLATE_ADMIN; dept-report-compiler/-submitter → DEPT_REPORT_COMPILER/-SUBMITTER; ubnd-approver → UBND_APPROVER; report-auditor → AUDITOR. Bỏ `ui-minimal` (quyền vào giao diện Jmix) và `officer-org-row-level` (bản mới lọc theo `users.report_unit_id`) |

### Script mẫu: nhiều bản ghi → một `script_text`

Bản Jmix lưu nhiều bản ghi `qt_template_script` cho một phiên bản; bản mới lưu một `script_text`. Mỗi bản ghi
(theo `display_order`) thành một khối:

```js
// ===== [Khối Jmix 2/5] Ledger — hook: getInputData =====
(function () {
<mã gốc, kết thúc bằng return defineScript({...})>
})();
```

Hàm bọc giữ hằng/hàm cấp cao của từng bản ghi không đụng nhau; mỗi khối gọi `defineScript` đúng một lần. Cả
frontend (`compile.ts`, dạng 2 "gọi defineScript nhiều lần") lẫn `ServerScriptRunner` (đã sửa cho tương thích,
có test `ServerScriptRunnerMultiBlockTest`) gom mọi lần gọi và chạy theo thứ tự — tương đương nhiều bản ghi
như bản Jmix. Bản ghi đang tắt (hiện không có) sẽ thành chú thích. Đã kiểm thật: biên dịch 26/26 phiên bản
bằng `compile.ts` đúng số khối và hook; máy chủ chạy `getInputData` trên 2.303 tờ biểu đã duyệt ra đúng số
liệu đã duyệt chuyển sang (2 tờ biểu 1i lệch ở chữ số thập phân thứ 13 do cộng số thực, không phải do chuyển).

### Cột / dữ liệu không chuyển và lý do

| Dữ liệu Jmix | Lý do |
|---|---|
| `version`, `created_by/last_modified_by` (phần lớn), `deleted_*` | khoá lạc quan / dấu vết Jmix; bản mới không có xoá mềm. `created_at/updated_at` được giữ |
| `qt_organization.metadata` | toàn bộ trống |
| `qt_report_calendar.name`, mã/trạng thái lịch | bản mới bỏ có chủ ý (tên suy từ năm) |
| `qt_template_version.version_code`, `name` | không có cột; mã PB giữ ở `migration_id_map.source_key` |
| `qt_template_script.name/declared_hooks/script_hash/sheet_code` | gộp vào chú thích đầu khối |
| `qt_template_sheet.workbook_hash`, `display_order` | bản mới không dùng |
| `qt_report_period_template.required_`, `template_version_id`, `default_data_json` | bản mới ghim phiên bản ở tờ biểu của phiếu; `default_data_json` đều trống |
| `qt_report_period_scope` (luật phạm vi ORG_TYPE/ORG_TREE…) | bản mới lưu ô đã giải sẵn; luật gốc ở `jmix_ref` |
| `qt_report_publication.publication_code`, `skipped/failed_reports`, `warning_override`, `correlation_id`; `qt_report_publication_item` | bản mới không có; ở `jmix_ref` |
| `qt_input_report.template_id/template_version_id/sheet_code/period_template_id/required_/current_ledger_batch_id/default_data_json` | cột cũ trước mô hình "phiếu gộp", đều trống |
| `qt_report_ledger.batch_id`, `qt_ledger_batch`, `qt_ledger_audit_log`, `qt_summary_snapshot` | trống ở nguồn (0 dòng); `qt_summary_snapshot` khoá theo bộ mẫu chứ không theo phiên bản nên không map được nếu có |
| `qt_script_write_audit.version_hash` | không có cột |
| `qt_dept_report.scope_key`, `previous_revision_id`, trạng thái của số liệu kỳ | bản mới không có (số liệu kỳ không có trạng thái) |
| `qt_criterion` (279 dòng), `qt_object_type` (6 dòng) | bản mới **chưa có bảng** — không tự tạo bảng nghiệp vụ mới; chép nguyên ở `jmix_ref.qt_criterion`, `jmix_ref.qt_object_type` cho màn sau dùng |
| `rf_user.password` dạng `{noop}` (tài khoản Jmix `admin`) | gộp vào `admin` của bản mới |

## File đính kèm — CÒN PHẢI CHÉP FILE

Bảng chỉ có siêu dữ liệu. Nội dung file nằm trên **đĩa máy chủ Jmix 27.118.20.16** (FileStorage `fs` của
add-on localfs; app Jmix không cấu hình `jmix.localfs.storage-dir` nên thư mục gốc là mặc định
`<thư mục làm việc của app>/.jmix/work/filestorage`), không có ở máy local. Đường dẫn cũ `fs://2026/04/02/<uuid>.png?name=…`
được ghi thành `storage_path = jmix-fs/2026/04/02/<uuid>.png`. Để file mở được trên bản mới:

1. Trên máy chủ 27, chép nguyên cây thư mục gốc FileStorage (các thư mục `yyyy/MM/dd/`) — 203 file xác nhận
   Kho bạc + 2 file phiếu nộp báo cáo năm.
2. Đặt vào `<asxh.attachments.storage-dir>/jmix-fs/` của bản mới (mặc định `./data/attachments/jmix-fs/`).
3. Kiểm: `select storage_path from asxh_input_report_attachments union all select storage_path from asxh_annual_report_attachments`
   — mọi đường dẫn phải tồn tại dưới thư mục trên. Đường dẫn gốc đầy đủ vẫn ở `jmix_ref.qt_report_attachment.file_`.

## Tài khoản sau khi chuyển

| Tên đăng nhập | Vai trò | Đơn vị | Mật khẩu |
|---|---|---|---|
| `admin` | ADMIN | | gộp vào admin của bản mới — **Admin@123** (mật khẩu Jmix `{noop}admin` không dùng) |
| `ubnd` | UBND_APPROVER | | giữ mật khẩu cũ (BCrypt) |
| `UBNDPAL`, `UBNDPBV`, `UBNDPDG`, `UBNDPT` | ORGANIZATION_REPORTER | phường An Lộc, Bảo Vinh, Dầu Giây, Phước Tân | giữ mật khẩu cũ (BCrypt) |

Bản mới dùng `BCryptPasswordEncoder` thuần; Jmix lưu `{bcrypt}$2a$…`/`{bcrypt}$2b$…` → bỏ tiền tố `{bcrypt}`
là dùng được. Định dạng khác sẽ nhận mật khẩu tạm `User@123` (ghi ở `jmix_ref.migrated_user_password`).
Tài khoản sẵn có của base (`manager`, `viewer`) và 4 tài khoản dev không gắn đơn vị của `167-seed`
(`so.duyet`, `so.dieuhanh`, `so.tonghop`, `ubnd.duyet`, mật khẩu chung `User@123`) vẫn còn — **xoá hoặc đổi
mật khẩu trước khi đưa DB này ra dùng thật**. Hai tài khoản dev gắn đơn vị demo đã bị xoá cùng đơn vị demo.

## Kết quả đối soát (chạy 17/10/2026, nguồn `report-stc-dn-27-20261017` → `asxh-react-dn`)

| Nhóm | Nguồn | Đích | |
|---|---:|---:|---|
| Đơn vị | 106 | 106 | khớp |
| Lịch báo cáo | 4 | 4 | khớp |
| Kỳ báo cáo (còn sống; 23 kỳ xoá mềm không chuyển) | 59 | 59 | khớp |
| Bộ mẫu | 4 | 4 | khớp |
| Biểu | 20 | 20 | khớp |
| Phiên bản mẫu (7 bản xoá mềm không chuyển) | 26 | 26 | khớp |
| Script (bản ghi → khối) | 147 | 147 | khớp |
| Thiết lập kỳ (ô đơn vị × biểu) | 4.066 | 4.066 | khớp |
| Đợt phát hành | 6 | 6 | khớp |
| Phiếu nhập | 316 | 316 | khớp |
| Tờ biểu của phiếu | 4.150 | 4.150 | khớp |
| Phiếu đã tích xác nhận Kho bạc | 203 | 203 | khớp |
| File đính kèm phiếu (siêu dữ liệu) | 203 | 203 | khớp |
| Số liệu đã duyệt | 18.162 | 18.162 | khớp |
| Nhật ký ghi số liệu | 2.303 | 2.303 | khớp |
| Số liệu Sở: kỳ / biểu / dòng / bộ đếm năm / lịch sử / nhật ký ô / phiếu nguồn | 3 / 17 / 130 / 2 / 16 / 41 / 3 | như nguồn | khớp |
| Báo cáo năm: phiếu / biểu / file | 3 / 3 / 2 | 3 / 3 / 2 | khớp |
| Tài khoản | 6 | 6 | khớp |

Số liệu đã duyệt theo (kỳ, biểu): 49/49 nhóm khớp cả số dòng, tổng số lượng, tổng kinh phí. Gộp theo kỳ:

| Kỳ | Dòng | Tổng số lượng | Tổng kinh phí |
|---|---:|---:|---:|
| Tháng 3/2026 | 10.813 | 1.817.296 | 8.635.292,819 |
| Tháng 8/2026 | 55 | 2.723 | 8.145,219 |
| Tháng 9/2026 | 7.260 | 1.218.301 | 5.807.624,905 |
| Quý I/2029 | 15 | 180 | 182 |
| Tháng 4/2029 | 19 | 204 | 218 |

Phiếu theo trạng thái (nguồn = đích): APPROVED 174, DRAFT 20, LOCKED 94, RETURNED 5, SUBMITTED 17, SUPERSEDED 6.
`dataJson`: 4.150/4.150 tờ biểu trùng md5 với nguồn; workbook mẫu 26/26 trùng md5.

Chạy thử backend trên DB đích (cổng 8081, đăng nhập `admin`): `/api/input_reports` 310 phiếu (+6 bản cũ khi
`includeSuperseded=true` = 316); `/api/summary/data?periodId=…` tổng số lượng/kinh phí trùng đúng bảng trên
(Tháng 3/2026: 158 chỉ tiêu, 1.817.296 / 8.635.292,819); `/api/asxh_dashboard?year=2026`: 308 phiếu, đã duyệt 172,
đang nhập 20, chờ duyệt 17, trả lại 5, đã khoá 94 — khớp đối soát. Các API danh sách đơn vị, kỳ, mẫu, thiết
lập, đợt, số liệu, số liệu Sở, báo cáo năm, tổng hợp năm đều trả 200.
