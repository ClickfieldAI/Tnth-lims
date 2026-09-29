import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getTrf } from "@/lib/trfs/service";
import { TrfError, canTrf } from "@/lib/trfs/access";
import { PageHeader } from "@/components/ui/display";
import { TrfWizard } from "./trf-wizard";

export const metadata = { title: "Edit TRF Draft" };

export default async function EditTrfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role, clientId: user.clientId };
  if (!canTrf(actor, "edit")) redirect(`/trfs/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any;
  try {
    t = await getTrf(actor, id);
  } catch (e) {
    if (e instanceof TrfError && e.code === "NOT_FOUND") notFound();
    redirect("/trfs");
  }
  if (t.status !== "DRAFT") redirect(`/trfs/${id}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={`/trfs/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to draft
      </Link>
      <PageHeader title="Complete Test Request Form" description={`${t.customer?.name} · Quotation ${t.quotation?.quotationCode}`} />
      <TrfWizard
        trfId={id}
        customerSummary={{ code: t.customer?.code ?? "", name: t.customer?.name ?? "", contactPerson: t.customer?.contactPerson ?? "" }}
        quotationSummary={{ quotationCode: t.quotation?.quotationCode ?? "", grandTotal: t.acceptedChargesSnapshot ?? 0, paymentTerms: t.paymentTermsSnapshot ?? "" }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialSamples={(t.samples as any[]).map((s) => ({
          id: s.id, sampleName: s.sampleName, productCategory: s.productCategory, brandName: s.brandName, batchNumber: s.batchNumber,
          customerSampleRef: s.customerSampleRef, quantity: s.quantity, quantityUnit: s.quantityUnit, containers: s.containers,
          packagingType: s.packagingType, manufacturer: s.manufacturer,
          manufacturingDate: s.manufacturingDate ? new Date(s.manufacturingDate).toISOString().slice(0, 10) : undefined,
          expiryDate: s.expiryDate ? new Date(s.expiryDate).toISOString().slice(0, 10) : undefined,
          declaredComposition: s.declaredComposition, labelClaim: s.labelClaim, productDescription: s.productDescription,
          sampledBy: s.sampledBy, samplingDate: s.samplingDate ? new Date(s.samplingDate).toISOString().slice(0, 10) : undefined,
          samplingLocation: s.samplingLocation, samplingProcedure: s.samplingProcedure,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tests: (s.tests as any[]).map((test) => ({
            serviceId: test.serviceId ?? "", customRequest: test.customRequest, customServiceName: test.customServiceName,
            requestedParameter: test.requestedParameter, preferredMethod: test.preferredMethod, specification: test.specification,
            testingPurpose: test.testingPurpose, requiredQuantity: test.requiredQuantity, customerRequirements: test.customerRequirements,
            subcontractingPreference: test.subcontractingPreference,
          })),
        }))}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialDocuments={(t.documents as any[]).map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName, sizeBytes: d.sizeBytes }))}
        initialStep4={{
          priority: t.priority, requestedDueDate: t.requestedDueDate ? new Date(t.requestedDueDate).toISOString().slice(0, 10) : "",
          agreedTurnaroundDays: t.agreedTurnaroundDays ?? undefined, specialDeadlineInstructions: t.specialDeadlineInstructions,
          storageCondition: t.storageCondition, storageTemperature: t.storageTemperature, specialHandlingInstructions: t.specialHandlingInstructions,
          lightSensitive: t.lightSensitive, moistureSensitive: t.moistureSensitive, otherStorageNotes: t.otherStorageNotes,
          reportRecipient: t.reportRecipient, reportEmail: t.reportEmail, reportingUnits: t.reportingUnits, reportLanguage: t.reportLanguage,
          conformityStatementRequested: t.conformityStatementRequested, applicableSpecification: t.applicableSpecification,
          reportingInstructions: t.reportingInstructions,
        }}
        initialAuthorization={{
          status: t.authorization?.status ?? "NOT_AUTHORIZED", authorizedPersonName: t.authorization?.authorizedPersonName,
          authorizedPersonDesignation: t.authorization?.authorizedPersonDesignation,
          authorizationDate: t.authorization?.authorizationDate ? new Date(t.authorization.authorizationDate).toISOString().slice(0, 10) : undefined,
          authorizationMethod: t.authorization?.authorizationMethod, notes: t.authorization?.notes,
        }}
      />
    </div>
  );
}
