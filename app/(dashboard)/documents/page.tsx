import { FolderKanban, FileCheck2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { DataTable, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NewDocumentButton } from "./new-document";
import { DocumentActions } from "./document-actions";

export const metadata = { title: "Documents" };

const CATEGORY_TONE: Record<string, string> = {
  SOP: "blue", TEST_METHOD: "violet", COA: "green",
  VALIDATION: "amber", CALIBRATION_CERTIFICATE: "indigo", POLICY: "slate",
};

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  const canApprove = user?.role === "ADMIN" || user?.role === "QA" || user?.role === "MANAGER";
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: true, previousVersion: { select: { docCode: true, version: true } } },
    take: 100,
  });

  const approved = docs.filter((d) => d.status === "APPROVED").length;
  const drafts = docs.filter((d) => d.status === "DRAFT").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Document Management"
        description="Controlled SOPs, test methods, validation packages and certificates with version control and digital approval."
        image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=640&q=65&auto=format&fit=crop"
        actions={<NewDocumentButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total controlled documents" value={docs.length} icon={<FolderKanban className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Approved" value={approved} tone="green" icon={<FileCheck2 className="h-4 w-4" />} />
        <StatCard label="In draft" value={drafts} tone="amber" />
        <StatCard label="Categories" value={new Set(docs.map((d) => d.category)).size} tone="slate" />
      </div>

      <DataTable>
        <THead>
          <Th>Document</Th><Th>Title</Th><Th>Category</Th><Th>Version</Th><Th>Owner</Th><Th>Approved</Th><Th>Status</Th><Th>Action</Th>
        </THead>
        <TBody>
          {docs.map((d) => (
            <Tr key={d.id}>
              <Td className="font-mono text-[11px] font-medium">{d.docCode}</Td>
              <Td className="max-w-[280px] truncate">{d.title}</Td>
              <Td><Badge tone={CATEGORY_TONE[d.category] ?? "slate"}>{d.category.replace(/_/g, " ")}</Badge></Td>
              <Td>
                v{d.version}
                {d.previousVersion ? (
                  <span className="ml-1 text-[10px] text-slate-400">(from v{d.previousVersion.version})</span>
                ) : null}
              </Td>
              <Td>{d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "—"}</Td>
              <Td className="text-xs">{formatDate(d.approvedAt)}</Td>
              <Td><StatusBadge status={d.status} dot /></Td>
              <Td><DocumentActions docId={d.id} status={d.status} canApprove={canApprove} /></Td>
            </Tr>
          ))}
          {!docs.length ? <TableEmpty colSpan={8} message="No documents uploaded." /> : null}
        </TBody>
      </DataTable>
    </div>
  );
}