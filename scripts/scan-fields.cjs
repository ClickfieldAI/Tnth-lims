/* Heuristic scan: find scalar field keys the app references per model in
 * where/data/orderBy/select, and report any not present as columns. Catches
 * fields the demo data never populated (so inference missed them). */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const columns = JSON.parse(fs.readFileSync(path.join(ROOT, ".columns.json"), "utf8"));
const { RELATIONS, REVERSE_ONE_TO_ONE } = JSON.parse(fs.readFileSync(path.join(ROOT, ".rel-dump.json"), "utf8"));

const models = Object.keys(columns);
const relNames = {};
for (const m of models) {
  relNames[m] = new Set([
    ...Object.keys(RELATIONS[m] || {}),
    ...Object.keys(REVERSE_ONE_TO_ONE[m] || {}),
  ]);
}
const OPS = new Set(["AND","OR","NOT","some","none","every","in","notIn","not","lt","lte","gt","gte","contains","startsWith","endsWith","equals","mode","is","isNot"]);

// collect files
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|mock|\.next/.test(p)) out = out.concat(walk(p)); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(ROOT, "actions")), ...walk(path.join(ROOT, "lib")), ...walk(path.join(ROOT, "app"))];

const missing = {}; // model -> Set(field)
const re = /prisma\.(\w+)\.(findUnique|findFirst|findMany|count|create|update|updateMany|upsert|delete|deleteMany|groupBy|aggregate)\s*\(/g;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const model = m[1];
    if (!columns[model]) continue;
    // grab exactly the balanced (...) of THIS call (no bleed into the next)
    const start = m.index + m[0].length; // just after the opening (
    let pd = 1, cend = start;
    for (let i = start; i < src.length && i < start + 4000; i++) {
      if (src[i] === "(") pd++;
      else if (src[i] === ")") { pd--; if (pd === 0) { cend = i; break; } }
    }
    const chunk = src.slice(start, cend);
    for (const kw of ["where", "data", "orderBy"]) {
      const ki = chunk.indexOf(kw + ":");
      if (ki === -1) continue;
      // capture the {...} right after kw:
      const braceStart = chunk.indexOf("{", ki);
      if (braceStart === -1) continue;
      let depth = 0, end = braceStart;
      for (let i = braceStart; i < chunk.length; i++) {
        if (chunk[i] === "{") depth++;
        else if (chunk[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      const block = chunk.slice(braceStart + 1, end);
      // top-level keys only: identifiers followed by ':' not nested (rough: match at depth 1)
      let d = 0;
      const keyRe = /([a-zA-Z_]\w*)\s*:/g;
      let km;
      let idx = 0;
      // track depth to only take depth-0 keys within block
      const depths = [];
      let dd = 0;
      for (let i = 0; i < block.length; i++) {
        depths[i] = dd;
        if (block[i] === "{" || block[i] === "[") dd++;
        else if (block[i] === "}" || block[i] === "]") dd--;
      }
      while ((km = keyRe.exec(block))) {
        const key = km[1];
        const at = km.index;
        if (depths[at] !== 0) continue; // only top-level keys
        if (OPS.has(key)) continue;
        if (relNames[model].has(key)) continue;
        if (key === "_count" || key === "_all" || key === "select" || key === "include") continue;
        if (columns[model][key]) continue;
        (missing[model] ??= new Set()).add(key);
      }
    }
  }
}

const result = {};
for (const [m, s] of Object.entries(missing)) result[m] = [...s];
fs.writeFileSync(path.join(ROOT, ".missing-cols.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
