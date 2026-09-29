"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { CustomerError } from "@/lib/customers/access";
import {
  createCustomer, updateCustomer, setCustomerStatus, addContact, addDocument,
  type ContactInput, type DocumentMeta,
} from "@/lib/customers/service";
import type { CustomerInput } from "@/lib/customers/validation";

export interface CustomerActionResult {
  ok: boolean;
  id?: string;
  code?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicates?: { field: string; id: string; code: string; name: string }[];
}

function actor(user: Awaited<ReturnType<typeof requireUser>>) {
  return { id: user.id, role: user.role, clientId: user.clientId };
}

function toResult(e: unknown): CustomerActionResult {
  if (e instanceof CustomerError) {
    if (e.code === "VALIDATION") return { ok: false, error: e.message, fieldErrors: e.details as Record<string, string> };
    if (e.code === "DUPLICATE") return { ok: false, error: e.message, duplicates: (e.details as { matches: unknown[] })?.matches as never };
    return { ok: false, error: e.message };
  }
  console.error("[customers action]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createCustomerAction(input: CustomerInput, confirmDuplicate = false): Promise<CustomerActionResult> {
  const user = await requireUser();
  try {
    const res = await createCustomer(actor(user), input, { confirmDuplicate });
    revalidatePath("/clients");
    return { ok: true, id: res.id, code: res.code };
  } catch (e) {
    return toResult(e);
  }
}

export async function updateCustomerAction(id: string, input: CustomerInput, confirmDuplicate = false): Promise<CustomerActionResult> {
  const user = await requireUser();
  try {
    const res = await updateCustomer(actor(user), id, input, { confirmDuplicate });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, id: res.id, code: res.code };
  } catch (e) {
    return toResult(e);
  }
}

export async function setCustomerStatusAction(id: string, active: boolean, reason?: string): Promise<CustomerActionResult> {
  const user = await requireUser();
  try {
    await setCustomerStatus(actor(user), id, active, reason);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true };
  } catch (e) {
    return toResult(e);
  }
}

export async function addContactAction(customerId: string, input: ContactInput): Promise<CustomerActionResult> {
  const user = await requireUser();
  try {
    await addContact(actor(user), customerId, input);
    revalidatePath(`/clients/${customerId}`);
    return { ok: true };
  } catch (e) {
    return toResult(e);
  }
}

export async function addDocumentAction(customerId: string, meta: DocumentMeta): Promise<CustomerActionResult> {
  const user = await requireUser();
  try {
    await addDocument(actor(user), customerId, meta);
    revalidatePath(`/clients/${customerId}`);
    return { ok: true };
  } catch (e) {
    return toResult(e);
  }
}
