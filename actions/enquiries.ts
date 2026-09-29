"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { EnquiryError } from "@/lib/enquiries/access";
import {
  createEnquiry, updateEnquiry, closeEnquiry,
  createQuotation, updateQuotationDraft, submitQuotationForApproval, approveQuotation, rejectQuotation,
  sendQuotation, createQuotationRevision, recordAcceptance, recordRejection, getQuotation,
  type AcceptanceInput,
} from "@/lib/enquiries/service";
import type { EnquiryInput, QuotationDraftInput } from "@/lib/enquiries/validation";
import type { QuotationPdfData } from "@/lib/quotation-pdf";

export interface EnquiryActionResult {
  ok: boolean;
  id?: string;
  code?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): EnquiryActionResult {
  if (e instanceof EnquiryError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[enquiries action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createEnquiryAction(input: EnquiryInput): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    const res = await createEnquiry(actor(user), input);
    revalidatePath("/enquiries");
    return { ok: true, id: res.id, code: res.code };
  } catch (e) { return toResult(e); }
}

export async function updateEnquiryAction(id: string, input: EnquiryInput): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    const res = await updateEnquiry(actor(user), id, input);
    revalidatePath("/enquiries"); revalidatePath(`/enquiries/${id}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) { return toResult(e); }
}

export async function closeEnquiryAction(id: string, reason: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await closeEnquiry(actor(user), id, reason);
    revalidatePath("/enquiries"); revalidatePath(`/enquiries/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function createQuotationAction(enquiryId: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    const res = await createQuotation(actor(user), enquiryId);
    revalidatePath("/quotations"); revalidatePath(`/enquiries/${enquiryId}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) { return toResult(e); }
}

export async function updateQuotationDraftAction(id: string, input: QuotationDraftInput): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await updateQuotationDraft(actor(user), id, input);
    revalidatePath(`/quotations/${id}`);
    return { ok: true, id };
  } catch (e) { return toResult(e); }
}

export async function submitQuotationForApprovalAction(id: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await submitQuotationForApproval(actor(user), id);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function approveQuotationAction(id: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await approveQuotation(actor(user), id);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function rejectQuotationAction(id: string, reason: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await rejectQuotation(actor(user), id, reason);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function sendQuotationAction(id: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await sendQuotation(actor(user), id);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function createQuotationRevisionAction(id: string, reason: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    const res = await createQuotationRevision(actor(user), id, reason);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`); revalidatePath(`/quotations/${res.id}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) { return toResult(e); }
}

export async function recordAcceptanceAction(id: string, input: AcceptanceInput): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await recordAcceptance(actor(user), id, input);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`); revalidatePath("/enquiries");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function recordRejectionAction(id: string, reason: string): Promise<EnquiryActionResult> {
  const user = await requireUser();
  try {
    await recordRejection(actor(user), id, reason);
    revalidatePath("/quotations"); revalidatePath(`/quotations/${id}`); revalidatePath("/enquiries");
    return { ok: true };
  } catch (e) { return toResult(e); }
}

// Used by the client-side PDF export button — mirrors actions/reports.ts's
// getReportPdfData pattern. Enforces the same view permission/scoping as the
// details page (never trust a client-supplied quotation snapshot for the PDF).
export async function getQuotationPdfData(id: string): Promise<QuotationPdfData | null> {
  const user = await requireUser();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = await getQuotation(actor(user), id) as any;
    return {
      quotationCode: q.quotationCode, revisionNumber: q.revisionNumber,
      quotationDate: new Date(q.quotationDate).toLocaleDateString("en-GB"),
      validUntil: new Date(q.validUntil).toLocaleDateString("en-GB"),
      enquiryCode: q.enquiry?.enquiryCode ?? "—", customerCode: q.customer?.code ?? "—",
      customerName: q.customer?.name ?? "—", contactPerson: q.customer?.contactPerson ?? "—",
      billingAddress: q.customer?.billing ? [q.customer.billing.line1, q.customer.billing.city, q.customer.billing.state, q.customer.billing.pin].filter(Boolean).join(", ") : "—",
      gstNumber: q.customer?.gstNumber ?? "", customerEmail: q.customer?.email ?? "—", customerPhone: q.customer?.phone ?? "—",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (q.items as any[]).map((it, i) => ({
        slNo: i + 1, productReference: it.productReference, serviceName: it.serviceName, method: it.method ?? "",
        quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount, taxAmount: it.taxAmount, lineTotal: it.lineTotal,
      })),
      subtotal: q.subtotal, discountTotal: q.discountTotal, taxableAmount: q.taxableAmount, taxTotal: q.taxTotal, grandTotal: q.grandTotal,
      currency: q.currency,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      estimatedTurnaroundDays: Math.max(0, ...(q.items as any[]).map((it) => it.estimatedTurnaroundDays ?? 0)) || 7,
      paymentTerms: q.paymentTerms ?? "", status: q.status,
    };
  } catch {
    return null;
  }
}
