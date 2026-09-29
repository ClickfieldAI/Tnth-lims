// Customer Master validation + normalization. Pure functions — shared by the
// form (inline validation) and the server service (authoritative validation).

export const CUSTOMER_TYPES = ["Individual", "Company", "Government", "Other"] as const;
export const GST_STATUSES = ["Registered", "Unregistered", "Not Applicable"] as const;
export const COMM_METHODS = ["Email", "Phone", "Other"] as const;
export const DELIVERY_METHODS = ["Email", "Client Portal", "Courier", "Hand Delivery", "Other"] as const;
export const DOC_TYPES = [
  "Customer Registration Documents", "GST Certificate", "Purchase Order", "Customer Agreement", "Other Supporting Documents",
] as const;

export interface AddressInput {
  line1: string; line2: string; city: string; district: string; state: string; pin: string; country: string;
}
export interface ReportingInput extends AddressInput {
  contactPerson: string; email: string; phone: string;
}

export interface CustomerInput {
  customerType: string;
  name: string;
  tradeName: string;
  industry: string;
  active: boolean;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  billing: AddressInput;
  reportingSameAsBilling: boolean;
  reporting: ReportingInput;
  gstStatus: string;
  gstNumber: string;
  panNumber: string;
  billingTerms: string;
  poRequired: boolean;
  poReference: string;
  taxNotes: string;
  preferredComm: string;
  preferredDelivery: string;
  handlingInstructions: string;
  testingRequirements: string;
  reportingInstructions: string;
  notes: string;
}

export const emptyAddress = (): AddressInput => ({ line1: "", line2: "", city: "", district: "", state: "", pin: "", country: "India" });

export const emptyCustomerInput = (): CustomerInput => ({
  customerType: "Company", name: "", tradeName: "", industry: "", active: true,
  contactPerson: "", designation: "", email: "", phone: "", alternatePhone: "", website: "",
  billing: emptyAddress(), reportingSameAsBilling: true,
  reporting: { ...emptyAddress(), contactPerson: "", email: "", phone: "" },
  gstStatus: "Unregistered", gstNumber: "", panNumber: "", billingTerms: "", poRequired: false, poReference: "", taxNotes: "",
  preferredComm: "Email", preferredDelivery: "Email", handlingInstructions: "", testingRequirements: "", reportingInstructions: "", notes: "",
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_RE = /^\d{6}$/;

export const isEmail = (v: string) => EMAIL_RE.test(v.trim());
export const isGst = (v: string) => GST_RE.test(v.trim().toUpperCase());
export const isPan = (v: string) => PAN_RE.test(v.trim().toUpperCase());

// Normalizes to "+<country><number>" (Indian 10-digit numbers get +91).
// Returns null when the value is not a plausible phone number.
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^[+\d\s()\-.]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}

export const normalizeName = (s: string) =>
  s.toLowerCase().replace(/\b(pvt|private|ltd|limited|llp|inc|co|company)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

export type FieldErrors = Record<string, string>;

const trimAddress = (a: AddressInput): AddressInput => ({
  line1: a.line1.trim(), line2: a.line2.trim(), city: a.city.trim(), district: a.district.trim(),
  state: a.state.trim(), pin: a.pin.trim(), country: a.country.trim(),
});

export function normalizeInput(i: CustomerInput): CustomerInput {
  const billing = trimAddress(i.billing);
  const rep = i.reportingSameAsBilling
    ? { ...billing, contactPerson: i.reporting.contactPerson.trim(), email: i.reporting.email.trim().toLowerCase(), phone: i.reporting.phone.trim() }
    : { ...trimAddress(i.reporting), contactPerson: i.reporting.contactPerson.trim(), email: i.reporting.email.trim().toLowerCase(), phone: i.reporting.phone.trim() };
  return {
    ...i,
    name: i.name.trim().replace(/\s+/g, " "), tradeName: i.tradeName.trim(), industry: i.industry.trim(),
    contactPerson: i.contactPerson.trim(), designation: i.designation.trim(),
    email: i.email.trim().toLowerCase(),
    phone: normalizePhone(i.phone) ?? i.phone.trim(),
    alternatePhone: i.alternatePhone.trim() ? normalizePhone(i.alternatePhone) ?? i.alternatePhone.trim() : "",
    website: i.website.trim(), billing, reporting: { ...rep, phone: rep.phone ? normalizePhone(rep.phone) ?? rep.phone : "" },
    gstNumber: i.gstNumber.trim().toUpperCase(), panNumber: i.panNumber.trim().toUpperCase(),
    billingTerms: i.billingTerms.trim(), poReference: i.poReference.trim(), taxNotes: i.taxNotes.trim(),
    handlingInstructions: i.handlingInstructions.trim(), testingRequirements: i.testingRequirements.trim(),
    reportingInstructions: i.reportingInstructions.trim(), notes: i.notes.trim(),
  };
}

export function validateCustomer(input: CustomerInput): FieldErrors {
  const i = normalizeInput(input);
  const e: FieldErrors = {};
  if (!(CUSTOMER_TYPES as readonly string[]).includes(i.customerType)) e.customerType = "Select a customer type.";
  if (!i.name) e.name = "Company / customer name is required.";
  else if (i.name.length < 2) e.name = "Name must be at least 2 characters.";
  if (!i.contactPerson) e.contactPerson = "Primary contact person is required.";
  if (!i.email) e.email = "Email address is required.";
  else if (!isEmail(i.email)) e.email = "Enter a valid email address.";
  if (!i.phone) e.phone = "Mobile number is required.";
  else if (!normalizePhone(i.phone)) e.phone = "Enter a valid phone number (10 digits, or with country code).";
  if (i.alternatePhone && !normalizePhone(i.alternatePhone)) e.alternatePhone = "Enter a valid phone number.";
  if (i.website && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(i.website)) e.website = "Enter a valid website address.";

  if (!i.billing.line1) e["billing.line1"] = "Address line 1 is required.";
  if (!i.billing.city) e["billing.city"] = "City is required.";
  if (!i.billing.state) e["billing.state"] = "State is required.";
  if (!i.billing.pin) e["billing.pin"] = "PIN code is required.";
  else if (i.billing.country.toLowerCase() === "india" && !PIN_RE.test(i.billing.pin)) e["billing.pin"] = "PIN code must be 6 digits.";
  if (!i.billing.country) e["billing.country"] = "Country is required.";

  if (!i.reportingSameAsBilling) {
    if (i.reporting.pin && i.reporting.country.toLowerCase() === "india" && !PIN_RE.test(i.reporting.pin)) e["reporting.pin"] = "PIN code must be 6 digits.";
  }
  if (i.reporting.email && !isEmail(i.reporting.email)) e["reporting.email"] = "Enter a valid email address.";
  if (i.reporting.phone && !normalizePhone(i.reporting.phone)) e["reporting.phone"] = "Enter a valid phone number.";

  if (!(GST_STATUSES as readonly string[]).includes(i.gstStatus)) e.gstStatus = "Select a GST registration status.";
  if (i.gstStatus === "Registered" && !i.gstNumber) e.gstNumber = "GST number is required for a registered customer.";
  if (i.gstNumber && !isGst(i.gstNumber)) e.gstNumber = "Invalid GST number format (e.g. 33ABCDE1234F1Z5).";
  if (i.panNumber && !isPan(i.panNumber)) e.panNumber = "Invalid PAN format (e.g. ABCDE1234F).";
  return e;
}
