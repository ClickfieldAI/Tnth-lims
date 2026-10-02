/* Generates prisma/schema.prisma with relation field names that EXACTLY match
 * what the app code uses (from lib/mock/relations.ts), so all include/select/
 * where calls keep working against real Prisma. */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const columns = JSON.parse(fs.readFileSync(path.join(ROOT, ".columns.json"), "utf8"));
const { RELATIONS, REVERSE_ONE_TO_ONE } = JSON.parse(fs.readFileSync(path.join(ROOT, ".rel-dump.json"), "utf8"));
const FKS = JSON.parse(fs.readFileSync(path.join(ROOT, ".fks.json"), "utf8"));

const models = Object.keys(columns);

// Natural-key fields the app looks up via findUnique/upsert (besides id and the
// 1:1 FKs already made unique for relations).
const UNIQUE_FIELDS = { user: ["email"] };
const pgToPrisma = (t) =>
  t === "jsonb" ? "Json" :
  t === "boolean" ? "Boolean" :
  t === "double precision" ? "Float" :
  t === "timestamptz" ? "DateTime" :
  "String";

// Forward relation field name on model A for a given fk column.
function forwardName(a, fk) {
  const rels = RELATIONS[a] || {};
  for (const [name, def] of Object.entries(rels)) {
    if (def.type === "toOne" && def.fk === fk) return name;
  }
  return null;
}
// Back relation on model B that corresponds to FK (A.fk -> B): returns {name, list}.
function backRel(b, a, fk) {
  const rev = (REVERSE_ONE_TO_ONE[b] || {});
  for (const [name, def] of Object.entries(rev)) {
    if (def.model === a && def.fk === fk) return { name, list: false };
  }
  const rels = RELATIONS[b] || {};
  for (const [name, def] of Object.entries(rels)) {
    if (def.type === "toMany" && def.model === a && def.fk === fk) return { name, list: true };
  }
  return null;
}

// Per-model: collected relation field lines + which fk columns need @unique.
const relLines = {};
const uniqueCols = {};
for (const m of models) { relLines[m] = []; uniqueCols[m] = new Set(UNIQUE_FIELDS[m] || []); }
let synth = 0;

for (const [a, fk, b] of FKS) {
  if (!columns[a] || !columns[a][fk] || !columns[b]) continue;
  const relName = `${a}_${fk}`;
  const fName = forwardName(a, fk) || `${b}_${fk}`;
  const back = backRel(b, a, fk) || { name: `rel_${a}_${fk}_${++synth}`, list: true };
  const oneToOne = back.list === false;
  if (oneToOne) uniqueCols[a].add(fk); // 1:1 needs the FK unique
  // forward (A holds fk)
  relLines[a].push(`  ${fName} ${b}? @relation("${relName}", fields: [${fk}], references: [id], onDelete: NoAction, onUpdate: NoAction)`);
  // back (on B)
  relLines[b].push(`  ${back.name} ${a}${oneToOne ? "?" : "[]"} @relation("${relName}")`);
}

let out = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n`;

for (const m of models) {
  const cols = columns[m];
  const lines = [];
  for (const [c, tp] of Object.entries(cols)) {
    if (c === "id") { lines.push(`  id String @id @default(cuid())`); continue; }
    const pt = pgToPrisma(tp);
    let line = `  ${c} ${pt}?`;
    if (uniqueCols[m].has(c)) line += " @unique";
    if (c === "createdAt" && pt === "DateTime") line += " @default(now())";
    if (c === "updatedAt" && pt === "DateTime") line += " @updatedAt";
    lines.push(line);
  }
  const rels = relLines[m];
  out += `model ${m} {\n${lines.join("\n")}\n${rels.length ? rels.join("\n") + "\n" : ""}}\n\n`;
}

fs.writeFileSync(path.join(ROOT, "prisma/schema.prisma"), out);
console.log(`wrote prisma/schema.prisma — ${models.length} models, ${FKS.length} relations, ${synth} synthesized back-rels`);
