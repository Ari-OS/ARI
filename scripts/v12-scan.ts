import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "docs/v12");

const KEY_DIRS = ["GOVERNANCE", "CONTEXTS", "docs", "README.md", "ARCHITECTURE.md"];

function walk(dir: string, out: string[] = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function pickImportant(files: string[]) {
  const lower = (s: string) => s.toLowerCase();
  const scored = files
    .map((f) => {
      const rel = path.relative(ROOT, f);
      const name = lower(rel);
      let score = 0;
      for (const k of KEY_DIRS) if (name.includes(lower(k))) score += 5;
      if (name.endsWith(".md")) score += 2;
      if (name.includes("govern")) score += 4;
      if (name.includes("context")) score += 4;
      return { f, rel, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 40);
}

function extractBullets(md: string) {
  const lines = md.split(/\r?\n/);
  const bullets: string[] = [];
  for (const ln of lines) {
    if (/^\s*[-*]\s+/.test(ln)) bullets.push(ln.trim());
  }
  return bullets.slice(0, 80);
}

const files = walk(ROOT);
const top = pickImportant(files);

let report = `# v12 Forensic Snapshot (Generated)\n\nRoot: \`${ROOT}\`\n\n## Top Sources\n`;
for (const t of top) report += `- ${t.rel}\n`;

report += `\n## Extracted Promises (heuristic bullets)\n`;

for (const t of top) {
  if (!t.rel.endsWith(".md")) continue;
  const md = fs.readFileSync(t.f, "utf8");
  const bullets = extractBullets(md);
  if (!bullets.length) continue;
  report += `\n### ${t.rel}\n`;
  for (const b of bullets) report += `${b}\n`;
}

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/RESTORE_REPORT.generated.md", report);
console.log("Wrote docs/RESTORE_REPORT.generated.md");
