// Tiny in-memory query engine that implements the subset of the Prisma
// Client API this app actually calls (findMany/findUnique/findFirst/count/
// create/update/updateMany/upsert/delete/deleteMany/groupBy + $transaction),
// backed by plain JS arrays instead of a database connection.
//
// This exists so `lib/prisma.ts` can be swapped to zero-latency mock data
// (for demos / offline dev) without touching any of the ~40 call sites that
// import `{ prisma } from "@/lib/prisma"` — same method names, same
// where/include/select/orderBy shapes, same return shapes.

import { RELATIONS, REVERSE_ONE_TO_ONE, type RelationDef } from "./relations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Where = Record<string, any> | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderBy = Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[] | undefined;

export type DB = Record<string, Row[]>;

const idCounters: Record<string, number> = {};
export function genId(model: string): string {
  idCounters[model] = (idCounters[model] ?? 0) + 1;
  return `${model}_${idCounters[model]}`;
}

// Called after loading persisted data into a fresh process (see
// lib/mock/persistence.ts) so newly generated ids continue after the
// highest id already in storage, instead of restarting from 1 and
// colliding with existing rows.
export function resyncIdCounters(db: DB): void {
  for (const [model, rows] of Object.entries(db)) {
    let max = idCounters[model] ?? 0;
    for (const row of rows) {
      const m = /^[^_]+_(\d+)$/.exec(String(row?.id ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    }
    idCounters[model] = max;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
}

function matchScalar(val: unknown, cond: unknown): boolean {
  if (cond === null) return val === null || val === undefined;
  if (isPlainObject(cond)) {
    return Object.entries(cond).every(([op, opVal]) => {
      switch (op) {
        case "equals":
          return valuesEqual(val, opVal);
        case "in":
          return (opVal as unknown[]).some((v) => valuesEqual(val, v));
        case "notIn":
          return !(opVal as unknown[]).some((v) => valuesEqual(val, v));
        case "not":
          return isPlainObject(opVal) ? !matchScalar(val, opVal) : !valuesEqual(val, opVal);
        case "lt":
          return toComparable(val) < toComparable(opVal);
        case "lte":
          return toComparable(val) <= toComparable(opVal);
        case "gt":
          return toComparable(val) > toComparable(opVal);
        case "gte":
          return toComparable(val) >= toComparable(opVal);
        case "contains":
          return String(val ?? "").toLowerCase().includes(String(opVal).toLowerCase());
        case "startsWith":
          return String(val ?? "").toLowerCase().startsWith(String(opVal).toLowerCase());
        default:
          return true;
      }
    });
  }
  return valuesEqual(val, cond);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) return +new Date(a as string) === +new Date(b as string);
  return a === b;
}
function toComparable(v: unknown): number | string {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && !isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}/.test(v)) return Date.parse(v);
  return v as number | string;
}

function resolveToOne(db: DB, model: string, row: Row, key: string, rel: RelationDef): Row | null {
  const reverse = REVERSE_ONE_TO_ONE[model]?.[key];
  if (reverse) {
    return (db[reverse.model] ?? []).find((r) => r[reverse.fk] === row.id) ?? null;
  }
  const fkVal = row[(rel as { fk: string }).fk];
  if (fkVal == null) return null;
  return (db[(rel as { model: string }).model] ?? []).find((r) => r.id === fkVal) ?? null;
}

function resolveToMany(db: DB, row: Row, rel: { model: string; fk: string }): Row[] {
  return (db[rel.model] ?? []).filter((r) => r[rel.fk] === row.id);
}

function matchWhereFor(db: DB, model: string, row: Row | null, where: Where): boolean {
  if (!where) return true;
  if (!row) return false;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Where[]).every((c) => matchWhereFor(db, model, row, c));
    if (key === "OR") return (cond as Where[]).some((c) => matchWhereFor(db, model, row, c));
    if (key === "NOT") return !matchWhereFor(db, model, row, cond as Where);

    const rel = RELATIONS[model]?.[key];
    if (rel) {
      if (rel.type === "toOne") {
        const related = resolveToOne(db, model, row, key, rel);
        return matchWhereFor(db, rel.model, related, cond as Where);
      }
      const items = resolveToMany(db, row, rel);
      const c = cond as { some?: Where; none?: Where; every?: Where } | undefined;
      if (c?.some) return items.some((it) => matchWhereFor(db, rel.model, it, c.some));
      if (c?.none) return !items.some((it) => matchWhereFor(db, rel.model, it, c.none));
      if (c?.every) return items.every((it) => matchWhereFor(db, rel.model, it, c.every));
      return true;
    }
    return matchScalar(row[key], cond);
  });
}

function applyOrderBy(rows: Row[], orderBy: OrderBy): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  const copy = [...rows];
  copy.sort((a, b) => {
    for (const spec of specs) {
      const [field, dir] = Object.entries(spec)[0] as [string, "asc" | "desc"];
      const av = a[field];
      const bv = b[field];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (av instanceof Date || bv instanceof Date) cmp = +new Date(av) - +new Date(bv);
      else if (typeof av === "number") cmp = av - (bv as number);
      else cmp = String(av).localeCompare(String(bv));
      if (dir === "desc") cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return copy;
}

function computeCounts(db: DB, model: string, row: Row, select: Record<string, boolean>) {
  const out: Record<string, number> = {};
  for (const key of Object.keys(select)) {
    const rel = RELATIONS[model]?.[key];
    if (rel && rel.type === "toMany") out[key] = resolveToMany(db, row, rel).length;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyInclude(db: DB, model: string, row: Row, include: Record<string, any>): Row {
  const out: Row = { ...row };
  for (const [key, spec] of Object.entries(include)) {
    if (key === "_count") {
      out._count = computeCounts(db, model, row, (spec as { select: Record<string, boolean> }).select);
      continue;
    }
    const rel = RELATIONS[model]?.[key];
    if (!rel) continue;
    const nested = isPlainObject(spec) ? spec : {};
    if (rel.type === "toOne") {
      let related = resolveToOne(db, model, row, key, rel);
      if (related && nested.include) related = applyInclude(db, rel.model, related, nested.include as Record<string, unknown>);
      if (related && nested.select) related = applySelect(db, rel.model, related, nested.select as Record<string, unknown>);
      out[key] = related ?? null;
    } else {
      let items = resolveToMany(db, row, rel);
      if (nested.where) items = items.filter((it) => matchWhereFor(db, rel.model, it, nested.where as Where));
      if (nested.orderBy) items = applyOrderBy(items, nested.orderBy as OrderBy);
      if (nested.include) items = items.map((it) => applyInclude(db, rel.model, it, nested.include as Record<string, unknown>));
      if (nested.select) items = items.map((it) => applySelect(db, rel.model, it, nested.select as Record<string, unknown>));
      if (typeof nested.take === "number") items = items.slice(0, nested.take);
      out[key] = items;
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySelect(db: DB, model: string, row: Row, select: Record<string, any>): Row {
  const out: Row = {};
  for (const [key, val] of Object.entries(select)) {
    if (key === "_count") {
      out._count = computeCounts(db, model, row, (val as { select: Record<string, boolean> }).select);
      continue;
    }
    const rel = RELATIONS[model]?.[key];
    if (rel && isPlainObject(val)) {
      if (rel.type === "toOne") {
        const related = resolveToOne(db, model, row, key, rel);
        out[key] = related
          ? val.select
            ? applySelect(db, rel.model, related, val.select as Record<string, unknown>)
            : val.include
              ? applyInclude(db, rel.model, related, val.include as Record<string, unknown>)
              : related
          : null;
      } else {
        out[key] = resolveToMany(db, row, rel);
      }
    } else {
      out[key] = row[key];
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchesUniqueWhere(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (isPlainObject(v)) return Object.entries(v).every(([k2, v2]) => valuesEqual(row[k2], v2));
    return valuesEqual(row[k], v);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryArgs {
  where?: Where;
  include?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: OrderBy;
  take?: number;
  skip?: number;
  data?: Row;
  update?: Row;
  create?: Row;
  by?: string[];
  _count?: Record<string, boolean>;
}

export function makeModel(db: DB, model: string) {
  const all = () => (db[model] ??= []);
  const findMatching = (where: Where) => all().filter((r) => matchWhereFor(db, model, r, where));

  function shape(row: Row | null, args?: QueryArgs): Row | null {
    if (!row) return null;
    let out = row;
    if (args?.include) out = applyInclude(db, model, out, args.include);
    if (args?.select) out = applySelect(db, model, out, args.select);
    return { ...out };
  }

  return {
    findMany: async (args: QueryArgs = {}): Promise<Row[]> => {
      let rows = args.where ? findMatching(args.where) : [...all()];
      rows = applyOrderBy(rows, args.orderBy);
      if (args.skip) rows = rows.slice(args.skip);
      if (typeof args.take === "number") rows = rows.slice(0, args.take);
      return rows.map((r) => shape(r, args) as Row);
    },
    findUnique: async (args: QueryArgs): Promise<Row | null> => {
      const row = all().find((r) => matchesUniqueWhere(r, args.where ?? {}));
      return shape(row ?? null, args);
    },
    findFirst: async (args: QueryArgs = {}): Promise<Row | null> => {
      let rows = args.where ? findMatching(args.where) : all();
      rows = applyOrderBy(rows, args.orderBy);
      return shape(rows[0] ?? null, args);
    },
    count: async (args: QueryArgs = {}): Promise<number> => (args.where ? findMatching(args.where) : all()).length,
    create: async (args: QueryArgs): Promise<Row> => {
      const row: Row = { id: genId(model), createdAt: new Date(), updatedAt: new Date(), ...args.data };
      all().push(row);
      return shape(row, args) as Row;
    },
    update: async (args: QueryArgs): Promise<Row> => {
      const row = all().find((r) => matchesUniqueWhere(r, args.where ?? {}));
      if (!row) throw new Error(`${model} not found`);
      Object.assign(row, args.data, "updatedAt" in row ? { updatedAt: new Date() } : {});
      return shape(row, args) as Row;
    },
    updateMany: async (args: QueryArgs): Promise<{ count: number }> => {
      const rows = args.where ? findMatching(args.where) : all();
      for (const r of rows) Object.assign(r, args.data, "updatedAt" in r ? { updatedAt: new Date() } : {});
      return { count: rows.length };
    },
    upsert: async (args: QueryArgs & { update: Row; create: Row }): Promise<Row> => {
      const row = all().find((r) => matchesUniqueWhere(r, args.where ?? {}));
      if (row) {
        Object.assign(row, args.update, "updatedAt" in row ? { updatedAt: new Date() } : {});
        return shape(row, args) as Row;
      }
      const created: Row = { id: genId(model), createdAt: new Date(), updatedAt: new Date(), ...args.create };
      all().push(created);
      return shape(created, args) as Row;
    },
    delete: async (args: QueryArgs): Promise<Row> => {
      const idx = all().findIndex((r) => matchesUniqueWhere(r, args.where ?? {}));
      if (idx === -1) throw new Error(`${model} not found`);
      const [row] = all().splice(idx, 1);
      return row;
    },
    deleteMany: async (args: QueryArgs = {}): Promise<{ count: number }> => {
      const rows = args.where ? findMatching(args.where) : [...all()];
      for (const r of rows) {
        const idx = all().indexOf(r);
        if (idx > -1) all().splice(idx, 1);
      }
      return { count: rows.length };
    },
    groupBy: async (args: QueryArgs): Promise<Row[]> => {
      const rows = args.where ? findMatching(args.where) : all();
      const byField = (args.by ?? [])[0];
      const groups = new Map<unknown, Row[]>();
      for (const r of rows) {
        const key = r[byField];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      return Array.from(groups.entries()).map(([key, items]) => {
        const result: Row = { [byField]: key };
        if (args._count) {
          result._count = {};
          for (const cf of Object.keys(args._count)) result._count[cf] = items.length;
        }
        return result;
      });
    },
  };
}
