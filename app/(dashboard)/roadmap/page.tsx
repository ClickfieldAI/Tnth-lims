import {
  CheckCircle2, UploadCloud, ClipboardList, Calculator, Wallet,
  GitBranch, MapPin, Users, ShieldCheck, Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { PageHeader, StatCard } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Product Roadmap" };

// Phase 1 — already delivered and live (the full testing workflow).
const DELIVERED = [
  "Customer master, enquiries & quotations",
  "Digital TRF linked to accepted quotations",
  "Sample receipt, technical review & registration (barcoded)",
  "Test allocation, worksheets & result entry",
  "Technical verification & draft CoA generation",
  "QA review, authorised release & customer delivery",
  "Retention & disposal, corrections & amendments",
  "Deviations, CAPA, change control & instruments",
  "Role-based access, client portal & full audit trail",
];

// Phase 2 — planned depth enhancements for full NABL production use.
const PHASE_TWO = [
  {
    icon: UploadCloud,
    title: "Document & photo storage",
    tone: "blue",
    desc: "Secure upload and storage of signed TRFs, sample photographs, instrument output files, specifications and SDS — attached directly to the relevant record.",
  },
  {
    icon: ClipboardList,
    title: "Detailed controlled worksheets",
    tone: "indigo",
    desc: "Method-specific worksheets with reagent/standard/media lot tracking, raw-observation fields, QC blanks & replicates, and calculation sections — version-controlled per template.",
  },
  {
    icon: Calculator,
    title: "Advanced result entry",
    tone: "violet",
    desc: "Controlled formula engine with automatic calculation from raw data, parameter-specific rounding rules, LOD/LOQ handling, controlled result types (Absent / Not detected / <LOQ) and specification-version selection.",
  },
  {
    icon: Wallet,
    title: "Payment tracking & delivery holds",
    tone: "amber",
    desc: "Advance / part-paid / paid tracking kept separate from scientific status, with automated commercial delivery holds until payment rules are met.",
  },
  {
    icon: GitBranch,
    title: "Method, formula & specification version control",
    tone: "green",
    desc: "Preserve the exact method, worksheet template, formula and specification version used for every test, for full traceability.",
  },
  {
    icon: MapPin,
    title: "Sample movement & aliquot log",
    tone: "slate",
    desc: "Track storage location, aliquots, transfers and remaining quantity across each sample's lifecycle.",
  },
  {
    icon: Users,
    title: "Expanded roles",
    tone: "blue",
    desc: "Finer-grained roles including Accounts and Section Head, mapped to your approved standard operating procedures.",
  },
  {
    icon: ShieldCheck,
    title: "Formal validation pack (CSV)",
    tone: "emerald",
    desc: "Computer-system-validation documentation, data-migration checks and system-verification evidence for accreditation readiness.",
  },
];

export default async function RoadmapPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Product Roadmap"
        title="Phased delivery plan"
        description="Phase 1 — the complete testing workflow — is built and live. Phase 2 adds depth within selected stages to reach full NABL production readiness."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workflow stages live" value="16 / 16" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" sub="Phase 1 — delivered" />
        <StatCard label="Supporting modules live" value="9+" icon={<Sparkles className="h-4 w-4" />} tone="indigo" sub="QA, instruments, portal, audit…" />
        <StatCard label="Phase 2 enhancements" value={PHASE_TWO.length} icon={<ClipboardList className="h-4 w-4" />} tone="amber" sub="Planned depth upgrades" />
        <StatCard label="Platform" value="Cloud" icon={<ShieldCheck className="h-4 w-4" />} tone="blue" sub="Live, secure, persistent" />
      </div>

      {/* Phase 1 — delivered */}
      <Card>
        <CardHeader
          title="Phase 1 — Delivered & live"
          subtitle="Running end-to-end on the live system today"
          action={<Badge tone="green">Live</Badge>}
        />
        <CardContent>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {DELIVERED.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-[13.5px] text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Phase 2 — planned */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-brand-600">Phase 2 — Planned enhancements</h2>
          <Badge tone="amber">On the roadmap</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHASE_TWO.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title}>
                <CardContent className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold tracking-tight text-[#1a1d1a]">{item.title}</h3>
                      <Badge tone={item.tone}>Planned</Badge>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <p className="px-1 pb-2 text-xs text-slate-400">
        Scope and sequencing of Phase 2 will be confirmed with the laboratory team based on priority and your approved procedures.
      </p>
    </div>
  );
}
