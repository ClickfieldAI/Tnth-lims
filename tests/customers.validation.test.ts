import { describe, it, expect } from "vitest";
import {
  validateCustomer, emptyCustomerInput, normalizePhone, isGst, isPan, normalizeName,
} from "@/lib/customers/validation";

function base() {
  const i = emptyCustomerInput();
  i.name = "Acme Foods Pvt Ltd";
  i.contactPerson = "Jane Doe";
  i.email = "jane@acme.example";
  i.phone = "9840012345";
  i.billing = { line1: "1 Main Rd", line2: "", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pin: "600001", country: "India" };
  return i;
}

describe("phone normalization", () => {
  it("adds +91 to a bare 10-digit Indian number", () => {
    expect(normalizePhone("9840012345")).toBe("+919840012345");
  });
  it("accepts an already-prefixed number", () => {
    expect(normalizePhone("+1 415 555 0100")).toBe("+14155550100");
  });
  it("rejects garbage input", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("GST/PAN format checks", () => {
  it("validates a well-formed GST number", () => {
    expect(isGst("33AABCS1234F1Z5")).toBe(true);
    expect(isGst("not-a-gst")).toBe(false);
  });
  it("validates a well-formed PAN", () => {
    expect(isPan("AABCS1234F")).toBe(true);
    expect(isPan("12345")).toBe(false);
  });
});

describe("normalizeName for duplicate detection", () => {
  it("strips common legal suffixes and punctuation", () => {
    expect(normalizeName("Acme Foods Pvt. Ltd.")).toBe(normalizeName("ACME FOODS"));
  });
});

describe("validateCustomer", () => {
  it("passes for a fully valid customer", () => {
    expect(validateCustomer(base())).toEqual({});
  });
  it("requires name, contact, email, phone", () => {
    const errors = validateCustomer(emptyCustomerInput());
    expect(errors.name).toBeTruthy();
    expect(errors.contactPerson).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
  });
  it("rejects a malformed email", () => {
    const i = base(); i.email = "not-an-email";
    expect(validateCustomer(i).email).toBeTruthy();
  });
  it("requires GST number when GST status is Registered", () => {
    const i = base(); i.gstStatus = "Registered"; i.gstNumber = "";
    expect(validateCustomer(i).gstNumber).toBeTruthy();
  });
  it("does not require GST/PAN when unregistered", () => {
    const i = base(); i.gstStatus = "Unregistered";
    expect(validateCustomer(i).gstNumber).toBeUndefined();
  });
  it("flags an invalid PIN code for an Indian address", () => {
    const i = base(); i.billing.pin = "123";
    expect(validateCustomer(i)["billing.pin"]).toBeTruthy();
  });
});
