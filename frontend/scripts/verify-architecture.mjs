/**
 * Dependency rules between the four layers of `src/`.
 *
 *   npm run verify:arch
 *
 *   app/        may import features/, shared/, domains/
 *   features/X  may import shared/, domains/, and itself — never features/Y, never app/
 *   shared/     may import shared/, domains/ — never features/, never app/
 *   domains/    may import domains/ only — no React, no Refine, no UI of any kind
 *
 * The rules are what make the layout mean something. A feature that reaches into
 * another feature, or a shared component that reaches up into `app/`, still
 * compiles and still runs — the only symptom is that the folder names stop
 * describing the code, and nothing else would ever say so.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src");

/**
 * Packages that put a file in the UI. A domain importing any of these has stopped
 * being a description of the data and become a piece of the screen.
 */
const UI_PACKAGES = [
  /^react($|-dom|-router|-hook-form)/,
  /^@refinedev\//,
  /^@tanstack\//,
  /^@radix-ui\//,
  /^lucide-react$/,
  /^sonner$/,
  /^recharts$/,
  /^cmdk$/,
  /^vaul$/,
  /^next-themes$/,
  /^class-variance-authority$/,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every import / export-from / dynamic import specifier in a file. */
function importsOf(source) {
  const out = [];
  const pattern = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\n]+)["']/g;
  let match;
  while ((match = pattern.exec(source)) !== null) out.push(match[1]);
  return out;
}

/** The specifier as a path relative to `src/`, or null for a package. */
function resolveImport(fromFile, specifier) {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (specifier.startsWith(".")) {
    const rel = relative(SRC, resolve(fromFile, "..", specifier)).replace(/\\/g, "/");
    return rel.startsWith("..") ? null : rel;
  }
  return null;
}

const segment = (path, index) => path.split("/")[index] ?? "";

const violations = [];
const files = walk(SRC);

for (const file of files) {
  const from = relative(SRC, file).replace(/\\/g, "/");
  const layer = segment(from, 0);
  const module = segment(from, 1);
  const source = readFileSync(file, "utf8");

  for (const specifier of importsOf(source)) {
    const target = resolveImport(file, specifier);
    const report = (reason) => violations.push({ from, specifier, reason });

    if (target === null) {
      if (layer === "domains" && UI_PACKAGES.some((re) => re.test(specifier))) {
        report("domains/ is plain TypeScript — no React, Refine or UI packages");
      }
      continue;
    }

    const targetLayer = segment(target, 0);
    const targetModule = segment(target, 1);

    if (layer === "domains" && targetLayer !== "domains") {
      report(`domains/ may import only domains/, not ${targetLayer}/`);
    }
    if (layer === "shared" && (targetLayer === "features" || targetLayer === "app")) {
      report(`shared/ may not import ${targetLayer}/ — move the dependency down into shared/`);
    }
    if (layer === "features" && targetLayer === "app") {
      report("features/ may not import app/ — what it needs belongs in shared/");
    }
    if (layer === "features" && targetLayer === "features" && targetModule !== module) {
      report(
        `features/${module} may not import features/${targetModule} — ` +
          "put what both need in domains/ or shared/, or make them one feature",
      );
    }
  }
}

console.log(`verify:arch — checked ${files.length} files`);

if (violations.length > 0) {
  console.error(`${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  ${v.from}\n    import "${v.specifier}"\n    → ${v.reason}`);
  }
  process.exit(1);
}

console.log("clean — no dependency rule broken.");
