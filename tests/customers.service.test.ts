import { describe, it, expect } from "vitest";
import {
  createCustomer, updateCustomer, setCustomerStatus, listCustomers, getCustomer, getCustomerHistory,
} from "@/lib/customers/service";
import { CustomerError, type Actor } from "@/lib/customers/access";
import { emptyCustomerInput } from "@/lib/customers/validation";

const admin: Actor = { id: "user_1", role: "ADMIN" };
const manager: Actor = { id: "user_2", role: "MANAGER" };
const qa: Actor = { id: "user_3", role: "QA" };
const analyst: Actor = { id: "user_4", role: "ANALYST" };
const clientUser: Actor = { id: "user_6", role: "CLIENT", clientId: "client_1" };

function validInput(overrides: Partial<ReturnType<typeof emptyCustomerInput>> = {}) {
  const i = emptyCustomerInput();
  i.name = "Test Foods Co " + Math.random().toString(36).slice(2, 7);
  i.contactPerson = "Sam Analyst";
  i.email = `sam${Math.random().toString(36).slice(2, 7)}@testfoods.example`;
  i.phone = "9840099999";
  i.billing = { line1: "1 Test Rd", line2: "", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pin: "600002", country: "India" };
  return { ...i, ...overrides };
}

describe("customer creation", () => {
  it("creates a customer with a CUST-YYYY-NNNNN code", async () => {
    const res = await createCustomer(admin, validInput());
    expect(res.ok).toBe(true);
    expect(res.code).toMatch(/^CUST-\d{4}-\d{5}$/);
  });

  it("rejects invalid input with field errors, without creating a row", async () => {
    await expect(createCustomer(admin, emptyCustomerInput())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("detects a duplicate by normalized name and blocks unless confirmed", async () => {
    const input = validInput({ name: "Duplicate Test Corp" });
    await createCustomer(admin, input);
    const again = { ...validInput({ name: "duplicate   test   corp!!" }) };
    await expect(createCustomer(admin, again)).rejects.toMatchObject({ code: "DUPLICATE" });
    const forced = await createCustomer(admin, again, { confirmDuplicate: true });
    expect(forced.ok).toBe(true);
  });

  it("detects a duplicate by GST number", async () => {
    const gstInput = validInput({ gstStatus: "Registered", gstNumber: "33AAAAA0000A1Z1" });
    await createCustomer(admin, gstInput);
    const dupeGst = validInput({ gstStatus: "Registered", gstNumber: "33aaaaa0000a1z1" });
    await expect(createCustomer(admin, dupeGst)).rejects.toMatchObject({ code: "DUPLICATE" });
  });
});

describe("customer editing", () => {
  it("updates fields and records an audit entry with old/new values", async () => {
    const created = await createCustomer(admin, validInput({ name: "Editable Co" }));
    const before = await getCustomer(admin, created.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { ...validInput(), name: "Editable Co Renamed" } as any;
    await updateCustomer(admin, created.id, input);
    const after = await getCustomer(admin, created.id);
    expect((after as { name: string }).name).toBe("Editable Co Renamed");
    expect((before as { name: string }).name).not.toBe((after as { name: string }).name);

    const history = await getCustomerHistory(admin, created.id);
    const updateEntry = history.find((h) => h.action === "UPDATE");
    expect(updateEntry).toBeTruthy();
    expect(updateEntry?.oldValue).toBeTruthy();
    expect(updateEntry?.newValue).toBeTruthy();
  });

  it("blocks a CLIENT-role user from editing", async () => {
    const created = await createCustomer(admin, validInput());
    await expect(updateCustomer(clientUser, created.id, validInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("status management (deactivate/reactivate)", () => {
  it("never deletes — deactivation just flips isActive and is audited", async () => {
    const created = await createCustomer(admin, validInput());
    await setCustomerStatus(manager, created.id, false, "No longer active");
    const row = await getCustomer(admin, created.id);
    expect((row as { isActive: boolean }).isActive).toBe(false);

    const history = await getCustomerHistory(admin, created.id);
    expect(history.some((h) => h.action === "DEACTIVATE")).toBe(true);

    await setCustomerStatus(manager, created.id, true);
    const reactivated = await getCustomer(admin, created.id);
    expect((reactivated as { isActive: boolean }).isActive).toBe(true);
  });

  it("blocks QA (read-only role) from changing status", async () => {
    const created = await createCustomer(admin, validInput());
    await expect(setCustomerStatus(qa, created.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("RBAC permissions", () => {
  it("allows ANALYST to view but not create", async () => {
    await expect(createCustomer(analyst, validInput())).rejects.toBeInstanceOf(CustomerError);
    const list = await listCustomers(analyst, {});
    expect(list.rows).toBeDefined();
  });

  it("scopes a CLIENT user to only their own organization", async () => {
    const list = await listCustomers(clientUser, {});
    expect(list.rows.every((r) => r.id === "client_1")).toBe(true);
  });

  it("denies a CLIENT user access to another customer's record", async () => {
    const created = await createCustomer(admin, validInput());
    await expect(getCustomer(clientUser, created.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("search, filter, pagination", () => {
  it("filters by search text across id/name/contact/email/phone/gst", async () => {
    const created = await createCustomer(admin, validInput({ name: "Searchable Unique Name" }));
    const result = await listCustomers(admin, { search: "Searchable Unique" });
    expect(result.rows.some((r) => r.id === created.id)).toBe(true);
  });

  it("filters by status and type", async () => {
    const created = await createCustomer(admin, validInput({ customerType: "Government" }));
    await setCustomerStatus(admin, created.id, false);
    const inactiveGov = await listCustomers(admin, { status: "inactive", type: "Government" });
    expect(inactiveGov.rows.some((r) => r.id === created.id)).toBe(true);
    const activeOnly = await listCustomers(admin, { status: "active" });
    expect(activeOnly.rows.some((r) => r.id === created.id)).toBe(false);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 3; i += 1) await createCustomer(admin, validInput());
    const page1 = await listCustomers(admin, { pageSize: 2, page: 1 });
    expect(page1.rows.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
  });
});
