import Link from "next/link";
import { FlaskConical, FileText, Receipt, MessageSquare, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Client portal" };

export default async function ClientHomePage() {
  const user = await getCurrentUser();
  const clientId = user?.clientId;
  if (!clientId) {
    return <p className="text-sm text-slate-500">No client company is linked to this account.</p>;
  }

  const [samples, reports, invoices, messages] = await Promise.all([
    prisma.sample.findMany({ where: { clientId }, orderBy: { receivedDate: "desc" }, take: 6 }),
    prisma.testReport.count({ where: { sample: { clientId } } }),
    prisma.invoice.findMany({ where: { clientId }, orderBy: { issuedAt: "desc" }, take: 3 }),
    prisma.message.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const inProgress = samples.filter((s) => ["TESTING", "ASSIGNED", "REVIEW"].includes(s.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.firstName}`}
        description="Track your testing progress, download approved reports and manage invoices."
        actions={
          <Link href="/client/samples/new" className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Submit a sample
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total samples" value={samples.length} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" />
        <StatCard label="In testing now" value={inProgress} tone="amber" />
        <StatCard label="Reports available" value={reports} icon={<FileText className="h-4 w-4" />} tone="green" />
        <StatCard label="Open invoices" value={invoices.filter((i) => i.status === "UNPAID").length} icon={<Receipt className="h-4 w-4" />} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent samples" subtitle="Latest submissions and their live status"
            action={<Link href="/client/samples" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>} />
          <div className="divide-y divide-slate-100">
            {samples.map((s) => (
              <Link key={s.id} href="/client/samples" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.sampleCode}</p>
                  <p className="text-xs text-slate-500">{s.productName ?? "—"} · received {formatDate(s.receivedDate)}</p>
                </div>
                <StatusBadge status={s.status} dot />
              </Link>
            ))}
            {!samples.length ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No samples yet — submit your first sample to begin testing.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Messages" subtitle="Laboratory communication"
            action={<Link href="/client/messages" className="text-xs font-medium text-indigo-600 hover:underline"><MessageSquare className="h-3.5 w-3.5" /></Link>} />
          <div className="divide-y divide-slate-100">
            {messages.map((m) => (
              <div key={m.id} className="px-5 py-3">
                <p className={`line-clamp-2 text-xs ${m.fromClient ? "text-slate-700" : "font-medium text-indigo-700"}`}>{m.body}</p>
                <p className="mt-1 text-[10.5px] text-slate-400">{formatDate(m.createdAt)}</p>
              </div>
            ))}
            {!messages.length ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">No messages.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}