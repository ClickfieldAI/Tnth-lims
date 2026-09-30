"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { RegistrationError, canRegistration } from "@/lib/registration/access";
import {
  registerSample, cancelSampleRegistration, updateSampleStorage, getSampleRegistrationData,
} from "@/lib/registration/service";
import { generateSampleBarcodeDataUrl } from "@/lib/registration/barcode";
import type { RegisterSampleInput, StorageUpdateInput } from "@/lib/registration/validation";
import type { SampleLabelData } from "@/lib/sample-label-pdf";
import type { SampleAcknowledgementData } from "@/lib/sample-acknowledgement-pdf";
import { formatDate, formatDateTime } from "@/lib/utils";

export interface RegistrationActionResult {
  ok: boolean;
  id?: string;
  sampleCode?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): RegistrationActionResult {
  if (e instanceof RegistrationError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    return { ok: false, error: e.message };
  }
  console.error("[registration action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function registerSampleAction(trfSampleId: string, input: RegisterSampleInput): Promise<RegistrationActionResult> {
  const user = await requireUser();
  try {
    const res = await registerSample(actor(user), trfSampleId, input);
    revalidatePath("/sample-registration"); revalidatePath(`/sample-registration/${trfSampleId}`);
    return { ok: true, id: res.id, sampleCode: res.sampleCode };
  } catch (e) { return toResult(e); }
}

export async function cancelSampleRegistrationAction(registrationId: string, trfSampleId: string, reason: string): Promise<RegistrationActionResult> {
  const user = await requireUser();
  try {
    await cancelSampleRegistration(actor(user), registrationId, reason);
    revalidatePath("/sample-registration"); revalidatePath(`/sample-registration/${trfSampleId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function updateSampleStorageAction(registrationId: string, trfSampleId: string, input: StorageUpdateInput): Promise<RegistrationActionResult> {
  const user = await requireUser();
  try {
    await updateSampleStorage(actor(user), registrationId, input);
    revalidatePath(`/sample-registration/${trfSampleId}`);
    return { ok: true };
  } catch (e) { return toResult(e); }
}

export async function generateSampleLabelData(trfSampleId: string): Promise<SampleLabelData | null> {
  const user = await requireUser();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = await getSampleRegistrationData(actor(user), trfSampleId) as any;
    if (!sample.registration || sample.registration.registrationStatus !== "REGISTERED") return null;
    const barcodeDataUrl = await generateSampleBarcodeDataUrl(sample.registration.sampleCode);
    return {
      sampleCode: sample.registration.sampleCode, productName: sample.sampleName, batchNumber: sample.batchNumber,
      customerSampleRef: sample.customerSampleRef, receivedDate: sample.receipt ? formatDate(sample.receipt.receivedAt) : "—",
      storageCondition: sample.registration.storageCondition,
      handlingWarning: sample.specialHandlingInstructions || undefined,
      barcodeDataUrl,
    };
  } catch {
    return null;
  }
}

export async function generateSampleAcknowledgementData(trfSampleId: string): Promise<SampleAcknowledgementData | null> {
  const user = await requireUser();
  if (!canRegistration(actor(user), "print")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = await getSampleRegistrationData(actor(user), trfSampleId) as any;
    if (!sample.registration || sample.registration.registrationStatus !== "REGISTERED") return null;
    const barcodeDataUrl = await generateSampleBarcodeDataUrl(sample.registration.sampleCode);
    return {
      acknowledgementNumber: `ACK-${sample.registration.sampleCode.replace("SPL-", "")}`,
      sampleCode: sample.registration.sampleCode, trfCode: sample.trf.trfCode,
      customerName: sample.trf.customer.name, customerCode: sample.trf.customer.code,
      productName: sample.sampleName, batchNumber: sample.batchNumber, customerSampleRef: sample.customerSampleRef,
      quantity: `${sample.quantity} ${sample.quantityUnit}`, containers: sample.containers,
      receivedAt: sample.receipt ? formatDateTime(sample.receipt.receivedAt) : "—",
      registeredAt: formatDateTime(sample.registration.registeredAt),
      registeredByName: sample.registration.registeredBy ? `${sample.registration.registeredBy.firstName} ${sample.registration.registeredBy.lastName}` : "—",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestedTests: (sample.tests as any[]).map((t) => t.customRequest ? t.customServiceName : t.requestedParameter),
      storageCondition: sample.registration.storageCondition, storageLocation: sample.registration.storageLocation,
      remarks: sample.registration.remarks, barcodeDataUrl,
    };
  } catch {
    return null;
  }
}
