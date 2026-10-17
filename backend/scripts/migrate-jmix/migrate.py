#!/usr/bin/env python3
"""Chuyển dữ liệu thật từ database Jmix (report-stc-dn) sang database của bản React/Spring.

Chỉ dùng thư viện chuẩn + psql (không cần psycopg2). Xem README.md cùng thư mục.

    python migrate.py                       # chuyển + đối soát (mặc định nguồn/đích bên dưới)
    python migrate.py --verify-only         # chỉ chạy đối soát
    python migrate.py --src-db X --dst-db Y # đổi nguồn / đích

Toàn bộ phần ghi chạy trong MỘT transaction (psql --single-transaction, ON_ERROR_STOP):
lỗi ở bất kỳ câu nào thì rollback, database đích giữ nguyên như trước khi chạy.
Database nguồn chỉ được ĐỌC (phiên dblink đặt READ ONLY).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SQL_DIR = HERE / "sql"

# Database không bao giờ được làm đích (đích bị XOÁ dữ liệu ASXH trước khi chép).
PROTECTED_TARGETS = {"dth-framework", "report-stc", "report-stc-dn", "postgres", "template0", "template1"}

DEFAULT_PSQL = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Bảng Jmix chép thô sang jmix_ref: mọi bảng nghiệp vụ qt_* + tài khoản / gán vai trò.
EXTRA_SOURCE_TABLES = ("rf_user", "sec_role_assignment")
# Cột KHÔNG chép sang jmix_ref (mã băm mật khẩu chỉ nằm trong bảng tạm của transaction).
EXCLUDED_COLUMNS = {("rf_user", "password")}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Chuyển dữ liệu Jmix → bản React/Spring ASXH")
    p.add_argument("--psql", default=os.environ.get("PSQL", DEFAULT_PSQL))
    p.add_argument("--host", default=os.environ.get("PGHOST", "localhost"))
    p.add_argument("--port", default=os.environ.get("PGPORT", "5432"))
    p.add_argument("--user", default=os.environ.get("PGUSER", "postgres"))
    p.add_argument("--password", default=os.environ.get("PGPASSWORD", "123456"))
    p.add_argument("--src-db", default=os.environ.get("MIGRATE_SRC_DB", "report-stc-dn-27-20261017"),
                   help="database Jmix nguồn (chỉ đọc)")
    p.add_argument("--dst-db", default=os.environ.get("MIGRATE_DST_DB", "asxh-react-dn"),
                   help="database đích (đã dựng schema bằng Liquibase của backend)")
    p.add_argument("--verify-only", action="store_true", help="chỉ chạy đối soát, không ghi")
    p.add_argument("--keep-sql", metavar="FILE", help="lưu file SQL đã sinh để xem (có chứa chuỗi kết nối)")
    p.add_argument("--report", metavar="FILE", help="ghi kết quả đối soát ra file")
    return p.parse_args()


def run_psql(args: argparse.Namespace, db: str, *extra: str, check: bool = True) -> str:
    env = dict(os.environ, PGPASSWORD=args.password, PGCLIENTENCODING="UTF8")
    cmd = [args.psql, "-X", "-h", args.host, "-p", str(args.port), "-U", args.user, "-d", db,
           "-v", "ON_ERROR_STOP=1", *extra]
    proc = subprocess.run(cmd, env=env, capture_output=True)
    out = proc.stdout.decode("utf-8", "replace")
    err = proc.stderr.decode("utf-8", "replace")
    if check and proc.returncode != 0:
        sys.stderr.write(out + "\n" + err + "\n")
        raise SystemExit(f"psql lỗi (mã {proc.returncode}) trên database {db}")
    return out + (("\n" + err) if err.strip() else "")


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def quote_literal(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def conn_string(args: argparse.Namespace, db: str) -> str:
    def esc(v: str) -> str:
        return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"
    return (f"host={esc(args.host)} port={esc(args.port)} dbname={esc(db)} "
            f"user={esc(args.user)} password={esc(args.password)}")


def source_columns(args: argparse.Namespace) -> dict[str, list[tuple[str, str]]]:
    """Danh sách bảng + (cột, kiểu) của database nguồn, theo thứ tự cột."""
    extra = ",".join(quote_literal(t) for t in EXTRA_SOURCE_TABLES)
    sql = f"""
        SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE c.relkind = 'r' AND (c.relname LIKE 'qt\\_%' OR c.relname IN ({extra}))
        ORDER BY c.relname, a.attnum"""
    out = run_psql(args, args.src_db, "-At", "-F", "\t", "-c", sql)
    tables: dict[str, list[tuple[str, str]]] = {}
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        tables.setdefault(parts[0], []).append((parts[1], parts[2]))
    if not tables:
        raise SystemExit("Không đọc được bảng nào ở database nguồn")
    return tables


def build_load_sql(args: argparse.Namespace, tables: dict[str, list[tuple[str, str]]]) -> str:
    conn = conn_string(args, args.src_db)
    lines = [
        "-- Nạp bản sao thô các bảng Jmix vào jmix_ref qua dblink (phiên nguồn READ ONLY).",
        f"SELECT dblink_connect('jmix', {quote_literal(conn)});",
        "SELECT dblink_exec('jmix', 'SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');",
        "DO $$ BEGIN",
        "  IF (SELECT d FROM dblink('jmix', 'SELECT current_database()') AS t(d text)) <> "
        f"{quote_literal(args.src_db)} THEN",
        "    RAISE EXCEPTION 'dblink không trỏ đúng database nguồn';",
        "  END IF;",
        "END $$;",
    ]
    for table, cols in sorted(tables.items()):
        kept = [(c, t) for c, t in cols if (table, c) not in EXCLUDED_COLUMNS]
        select_list = ", ".join(quote_ident(c) for c, _ in kept)
        col_defs = ", ".join(f"{quote_ident(c)} {t}" for c, t in kept)
        remote = f"SELECT {select_list} FROM public.{quote_ident(table)}"
        lines.append(
            f"CREATE TABLE jmix_ref.{quote_ident(table)} AS SELECT * FROM dblink('jmix', "
            f"{quote_literal(remote)}) AS t({col_defs});")
        lines.append(f"COMMENT ON TABLE jmix_ref.{quote_ident(table)} IS "
                     f"{quote_literal('Bản sao thô bảng ' + table + ' của database Jmix ' + args.src_db)};")
    # Mã băm mật khẩu: chỉ trong bảng tạm, mất khi transaction kết thúc.
    lines.append("CREATE TEMP TABLE tmp_rf_user_password ON COMMIT DROP AS SELECT * FROM dblink('jmix', "
                 "'SELECT id, password FROM public.rf_user') AS t(id uuid, password varchar);")
    lines.append("SELECT dblink_disconnect('jmix');")
    return "\n".join(lines) + "\n"


def main() -> None:
    # Console Windows mặc định cp1252 — in tiếng Việt cần UTF-8.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    if args.dst_db in PROTECTED_TARGETS or args.dst_db == args.src_db:
        raise SystemExit(f"Từ chối: không được dùng '{args.dst_db}' làm database đích")

    exists = run_psql(args, "postgres", "-At", "-c",
                      f"SELECT 1 FROM pg_database WHERE datname = {quote_literal(args.dst_db)}").strip()
    if exists != "1":
        raise SystemExit(f"Database đích '{args.dst_db}' chưa có — tạo và chạy backend một lần để dựng schema")

    if not args.verify_only:
        tables = source_columns(args)
        print(f"Nguồn {args.src_db}: {len(tables)} bảng sẽ chép thô sang jmix_ref")
        reset_sql = (SQL_DIR / "00-reset.sql").read_text(encoding="utf-8").replace("{{TARGET_DB}}", args.dst_db)
        map_sql = (SQL_DIR / "20-map.sql").read_text(encoding="utf-8")
        script = ("\\set ON_ERROR_STOP on\nSET client_min_messages = warning;\n"
                  + reset_sql + "\n" + build_load_sql(args, tables) + "\n" + map_sql)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".sql", delete=False) as fh:
            fh.write(script)
            sql_path = fh.name
        try:
            print(f"Đang chuyển sang {args.dst_db} (một transaction)…")
            run_psql(args, args.dst_db, "-q", "--single-transaction", "-f", sql_path)
            print("Chuyển xong, đã COMMIT.")
        finally:
            if args.keep_sql:
                Path(args.keep_sql).write_text(script, encoding="utf-8")
            os.unlink(sql_path)

    verify_sql = (SQL_DIR / "30-verify.sql").read_text(encoding="utf-8").replace(
        "{{SRC_CONN}}", conn_string(args, args.src_db).replace("'", "''"))
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".sql", delete=False) as fh:
        fh.write(verify_sql)
        verify_path = fh.name
    try:
        report = run_psql(args, args.dst_db, "-q", "-f", verify_path)
    finally:
        os.unlink(verify_path)
    sys.stdout.buffer.write(report.encode("utf-8"))
    sys.stdout.flush()
    if args.report:
        Path(args.report).write_text(report, encoding="utf-8")
    if "LỆCH" in report:
        raise SystemExit("ĐỐI SOÁT CÓ DÒNG LỆCH — xem bảng ở trên")


if __name__ == "__main__":
    main()
