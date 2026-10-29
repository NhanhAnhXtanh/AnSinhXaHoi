#!/usr/bin/env node
// Kiểm bundle sau `npm run build`: trang đầu (index.html + mọi chunk nó import TĨNH,
// tính bắc cầu) không được kéo SpreadJS, Designer hay Monaco. Bẫy đã gặp: gom thư viện
// vào manualChunks làm Rollup dồn helper chung (react, __vitePreload) vào chunk thư viện,
// index.html liền modulepreload cả chục MB — build vẫn xanh, chỉ trang đầu chậm hẳn.
//
//   node scripts/verify-bundle.mjs           # kiểm + in bảng kích thước trang đầu
//   node scripts/verify-bundle.mjs --json    # in JSON (để so trước/sau)
//
// Thoát mã 1 khi trang đầu chứa chunk cấm hoặc chưa có dist/.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = path.join(dist, "index.html");
if (!existsSync(indexHtml)) {
  console.error("Chưa có dist/index.html — chạy `npm run build` trước.");
  process.exit(1);
}

/** Chunk không được có mặt ở trang đầu (tên chunk do vite.config.ts / Rollup đặt). */
const FORBIDDEN = [/^spreadjs/, /^script-editor-impl/, /^spread-(workbook|designer)/, /monaco/i, /\.worker/];

const html = readFileSync(indexHtml, "utf8");
const seeds = [
  ...html.matchAll(/<script[^>]+src="\/?([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+\.js)"/g),
].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/?([^"]+\.css)"/g)].map((m) => m[1]);

// Import tĩnh trong chunk đã minify: `from"./x.js"` và `import"./x.js"` (không tính import()).
const STATIC_IMPORT = /(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g;

/** Tập chunk JS tải cùng lúc khi nạp các chunk `start` (đi theo import tĩnh). */
function staticClosure(start) {
  const seen = new Set();
  const queue = [...start];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const file = path.join(dist, rel);
    if (!existsSync(file)) continue;
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(STATIC_IMPORT)) {
      queue.push(path.posix.join(path.posix.dirname(rel), m[1]));
    }
  }
  return seen;
}

const seen = staticClosure(seeds);

const rows = [...seen, ...styles].map((rel) => {
  const buf = readFileSync(path.join(dist, rel));
  return { file: rel, raw: statSync(path.join(dist, rel)).size, gzip: gzipSync(buf).length };
});
const total = rows.reduce((a, r) => ({ raw: a.raw + r.raw, gzip: a.gzip + r.gzip }), { raw: 0, gzip: 0 });
const bad = rows.filter((r) => FORBIDDEN.some((re) => re.test(path.basename(r.file))));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ rows, total, forbidden: bad.map((r) => r.file) }, null, 2));
} else {
  const kb = (n) => (n / 1024).toFixed(1).padStart(10) + " kB";
  console.log("Trang đầu (index.html + import tĩnh bắc cầu):");
  for (const r of rows.sort((a, b) => b.raw - a.raw)) console.log(`${kb(r.raw)} ${kb(r.gzip)} gzip  ${r.file}`);
  console.log(`${kb(total.raw)} ${kb(total.gzip)} gzip  TỔNG`);
}

// Màn nhập / xem / duyệt / tổng hợp mở bảng tính qua chunk spread-workbook: nó chỉ được
// kéo lõi SpreadJS, không được kéo Designer (15 MB) hay Monaco — hai thứ chỉ màn thiết kế dùng.
const assets = readdirSync(path.join(dist, "assets"));
const workbookChunk = assets.find((f) => /^spread-workbook-.*\.js$/.test(f));
const workbookBad = workbookChunk
  ? [...staticClosure([`assets/${workbookChunk}`])].filter((f) =>
      /^(spreadjs-designer|script-editor-impl)/.test(path.basename(f))
    )
  : [];
if (!process.argv.includes("--json") && workbookChunk) {
  // Chỉ tính phần THÊM so với trang đầu (chunk trang đầu đã có sẵn trong trình duyệt).
  const files = [...staticClosure([`assets/${workbookChunk}`])].filter((f) => !seen.has(f));
  const sum = files.reduce((a, f) => a + statSync(path.join(dist, f)).size, 0);
  console.log(`\nMàn có bảng tính (${workbookChunk} + import tĩnh, ngoài trang đầu): ${(sum / 1024).toFixed(1)} kB JS`);
}
if (workbookBad.length) {
  console.error(`\nLỖI: chunk bảng tính kéo theo chunk của màn thiết kế: ${workbookBad.join(", ")}`);
  process.exit(1);
}

if (bad.length) {
  console.error(`\nLỖI: trang đầu kéo chunk nặng chỉ dành cho màn bảng tính: ${bad.map((r) => r.file).join(", ")}`);
  process.exit(1);
}
console.error("OK: trang đầu không tải SpreadJS / Designer / Monaco.");
