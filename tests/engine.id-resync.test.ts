import { describe, it, expect } from "vitest";
import { genId, resyncIdCounters, type DB } from "@/lib/mock/engine";

describe("resyncIdCounters", () => {
  it("continues id generation after the highest id found in restored data, avoiding collisions", () => {
    const db: DB = { widget: [{ id: "widget_1" }, { id: "widget_7" }, { id: "widget_3" }] };
    resyncIdCounters(db);
    const next = genId("widget");
    expect(next).toBe("widget_8");
  });

  it("never lowers a counter that was already ahead", () => {
    // Simulate this process already having generated a few ids before resync runs.
    genId("thing");
    genId("thing");
    const beforeResync = genId("thing"); // thing_3
    expect(beforeResync).toBe("thing_3");

    const db: DB = { thing: [{ id: "thing_1" }] };
    resyncIdCounters(db);
    expect(genId("thing")).toBe("thing_4");
  });

  it("is a no-op for a model with no rows", () => {
    const db: DB = { empty: [] };
    resyncIdCounters(db);
    expect(genId("empty")).toBe("empty_1");
  });
});
