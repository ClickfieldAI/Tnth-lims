// Generates a SQLite-local schema variant from the canonical PostgreSQL schema.
// Usage: node prisma/scripts/gen-sqlite.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const outPath = path.join(root, "prisma", "schema.local.prisma");

let src = fs.readFileSync(schemaPath, "utf8");

// Swap the provider and hardcode a local SQLite URL.
src = src.replace('provider = "postgresql"', 'provider = "sqlite"');
src = src.replace('url      = env("DATABASE_URL")', 'url      = "file:./dev.db"');
// SQLite dev db doesn't server; no meaningful db index on prisma_ is fine.

fs.writeFileSync(outPath, src, "utf8");
console.log("Wrote", outPath);