import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSubcategory } from "@/lib/industries";
import { prisma } from "@/lib/prisma";
import { HubTopbar } from "@/components/layout/hub-topbar";
import { StatCard } from "@/components/ui/display";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; sub: string }> }) {
  const { slug, sub } = await params;
  const found = getSubcategory(slug, sub);
  return { title: found ? found.sub.name : "Service" };
}

export default async function SubcategoryPage({ params }: { params: Promise<{ slug: string; sub: string }> }) {
  const { slug, sub } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/client");

  const found = getSubcategory(slug, sub);
  if (!found) notFound();
  const { industry, sub: subcategory } = found;

  const tests = await prisma.test.findMany({
    where: { type: subcategory.testType },
    include: { sample: { include: { client: true } }, assignedTo: true },
    orderBy: { createdAt: "desc" },
  });

  const inProgress = tests.filter((t) => ["ASSIGNED", "TESTING", "REVIEW"].includes(t.status)).length;
  const completed = tests.filter((t) => ["APPROVED", "RELEASED"].includes(t.status)).length;
  const passCount = tests.filter((t) => t.resultStatus === "PASS" || t.result === "PASS").length;
  const failCount = tests.filter((t) => t.resultStatus === "FAIL" || t.result === "FAIL").length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <HubTopbar user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }} />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-8 py-10">
        <Link href={`/industries/${industry.slug}`} className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> {industry.name}
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{industry.name}</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{subcategory.name}</h1>
            </div>
          </div>
          <Link
            href={`/samples/new?industry=${industry.slug}&sub=${subcategory.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Register sample
          </Link>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total requests" value={tests.length} icon={<FlaskConical className="h-4 w-4" />} tone="indigo" />
          <StatCard label="In progress" value={inProgress} tone="amber" />
          <StatCard label="Completed" value={completed} tone="green" />
          <StatCard label="Pass / Fail" value={`${passCount} / ${failCount}`} tone={failCount ? "red" : "slate"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Test requests</h3>
              <p className="text-xs text-slate-500">{subcategory.description}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5">Request</th>
                    <th className="px-5 py-2.5">Sample</th>
                    <th className="px-5 py-2.5">Client</th>
                    <th className="px-5 py-2.5">Analyst</th>
                    <th className="px-5 py-2.5">Received</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tests.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/testing/worksheet/${t.id}`} className="font-medium text-brand-600 hover:underline">{t.requestCode}</Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/samples/${t.sampleId}`} className="text-slate-700 hover:underline">{t.sample.sampleCode}</Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{t.sample.client.name}</td>
                      <td className="px-5 py-3 text-slate-500">{t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned"}</td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(t.sample.receivedDate)}</td>
                      <td className="px-5 py-3"><StatusBadge status={t.status} dot /></td>
                    </tr>
                  ))}
                  {!tests.length ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">No requests yet — register a sample to get started.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Techniques &amp; methods</p>
              <div className="flex flex-wrap gap-2">
                {subcategory.techniques.map((t) => (
                  <span key={t} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">{t}</span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Other services in {industry.name}</p>
              <div className="flex flex-col gap-1">
                {industry.subcategories.filter((s) => s.slug !== subcategory.slug).map((s) => (
                  <Link
                    key={s.slug}
                    href={`/industries/${industry.slug}/${s.slug}`}
                    className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
