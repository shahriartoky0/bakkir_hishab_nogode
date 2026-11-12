/**
 * npm run i18n:check — fails (exit 1) when:
 *  1. messages/bn.json and messages/en.json don't have exactly the same keys,
 *     or a message is empty;
 *  2. any .tsx in app/ or src/presentation/ renders hard-coded text: JSX text
 *     containing letters, or a string literal in a user-facing attribute
 *     (placeholder, title, alt, aria-label, label).
 *
 * Escape hatch for a deliberate literal: put `i18n-ignore` in a comment on the
 * line above.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const problems: string[] = [];

// ---------- 1. key parity ----------
type Json = { [k: string]: Json | string };

function flatten(obj: Json, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else flatten(v, key, out);
  }
  return out;
}

const bn = flatten(JSON.parse(readFileSync(join(ROOT, "messages/bn.json"), "utf8")) as Json);
const en = flatten(JSON.parse(readFileSync(join(ROOT, "messages/en.json"), "utf8")) as Json);

for (const k of bn.keys()) if (!en.has(k)) problems.push(`messages: "${k}" is in bn.json but missing from en.json`);
for (const k of en.keys()) if (!bn.has(k)) problems.push(`messages: "${k}" is in en.json but missing from bn.json`);
for (const [file, map] of [["bn.json", bn], ["en.json", en]] as const) {
  for (const [k, v] of map) if (!v.trim()) problems.push(`messages/${file}: "${k}" is empty`);
}

// ---------- 2. hard-coded JSX text ----------
const SCAN_DIRS = ["app", "src/presentation"];
const SKIP_DIRS = new Set(["node_modules", ".next", "ui"]); // shadcn primitives contain no copy
const TEXT_ATTRS = new Set(["placeholder", "title", "alt", "aria-label", "label"]);
const HAS_LETTER = /[\p{L}]/u;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, files);
    } else if (p.endsWith(".tsx")) files.push(p);
  }
  return files;
}

function ignored(sf: ts.SourceFile, node: ts.Node): boolean {
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const lines = sf.text.split("\n");
  return [line, line - 1].some((l) => l >= 0 && lines[l]?.includes("i18n-ignore"));
}

function report(sf: ts.SourceFile, node: ts.Node, what: string) {
  if (ignored(sf, node)) return;
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  problems.push(`${relative(ROOT, sf.fileName)}:${line + 1}:${character + 1} hard-coded ${what}`);
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && HAS_LETTER.test(node.text)) {
        report(sf, node, `JSX text "${node.text.trim().slice(0, 40)}"`);
      }
      if (ts.isJsxAttribute(node) && node.initializer) {
        const name = node.name.getText(sf);
        const init = node.initializer;
        const literal = ts.isStringLiteral(init)
          ? init.text
          : ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
            ? init.expression.text
            : null;
        if (TEXT_ATTRS.has(name) && literal && HAS_LETTER.test(literal)) {
          report(sf, node, `${name}="${literal.slice(0, 40)}"`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (problems.length) {
  console.error(`i18n:check found ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`i18n:check passed — ${bn.size} keys in each locale, no hard-coded UI text.`);
