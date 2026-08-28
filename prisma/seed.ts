// TNTH LIMS seed — Tamil Nadu Test House contract testing lab demo dataset.
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
  CLIENT: "Client Company User",
};

const TEST_NAMES: Record<string, string> = {
  ASSAY: "Assay / Content Analysis",
  DISSOLUTION: "Dissolution",
  IMPURITY: "Trace Impurity / Residue Screen (LC-MS/MS)",
  HPLC: "HPLC Analysis",
  GC: "GCMS-MS Analysis",
  MICROBIOLOGY: "Microbiology",
  ICPMS: "ICP-MS Elemental / Heavy Metal Analysis",
  HPTLC: "HPTLC Fingerprinting",
  NMR: "NMR Structural Analysis",
  DSC_TGA: "DSC / TGA Thermal Analysis",
  SPF: "SPF / Sunscreen Efficacy Testing",
};

const METHODS: Record<string, string> = {
  ASSAY: "HPLC assay, in-house validated method (Shimadzu LC-2040C)",
  DISSOLUTION: "USP <711> dissolution apparatus method",
  IMPURITY: "LC-MS/MS trace screen — Shimadzu LCMS-TQ RX triple-quad, MRM method TNTH-LCMS-011",
  HPLC: "HPLC — UV/PDA/RI/Fluorescence detectors, sequence RUN-2025-031",
  GC: "GCMS-MS residual-solvent / pesticide-residue screen (Shimadzu GCMS-TQ8050)",
  MICROBIOLOGY: "Total plate count — media PCA 48h",
  ICPMS: "Agilent 7850 ICP-MS, USEPA 200.8 elemental scan",
  HPTLC: "HPTLC fingerprinting, full UV range with fluorescence scan (CAMAG Linomat 5)",
  NMR: "H-1 / P-31 NMR structural confirmation (Bruker 400 MHz)",
  DSC_TGA: "Thermal analysis — melting point, decomposition, glass transition",
  SPF: "In vitro SPF & UVA protection factor, water-resistance study",
};

export async function seedAll() {
  console.log("Seeding TNTH LIMS…");

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
    ["admin@tnth.io", "Admin@123", "Karthik", "Subramaniam", "ADMIN"],
    ["manager@tnth.io", "Manager@123", "Meena", "Ramachandran", "MANAGER"],
    ["qa@tnth.io", "Qa@123456", "Suresh", "Balaji", "QA"],
    ["analyst@tnth.io", "Analyst@123", "Divya", "Krishnan", "ANALYST"],
    ["micro@tnth.io", "Micro@123", "Lakshmi", "Narayanan", "MICRO"],
    ["client@tnth.io", "Client@123", "Ravi", "Chandrasekaran", "CLIENT"],
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
  const analyst = await get("analyst@tnth.io");
  const micro = await get("micro@tnth.io");
  const admin = await get("admin@tnth.io");
  const qa = await get("qa@tnth.io");
  const manager = await get("manager@tnth.io");
  const clientUser = await get("client@tnth.io");
  if (!analyst || !micro || !admin || !qa || !manager || !clientUser)
    throw new Error("Base user creation failed");

  await seedBusiness(clientUser.id, analyst.id, micro.id, qa.id, manager.id, admin.id);

  await prisma.$disconnect();
  console.log("TNTH LIMS seed complete.");
}
async function seedBusiness(
  clientUserId: string, analystId: string, microId: string,
  qaId: string, managerId: string, adminId: string,
) {
  // ---- Clients (TNTH's contract-testing customers) ----
  const client = await prisma.client.upsert({
    where: { code: "CL-001" }, update: {},
    create: { code: "CL-001", name: "Sundar Pharma Formulations", industry: "Pharmaceuticals", city: "Chennai", country: "India", contactPerson: "Ravi Chandrasekaran", email: "quality@sundarpharma.example" },
  });
  await prisma.user.update({ where: { id: clientUserId }, data: { clientId: client.id } });
  const client2 = await prisma.client.upsert({
    where: { code: "CL-002" }, update: {},
    create: { code: "CL-002", name: "Kaveri Foods & Beverages", industry: "Food Testing", city: "Coimbatore", country: "India", contactPerson: "Anitha Selvam" },
  });
  const client3 = await prisma.client.upsert({
    where: { code: "CL-003" }, update: {},
    create: { code: "CL-003", name: "Glow Personal Care Pvt Ltd", industry: "Personal Care & Cosmetics", city: "Chennai", country: "India", contactPerson: "Priyanka Raj" },
  });
  const client4 = await prisma.client.upsert({
    where: { code: "CL-004" }, update: {},
    create: { code: "CL-004", name: "Chennai Metro Water Board", industry: "Water & Environment", city: "Chennai", country: "India", contactPerson: "Manoj Pillai" },
  });
  const client5 = await prisma.client.upsert({
    where: { code: "CL-005" }, update: {},
    create: { code: "CL-005", name: "Siddha Herbals Ayush", industry: "Ayush Testing", city: "Madurai", country: "India", contactPerson: "Gunasekaran M" },
  });
  const client6 = await prisma.client.upsert({
    where: { code: "CL-006" }, update: {},
    create: { code: "CL-006", name: "Vridhi Agro Exports", industry: "Agriculture", city: "Salem", country: "India", contactPerson: "Kavitha Muthu" },
  });
  const client7 = await prisma.client.upsert({
    where: { code: "CL-007" }, update: {},
    create: { code: "CL-007", name: "GenNext Biotech Labs", industry: "Bio Technology", city: "Chennai", country: "India", contactPerson: "Arjun Vetri" },
  });
  const client8 = await prisma.client.upsert({
    where: { code: "CL-008" }, update: {},
    create: { code: "CL-008", name: "Chennai Polymers & Plastics", industry: "Polymer Testing", city: "Chennai", country: "India", contactPerson: "Naveen Kumar" },
  });

  // ---- Instruments (TNTH's actual fleet) ----
  const INSTR = [
    ["HPLC-01", "HPLC System A", "HPLC", "Shimadzu", "LC-2040C"],
    ["HPLC-02", "HPLC System B", "HPLC", "Agilent", "1260 Infinity"],
    ["LCMSMS-01", "LC-MS/MS Triple Quadrupole", "LCMSMS", "Shimadzu", "LCMS-TQ RX"],
    ["GCMSMS-01", "GCMS-MS System", "GC", "Shimadzu", "GCMS-TQ8050"],
    ["ICPMS-01", "ICP-MS Elemental Analyzer", "ICPMS", "Agilent", "7850"],
    ["DISS-01", "Dissolution Apparatus", "DISSOLUTION", "Lab India", "DIS-8000"],
    ["MIC-01", "Microbiology Incubator", "MICROBIOLOGY", "ThermoLab", "INC-45"],
    ["STAB-01", "Stability Chamber", "STABILITY_CHAMBER", "Memmert", "C-150"],
    ["HPTLC-01", "HPTLC Fingerprinting System", "HPTLC", "CAMAG", "Linomat 5"],
    ["NMR-01", "NMR Spectrometer", "NMR", "Bruker", "400 MHz Avance"],
    ["DSC-01", "DSC/TGA Thermal Analyzer", "DSC_TGA", "Mettler Toledo", "TGA/DSC 3+"],
    ["SPF-01", "SPF / UVA Tester", "SPF", "Labsphere", "UV-2000S"],
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
        calibrationStatus: "VALID", location: "TNTH Main Lab, Vanagaram, Chennai",
      },
    });
    instrId[code] = inst.id;
  }

  // ---- Products ----
  const PROD: [string, string, string, string, string][] = [
    ["PRD-0001", "Amoxicillin 500 mg Capsules", "500 mg", "Amoxicillin trihydrate", "CL-001"],
    ["PRD-0002", "Paracetamol 650 mg Tablets", "650 mg", "Paracetamol", "CL-001"],
    ["PRD-0003", "Turmeric Powder (spice export lot)", "1 kg pack", "—", "CL-002"],
    ["PRD-0004", "Sunscreen Cream SPF 50", "100 g tube", "—", "CL-003"],
    ["PRD-0005", "Vitamin D3 1000 IU Softgels", "1000 IU", "Cholecalciferol", "CL-001"],
    ["PRD-0006", "Packaged Drinking Water", "20 L jar", "—", "CL-004"],
    ["PRD-0007", "Herbal Extract — Ashwagandha", "500 g", "Withanolides", "CL-005"],
    ["PRD-0008", "Basmati Rice — Pesticide Residue", "1 kg pack", "—", "CL-006"],
    ["PRD-0009", "Recombinant Protein Batch", "50 mg vial", "—", "CL-007"],
    ["PRD-0010", "PET Resin Pellets", "1 kg pack", "—", "CL-008"],
  ];
  const prodId: Record<string, string> = {};
  const clientByCode: Record<string, { id: string }> = {
    "CL-001": client, "CL-002": client2, "CL-003": client3, "CL-004": client4,
    "CL-005": client5, "CL-006": client6, "CL-007": client7, "CL-008": client8,
  };
  for (const [code, name, dosage, ing, ccode] of PROD) {
    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) { prodId[code] = existing.id; continue; }
    const p = await prisma.product.create({
      data: { code, name, dosage, activeIngredient: ing, clientId: clientByCode[ccode].id, description: `${dosage} ${name}` },
    });
    prodId[code] = p.id;
  }

  // ---- Batches ----
  const BATCH: [string, string, number, string, number][] = [
    ["PRD-0001", `${Y}-AMX-001`, 60, "TESTING", 25],
    ["PRD-0001", `${Y}-AMX-002`, 90, "RELEASED", 20],
    ["PRD-0002", `${Y}-PRC-001`, 40, "TESTING", 30],
    ["PRD-0003", `${Y}-TUR-001`, 200, "RELEASED", 18],
    ["PRD-0004", `${Y}-SPF-001`, 120, "REJECTED", 22],
    ["PRD-0006", `${Y}-WTR-001`, 500, "TESTING", 3],
    ["PRD-0007", `${Y}-ASH-001`, 40, "RELEASED", 12],
    ["PRD-0008", `${Y}-RIC-001`, 300, "TESTING", 8],
    ["PRD-0009", `${Y}-BIO-001`, 5, "RELEASED", 15],
    ["PRD-0010", `${Y}-PET-001`, 250, "TESTING", 5],
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
    { pcode: "PRD-0001", batch: `${Y}-AMX-001`, recv: 6, status: "TESTING", prio: "RUSH", ttype: "ASSAY", amount: 12, cond: "15-25°C", loc: "A-01" },
    { pcode: "PRD-0001", batch: `${Y}-AMX-002`, recv: 12, status: "APPROVED", prio: "NORMAL", ttype: "ASSAY", amount: 10, cond: "15-25°C", loc: "A-02" },
    { pcode: "PRD-0002", batch: `${Y}-PRC-001`, recv: 9, status: "REVIEW", prio: "NORMAL", ttype: "DISSOLUTION", amount: 18, cond: "15-25°C", loc: "B-03" },
    { pcode: "PRD-0003", batch: `${Y}-TUR-001`, recv: 3, status: "REVIEW", prio: "HIGH", ttype: "IMPURITY", amount: 20, cond: "15-25°C", loc: "A-04" },
    { pcode: "PRD-0003", batch: `${Y}-TUR-001`, recv: 4, status: "RELEASED", prio: "NORMAL", ttype: "GC", amount: 15, cond: "15-25°C", loc: "A-06" },
    { pcode: "PRD-0004", batch: `${Y}-SPF-001`, recv: 15, status: "REJECTED", prio: "NORMAL", ttype: "ASSAY", amount: 8, cond: "15-25°C", loc: "B-01" },
    { pcode: "PRD-0001", batch: `${Y}-AMX-001`, recv: 1, status: "RECEIVED", prio: "RUSH", ttype: "ASSAY", amount: 16, cond: "15-25°C", loc: "A-05" },
    { pcode: "PRD-0002", batch: `${Y}-PRC-001`, recv: 45, status: "RELEASED", prio: "LOW", ttype: "MICROBIOLOGY", amount: 14, cond: "2-8°C", loc: "C-01" },
    { pcode: "PRD-0005", batch: `${Y}-AMX-001`, recv: 60, status: "ARCHIVED", prio: "LOW", ttype: "HPLC", amount: 9, cond: "15-25°C", loc: "C-02" },
    { pcode: "PRD-0006", batch: `${Y}-WTR-001`, recv: 2, status: "TESTING", prio: "RUSH", ttype: "ICPMS", amount: 2, cond: "2-8°C", loc: "D-01" },
    { pcode: "PRD-0006", batch: `${Y}-WTR-001`, recv: 2, status: "REVIEW", prio: "NORMAL", ttype: "MICROBIOLOGY", amount: 1, cond: "2-8°C", loc: "D-02" },
    { pcode: "PRD-0007", batch: `${Y}-ASH-001`, recv: 9, status: "RELEASED", prio: "NORMAL", ttype: "HPTLC", amount: 6, cond: "15-25°C", loc: "E-01" },
    { pcode: "PRD-0008", batch: `${Y}-RIC-001`, recv: 5, status: "TESTING", prio: "HIGH", ttype: "GC", amount: 20, cond: "15-25°C", loc: "F-01" },
    { pcode: "PRD-0009", batch: `${Y}-BIO-001`, recv: 10, status: "RELEASED", prio: "NORMAL", ttype: "NMR", amount: 3, cond: "2-8°C", loc: "G-01" },
    { pcode: "PRD-0010", batch: `${Y}-PET-001`, recv: 4, status: "REVIEW", prio: "NORMAL", ttype: "DSC_TGA", amount: 5, cond: "15-25°C", loc: "H-01" },
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
      IMPURITY: instr["LCMSMS-01"], MICROBIOLOGY: instr["MIC-01"],
      HPLC: instr["HPLC-02"], GC: instr["GCMSMS-01"],
      ICPMS: instr["ICPMS-01"], HPTLC: instr["HPTLC-01"],
      NMR: instr["NMR-01"], DSC_TGA: instr["DSC-01"], SPF: instr["SPF-01"],
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
          observations: "Dissolution profile within spec", pass,
        },
      });
    } else if (s.ttype === "IMPURITY") {
      await prisma.impurityResult.create({
        data: {
          testId: test.id, impurityName: "Pesticide Residue Screen (multi-residue)",
          type: "RELATED_SUBSTANCE", specLimit: "≤ 0.10 ppm", specMax: 0.10,
          observedValue: pass ? 0.02 : 0.28,
          analyticalMethod: "LC-MS/MS", instrumentId: instr["LCMSMS-01"], status: "COMPLETED",
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
        result: status === "REJECTED" ? "FAIL" : status === "APPROVED" ? "PASS" : undefined,
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
  const studies = [
    { product: "PRD-0001", protocol: "LONG_TERM", cond: "25°C / 60% RH", start: 0 },
    { product: "PRD-0002", protocol: "ACCELERATED", cond: "40°C / 75% RH", start: 45 },
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
      deviationId: devCodes[0], description: "Recovery above upper limit on LC-MS/MS during trace pesticide screen.",
      category: "ANALYTICAL", impactLevel: "MAJOR", rootCause: "Matrix effect not corrected by internal standard",
      correctiveAction: "Re-run with matrix-matched calibration; re-train analyst",
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
    data: { capaId: `CAPA-${Y}-${pad(capaCount + 1, 4)}`, title: "LC-MS/MS calibration procedure review", type: "PREVENTIVE", description: "Prevent recurrence of matrix-effect deviation", action: "Update SOP LCMS-101 with matrix-matched calibration requirement", ownerId: qaId, dueDate: ahead(30), status: "IN_PROGRESS" },
  });
  void capa;

  const ccCount = await prisma.changeControl.count();
  const cc = await prisma.changeControl.create({
    data: {
      ccId: `CC-${Y}-${pad(ccCount + 1, 4)}`,
      title: "HPLC column change on Instrument B",
      category: "EQUIPMENT",
      description: "Replace HPLC column with equivalent bonded C18",
      justification: "Degraded column",
      proposedBy: "Meena Ramachandran",
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
    ["TMK-1042", "Analytical Method — Assay (HPLC)", "TEST_METHOD"],
    ["SOP-INC", "SOP — Incubator Operation & Monitoring", "SOP"],
    ["VAL-101", "Validation Report — LC-MS/MS System", "VALIDATION"],
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
      amount: samplesForInv.length * 1800, currency: "INR",
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
