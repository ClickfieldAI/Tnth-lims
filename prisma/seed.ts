// PharmaLIMS seed — creates a realistic enterprise dataset.
// Usage: `tsx prisma/seed.ts`
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const now = new Date();
const ago = (n: number) => new Date(now.getTime() - n * 86400000);
const ahead = (n: number) => new Date(now.getTime() + n * 86400000);
const pad = (n: number, w: number) => n.toString().padStart(w, "0");
const Y = now.getFullYear();

const PERM_CODES: string[] = [
  "dashboard.view", "analytics.view", "samples.view", "samples.create", "samples.assign",
  "samples.manage", "tests.view", "tests.execute", "tests.review", "tests.approve",
  "stability.view", "stability.manage", "instruments.view", "instruments.manage",
  "qa.view", "qa.manage", "documents.view", "documents.manage", "reports.generate",
  "reports.approve", "batch.release", "clients.view", "clients.manage", "users.manage",
  "audit.view", "invoices.view", "invoice.pay",
];

const ROLE_PERMS: [string, string[]][] = [
  ["ADMIN", PERM_CODES],
  ["MANAGER", ["dashboard.view", "analytics.view", "samples.view", "samples.assign", "tests.view", "tests.review", "stability.view", "instruments.view", "qa.view", "documents.view", "reports.generate", "batch.release", "invoices.view", "clients.view"]],
  ["QA", ["dashboard.view", "samples.view", "tests.view", "tests.approve", "stability.view", "instruments.view", "qa.view", "qa.manage", "documents.view", "documents.manage", "reports.generate", "reports.approve", "batch.release", "audit.view", "clients.view"]],
  ["ANALYST", ["dashboard.view", "samples.view", "samples.create", "tests.view", "tests.execute", "stability.view", "instruments.view", "qa.view", "documents.view", "invoices.view"]],
  ["MICRO", ["dashboard.view", "samples.view", "tests.view", "tests.execute", "stability.view", "instruments.view", "qa.view", "documents.view"]],
  ["CLIENT", ["dashboard.view", "samples.create", "samples.view", "documents.view", "invoices.view", "invoice.pay"]],
];

const ROLE_DESC: Record<string, string> = {
  ADMIN: "Laboratory Administrator",
  MANAGER: "Lab Manager",
  QA: "Quality Assurance Officer",
  ANALYST: "Chemist / Analyst",
  MICRO: "Microbiology Analyst",
  CLIENT: "Client / Pharma Company User",
};

const TEST_NAMES: Record<string, string> = {
  ASSAY: "Drug Assay",
  DISSOLUTION: "Dissolution",
  IMPURITY: "Impurity Analysis",
  HPLC: "HPLC Analysis",
  GC: "GC Analysis",
  MICROBIOLOGY: "Microbiology",
};

const METHODS: Record<string, string> = {
  ASSAY: "UV-HPLC validated method (GMP-1042)",
  DISSOLUTION: "USP <711> dissolution apparatus method",
  IMPURITY: "HPLC Related-Substances method (GMP-1140)",
  HPLC: "HPLC sequence RUN-2025-031",
  GC: "GC residual-solvent method",
  MICROBIOLOGY: "Total plate count — media PCA 48h",
};
export async function seedAll() {
  console.log("Seeding PharmaLIMS…");

  // ---- 1. Permissions ----
  const permId: Record<string, string> = {};
  for (const code of PERM_CODES) {
    const p = await prisma.permission.upsert({
      where: { code }, update: {},
      create: { code, name: code, module: code.split(".")[0] },
    });
    permId[code] = p.id;
  }

  // ---- 2. Roles + links ----
  const roleId: Record<string, string> = {};
  for (const [role, perms] of ROLE_PERMS) {
    const r = await prisma.role.upsert({
      where: { name: role }, update: { description: ROLE_DESC[role] },
      create: { name: role, description: ROLE_DESC[role], isSystem: true },
    });
    roleId[role] = r.id;
    for (const code of perms) {
      await prisma.permissionRole.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: permId[code] } },
        update: {},
        create: { roleId: r.id, permissionId: permId[code] },
      });
    }
  }

  // ---- 3. Users ----
  const users: [string, string, string, string, string][] = [
    ["admin@pharmalims.io", "Admin@123", "Aarav", "Mehta", "ADMIN"],
    ["manager@pharmalims.io", "Manager@123", "Priya", "Sharma", "MANAGER"],
    ["qa@pharmalims.io", "Qa@123456", "Rohan", "Iyer", "QA"],
    ["analyst@pharmalims.io", "Analyst@123", "Sneha", "Kulkarni", "ANALYST"],
    ["micro@pharmalims.io", "Micro@123", "Divya", "Rao", "MICRO"],
    ["client@pharmalims.io", "Client@123", "Vikram", "Nair", "CLIENT"],
  ];
  for (const [email, pass, first, last, role] of users) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: {
        email, passwordHash: await bcrypt.hash(pass, 10),
        firstName: first, lastName: last, roleId: roleId[role], title: ROLE_DESC[role],
      },
    });
  }

  const get = (email: string) => prisma.user.findFirst({ where: { email } });
  const analyst = await get("analyst@pharmalims.io");
  const micro = await get("micro@pharmalims.io");
  const admin = await get("admin@pharmalims.io");
  const qa = await get("qa@pharmalims.io");
  const manager = await get("manager@pharmalims.io");
  const clientUser = await get("client@pharmalims.io");
  if (!analyst || !micro || !admin || !qa || !manager || !clientUser)
    throw new Error("Base user creation failed");

  await seedBusiness(clientUser.id, analyst.id, micro.id, qa.id, manager.id, admin.id);

  await prisma.$disconnect();
  console.log("PharmaLIMS seed complete.");
}
async function seedBusiness(
  clientUserId: string, analystId: string, microId: string,
  qaId: string, managerId: string, adminId: string,
) {
  // ---- Clients ----
  const client = await prisma.client.upsert({
    where: { code: "CL-001" }, update: {},
    create: { code: "CL-001", name: "Zenith Pharma Ltd.", industry: "Pharmaceutical", country: "India", contactPerson: "Anika Nair", email: "clients@zenith.com" },
  });
  await prisma.user.update({ where: { id: clientUserId }, data: { clientId: client.id } });
  const client2 = await prisma.client.upsert({
    where: { code: "CL-002" }, update: {},
    create: { code: "CL-002", name: "MediCor Generics", country: "India", contactPerson: "Isha Desai" },
  });

  // ---- Instruments ----
  const INSTR = [
    ["HPLC-01", "HPLC System A", "HPLC", "Shimadzu", "LC-2040C"],
    ["HPLC-02", "HPLC System B", "HPLC", "Agilent", "1260 Infinity"],
    ["GC-01", "GC System A", "GC", "Shimadzu", "GC-2030"],
    ["DISS-01", "Dissolution Apparatus", "DISSOLUTION", "Lab India", "DIS-8000"],
    ["MIC-01", "Microbiology Incubator", "MICROBIOLOGY", "ThermoLab", "INC-45"],
    ["STAB-01", "Stability Chamber", "STABILITY_CHAMBER", "Memmert", "C-150"],
    ["SP-01", "UV-Vis Spectrometer", "SPECTROPHOTOMETER", "PerkinElmer", "LAMBDA 365"],
  ];
  const instrId: Record<string, string> = {};
  for (const [code, name, category, mfr, model] of INSTR) {
    const existing = await prisma.instrument.findUnique({ where: { code } });
    if (existing) { instrId[code] = existing.id; continue; }
    const inst = await prisma.instrument.create({
      data: {
        code, name, category, manufacturer: mfr, model,
        status: code === "HPLC-01" ? "IN_USE" : "AVAILABLE",
        calibrationFrequency: 365,
        lastCalibrated: ago(50), nextCalibration: ahead(315),
        calibrationStatus: "VALID", location: "Main Analytical Lab",
      },
    });
    instrId[code] = inst.id;
  }

  // ---- Products ----
  const PROD: [string, string, string, string][] = [
    ["PRD-0001", "Amoxicillin 500 mg Capsules", "500 mg", "Amoxicillin trihydrate"],
    ["PRD-0002", "Paracetamol 650 mg Tablets", "650 mg", "Paracetamol"],
    ["PRD-0003", "Cetirizine 10 mg Tablets", "10 mg", "Cetirizine hydrochloride"],
    ["PRD-0004", "Diclofenac Gel 1.5%", "1.5%", "Diclofenac"],
    ["PRD-0005", "Vitamin D3 1000 IU Softgels", "1000 IU", "Cholecalciferol"],
  ];
  const prodId: Record<string, string> = {};
  let prodSeq = 1;
  for (const [code, name, dosage, ing] of PROD) {
    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) { prodId[code] = existing.id; continue; }
    const clientOf = code === "PRD-0003" || code === "PRD-0004" ? client2 : client;
    const p = await prisma.product.create({
      data: { code, name, dosage, activeIngredient: ing, clientId: clientOf.id, description: `${dosage} ${name}` },
    });
    prodId[code] = p.id;
    prodSeq++;
  }

  // ---- Batches ----
  const BATCH: [string, string, number, string, number][] = [
    ["PRD-0001", `${Y}-AMX-001`, 60, "TESTING", 25],
    ["PRD-0001", `${Y}-AMX-002`, 90, "RELEASED", 20],
    ["PRD-0002", `${Y}-PRC-001`, 40, "TESTING", 30],
    ["PRD-0003", `${Y}-CET-001`, 55, "RELEASED", 18],
    ["PRD-0005", `${Y}-D3-001`, 35, "REJECTED", 22],
  ];
  const batchNum = new Set<string>();
  for (const [pcode, num, qty, status, mfdAgo] of BATCH) {
    if (batchNum.has(num)) continue;
    batchNum.add(num);
    const existing = await prisma.batch.findUnique({ where: { batchNumber: num } });
    if (existing) continue;
    await prisma.batch.create({
      data: {
        batchNumber: num, productId: prodId[pcode],
        mfgDate: ago(mfdAgo), expDate: ahead(700), quantity: qty,
        releaseStatus: status, releasedAt: status === "APPROVED" ? ago(5) : status === "REJECTED" ? ago(3) : null,
      },
    });
  }
// ---- Batch index ----
  const allBatches = await prisma.batch.findMany();
  const batchByNum: Record<string, string> = {};
  for (const b of allBatches) batchByNum[b.batchNumber] = b.id;

  // ---- Samples ----
  type SampleDef = { pcode: string; batch?: string; recv: number; status: string; prio: string; ttype: string; amount: number; cond: string; loc: string };
  const SAMPLES: SampleDef[] = [
    { pcode: "PRD-0001", batch: `${Y}-AMX-01`, recv: 6, status: "TESTING", prio: "RUSH", ttype: "ASSAY", amount: 12, cond: "15-25°C", loc: "A-01" },
    { pcode: "PRD-0001", batch: `${Y}-AMX-02`, recv: 12, status: "APPROVED", prio: "NORMAL", ttype: "ASSAY", amount: 10, cond: "15-25°C", loc: "A-02" },
    { pcode: "PRD-0003", batch: `${Y}-CET-001`, recv: 9, status: "REVIEW", prio: "NORMAL", ttype: "DISSOLUTION", amount: 18, cond: "15-25°C", loc: "B-03" },
    { pcode: "PRD-0002", batch: `${Y}-PRC-001`, recv: 3, status: "REVIEW", prio: "HIGH", ttype: "IMPURITY", amount: 20, cond: "15-25°C", loc: "A-04" },
    { pcode: "PRD-0005", batch: `${Y}-D3-001`, recv: 15, status: "REJECTED", prio: "NORMAL", ttype: "ASSAY", amount: 8, cond: "15-25°C", loc: "B-01" },
    { pcode: "PRD-0001", batch: `${Y}-AMX-03`, recv: 1, status: "RECEIVED", prio: "RUSH", ttype: "ASSAY", amount: 16, cond: "15-25°C", loc: "A-05" },
    { pcode: "PRD-0003", batch: `${Y}-CET-02`, recv: 45, status: "RELEASED", prio: "LOW", ttype: "MICROBIOLOGY", amount: 14, cond: "2-8°C", loc: "C-01" },
    { pcode: "PRD-0004", batch: `${Y}-DIC-01`, recv: 60, status: "ARCHIVED", prio: "LOW", ttype: "ASSAY", amount: 9, cond: "15-25°C", loc: "C-02" },
  ];
  const sampleSeq = await prisma.sample.count();
  let srun = 0;
  for (const s of SAMPLES) {
    srun += 1;
    const code = `SPL-${Y}-${pad(sampleSeq + srun, 5)}`;
    const existing = await prisma.sample.findUnique({ where: { sampleCode: code } });
    if (existing) continue;
    const prod = await prisma.product.findUnique({ where: { code: s.pcode } });
    if (!prod) continue;
    const b = s.batch ? (await prisma.batch.findUnique({ where: { batchNumber: s.batch } })) : undefined;
    const sample = await prisma.sample.create({
      data: {
        sampleCode: code, barcode: `B-${code}`,
        clientId: prod.clientId, productId: prod.id, productName: prod.name,
        batchId: b?.id, batchNumber: b?.batchNumber,
        mfgDate: b?.mfgDate, expDate: b?.expDate,
        quantity: s.amount, unit: "g", storageCondition: s.cond, storageLocation: s.loc,
        receivedDate: ago(s.recv), priority: s.prio, status: s.status,
        requestedTests: [s.ttype], coOwner: "Sample Reception",
        createdById: clientUserId, notes: "Registered via client portal.",
      },
    });
    if (s.status !== "RECEIVED") {
      await seedTestsFor(sample.id, s, prod.id, analystId, microId, qaId, managerId, instrId);
    }
  }
  console.log("  samples ✓");
// ---- Test seeding per sample ----
  async function seedTestsFor(
    sampleId: string, s: SampleDef, _prodId: string,
    analystId: string, microId: string, qaId: string, managerId: string,
    instr: Record<string, string>,
  ) {
    const instrumentByType: Record<string, string> = {
      ASSAY: instr["HPLC-01"], DISSOLUTION: instr["DISS-01"],
      IMPURITY: instr["HPLC-02"], MICROBIOLOGY: instr["MIC-01"],
    };
    const instrumentId = instrumentByType[s.ttype];
    const testCount = await prisma.test.count();
    const code = `TST-${Y}-${pad(testCount + 1, 4)}`;
    const existing = await prisma.test.findUnique({ where: { requestCode: code } });
    if (existing) return;

    const statusFor = (ss: string) => {
      if (ss === "REJECTED") return "REJECTED";
      if (ss === "APPROVED" || ss === "RELEASED") return "APPROVED";
      if (ss === "REVIEW") return "REVIEW";
      if (ss === "TESTING") return "TESTING";
      if (ss === "ASSIGNED") return "ASSIGNED";
      return "REVIEW";
    };
    const status = statusFor(s.status);
    const pass = s.status !== "REJECTED";
    const assignedToId = s.ttype === "MICROBIOLOGY" ? microId : analystId;

    const test = await prisma.test.create({
      data: {
        requestCode: code, sampleId, type: s.ttype,
        testName: testNameFor(s.ttype, s.pcode),
        method: methodFor(s.ttype),
        status,
        priority: s.prio === "RUSH" ? "RUSH" : "NORMAL",
        assignedToId, instrumentId,
        startedAt: ago(s.recv),
        dueDate: ago(s.recv - 6),
        attachments: ["raw/", "worksheet.pdf"].map((n) => `${code}/${n}`),
      },
    });

    if (s.ttype === "ASSAY") {
      const res = 92 + Math.random() * 12; // 92..104
      const rv = s.status === "REJECTED" ? 90.2 : Math.min(105, res);
      await prisma.assayResult.create({
        data: {
          testId: test.id, apiLabel: "Label claim 100%",
          expectedLow: 95, expectedHigh: 105,
          resultPercent: rv,
          calculationMethod: "Area normalization",
          observations: pass ? "Peak resolved, no deviation." : "Out-of-spec > limit",
          specPass: pass,
          instrumentId, status: status === "TESTING" ? "DRAFT" : "COMPLETED",
        },
      });
      test.result = status === "REJECTED" ? "FAIL" : "PASS";
    } else if (s.ttype === "DISSOLUTION") {
      await prisma.dissolutionResult.create({
        data: {
          testId: test.id, apparatus: "USP II", medium: "0.1N HCl", rpm: 100, temperature: 37,
          timepoints: [
            { t: 15, p: 62 }, { t: 30, p: 84 }, { t: 45, p: 96 }, { t: 60, p: 98 },
          ],
          observations: "Creamy profile within spec", pass,
        },
      });
    } else if (s.ttype === "IMPURITY") {
      await prisma.impurityResult.create({
        data: {
          testId: test.id, impurityName: "Related Substance RRT ~1.1",
          type: "RELATED_SUBSTANCE", specLimit: "≤ 0.15%", specMax: 0.15,
          observedValue: pass ? 0.08 : 0.28,
          analyticalMethod: "HPLC-2", instrumentId: instr["HPLC-02"], status: "COMPLETED",
        },
      });
    } else if (s.ttype === "MICROBIOLOGY") {
      await prisma.microbiologyResult.create({
        data: {
          testId: test.id, testType: "TOTAL_BACTERIAL",
          media: "PCA", incubationTemp: 35, incubationTime: 48, colonyCount: pass ? 22 : 160,
          limitSpec: "≤ 100 CFU/g", pass, observations: pass ? "Within spec" : "Exceeds limit",
        },
      });
    }

    const next = await prisma.test.update({
      where: { id: test.id },
      data: {
        result: s.ttype === "ASSAY" && status === "REJECTED" ? "FAIL" : status === "APPROVED" ? "PASS" : undefined,
        resultStatus: status === "REJECTED" ? "FAIL" : status === "APPROVED" ? "PASS" : undefined,
        reviewedById: status === "APPROVED" || status === "REVIEW" ? managerId : undefined,
        reviewedAt: status === "APPROVED" ? ago(2) : undefined,
        approvedById: status === "APPROVED" ? qaId : undefined,
        approvedAt: status === "APPROVED" ? ago(1) : undefined,
      },
    });
    void next;
  }

  function testNameFor(type: string, pcode: string) {
    return `${TEST_NAMES[type] ?? "Analysis"} — ${pcode}`;
  }
  function methodFor(type: string) {
    return METHODS[type] ?? "In-house validated method";
  }
// ---- Stability studies ----
  const sCount = await prisma.stabilityStudy.count();
  const studyCodes = [`${Y}-STD-001`, `${Y}-STD-002`];
  const studies = [
    { product: "PRD-0001", protocol: "LONG_TERM", cond: "25°C / 60% RH", start: 0 },
    { product: "PRD-0003", protocol: "ACCELERATED", cond: "40°C / 75% RH", start: 45 },
  ];
  let si = sCount;
  for (const st of studies) {
    si += 1;
    const code = `STD-${Y}-${pad(si, 3)}`;
    const existing = await prisma.stabilityStudy.findUnique({ where: { studyId: code } });
    if (existing) continue;
    const prod = await prisma.product.findUnique({ where: { code: st.product } });
    if (!prod) continue;
    const batch = await prisma.batch.findFirst();
    if (!batch) continue;
    const study = await prisma.stabilityStudy.create({
      data: {
        studyId: code, protocol: st.protocol, productId: prod.id,
        batchId: batch.id, storageCondition: st.cond,
        intervals: ["0M", "3M", "6M", "12M", "24M"],
        startDate: ago(st.start), endDate: ahead(720),
        status: "ACTIVE",
      },
    });
    for (let idx = 0; idx < 5; idx += 1) {
      const iv = ["0M", "3M", "6M", "12M", "24M"][idx];
      await prisma.stabilityTimepoint.create({
        data: {
          studyId: study.id, interval: iv,
          dueDate: ahead(idx * 90),
          status: idx === 0 ? "COMPLETED" : idx === 1 ? "DUE" : "SCHEDULED",
          result: idx === 0 ? "100.2%" : undefined,
        },
      });
    }
    console.log("  stability ✓");
  }

  // ---- Deviations / CAPA / Change control ----
  const devCount = await prisma.deviation.count();
  const devCodes = [`DEV-${Y}-${pad(devCount + 1, 4)}`, `DEV-${Y}-${pad(devCount + 2, 4)}`];
  const dev1 = await prisma.deviation.create({
    data: {
      deviationId: devCodes[0], description: "Recovery above upper limit on HPLC-01 during assay run.",
      category: "ANALYTICAL", impactLevel: "MAJOR", rootCause: "Incorrect diluent pH > calibration range",
      correctiveAction: "Re-run after buffer pH correction; re-train analyst",
      status: "INVESTIGATING", reportedById: analystId,
    },
  });
  void dev1;
  const dev2 = await prisma.deviation.create({
    data: {
      deviationId: devCodes[1], description: "Temperature probe deviation on stability chamber.",
      category: "EQUIPMENT", impactLevel: "MINOR",
      rootCause: "Probe sensor drift", correctiveAction: "Calibrate probe",
      status: "OPEN", reportedById: managerId,
    },
  });
  void dev2;

  const capaCount = await prisma.capa.count();
  const capa = await prisma.capa.create({
    data: { capaId: `CAPA-${Y}-${pad(capaCount + 1, 4)}`, title: "Buffer pH control procedure review", type: "PREVENTIVE", description: "Prevent recurrence of pH deviation", action: "Update SOP BUF-101 with QR verification", ownerId: qaId, dueDate: ahead(30), status: "IN_PROGRESS" },
  });
  void capa;

  const ccCount = await prisma.changeControl.count();
  const cc = await prisma.changeControl.create({
    data: {
      ccId: `CC-${Y}-${pad(ccCount + 1, 4)}`,
      title: "HPLC column change on Instrument M",
      category: "EQUIPMENT",
      description: "Replace HPLC column with equivalent bonded C18",
      justification: "Degraded column",
      proposedBy: "Priya Sharma",
      impactAnalysis: { risk: "medium", validation: "Partial IQ/OQ required" },
      status: "IMPACT_REVIEW",
    },
  });
  void cc;

  console.log("  QA records ✓");
// ---- Documents ----
  const docCount = await prisma.document.count();
  const docs: [string, string, string][] = [
    ["SOP-Sampling", "SOP — Sample Receipt & Logging", "SOP"],
    ["TMK-1042", "Analytical Method — Drug Assay (UV-HPLC)", "TEST_METHOD"],
    ["SOP-INC", "SOP — Incubator Operation & Monitoring", "SOP"],
    ["VAL-101", "Validation Report — HPLC System", "VALIDATION"],
    ["COA-TPL", "Certificate of Analysis Template", "COA"],
  ];
  let dn = docCount;
  for (const [code, title, cat] of docs) {
    const c = `DOC-${Y}-${pad(++dn, 4)}`;
    const existing = await prisma.document.findUnique({ where: { docCode: c } });
    if (existing) continue;
    await prisma.document.create({
      data: {
        docCode: c, title, category: cat, version: "1.0",
        status: "APPROVED", ownerId: qaId,
        approverLogic: { owner: qaId, reviewer: managerId },
        digitalSignature: "signed:rcx-iahan",
        approvedByUserId: qaId,
        approvedAt: ago(10),
      },
    });
  }
  console.log("  documents ✓");

  // ---- Reports ----
  const samplesList = await prisma.sample.findMany({ include: { tests: true }, take: 20 });
  let rptSeq = await prisma.testReport.count();
  for (const sample of samplesList.filter((x) => x.status === "APPROVED" || x.status === "RELEASED")) {
    for (const t of sample.tests) {
      rptSeq += 1;
      const rc = `RPT-${Y}-${pad(rptSeq, 4)}`;
      const existing = await prisma.testReport.findUnique({ where: { reportCode: rc } });
      if (existing) continue;
      await prisma.testReport.create({
        data: {
          reportCode: rc, sampleId: sample.id, testId: t.id,
          type: reportTypeFor(t.type), title: `${t.testName} Report`,
          status: t.status === "APPROVED" ? "RELEASED" : "DRAFT",
          generatedById: managerId, approvedById: qaId,
          approvedAt: t.status === "APPROVED" ? ago(1) : undefined,
          digitalSignature: "sig:el-approval",
          content: { summary: "Conforms to specification", instrument: t.instrumentId },
        },
      });
    }
  }

  function reportTypeFor(type: string) {
    return { ASSAY: "ASSAY", DISSOLUTION: "DISSOLUTION", IMPURITY: "IMPURITY", MICROBIOLOGY: "MICROBIOLOGY", HPLC: "HPLC", GC: "GC" }[type] ?? "TEST";
  }
  console.log("  reports ✓");
// ---- Invoices ----
  const invCount = await prisma.invoice.count();
  const samplesForInv = await prisma.sample.findMany({ where: { clientId: client.id }, take: 4 });
  const inv = await prisma.invoice.create({
    data: {
      number: `INV-${Y}-${pad(invCount + 1, 4)}`,
      amount: samplesForInv.length * 1800, currency: "USD",
      status: samplesForInv.some((s) => s.status === "RELEASED") ? "PAID" : "UNPAID",
      issuedAt: ago(3), dueAt: ahead(12),
      clientId: client.id,
      samples: { connect: samplesForInv.map((s) => ({ id: s.id })) },
    },
  });
  void inv;
  console.log("  invoices ✓");

  // ---- Audit logs ----
  const auditActions: [string, string, string | undefined, string | undefined][] = [
    ["USER_LOGIN", "AUTH", "User", adminId],
    ["SAMPLE_CREATED", "SAMPLES", "Sample", samplesForInv[0]?.id],
    ["RESULT_ENTERED", "TESTING", "Test", undefined],
    ["REPORT_APPROVED", "QA", "TestReport", undefined],
    ["DEVIATION_OPENED", "QA", "Deviation", undefined],
  ];
  for (const [action, module, et, eid] of auditActions) {
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action, module, entityType: et, entityId: eid,
        newValue: { status: "updated" },
      },
    });
  }
  console.log("  audit ✓");
}

// Auto-run when executed directly
seedAll().catch((e) => {
  console.error(e);
  process.exit(1);
});