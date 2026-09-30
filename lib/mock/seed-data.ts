// Static demo dataset for the in-memory mock DB (lib/mock/engine.ts).
// Ported 1:1 from prisma/seed.ts's data (same users, clients, samples,
// tests, QA records) but built synchronously as plain objects instead of
// via async Prisma calls against a real database.

import bcrypt from "bcryptjs";
import { genId, type DB } from "./engine";

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
  ["MANAGER", ["dashboard.view", "analytics.view", "samples.view", "samples.assign", "tests.view", "tests.review", "stability.view", "instruments.view", "qa.view", "documents.view", "reports.generate", "batch.release", "invoices.view", "clients.view", "clients.manage"]],
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

export function buildSeedDb(): DB {
  const db: DB = {
    permission: [], role: [], permissionRole: [], user: [],
    client: [], customerContact: [], customerDocument: [],
    enquiry: [], enquiryProduct: [], enquiryTestRequest: [],
    quotation: [], quotationItem: [], quotationHistory: [],
    trf: [], trfSample: [], trfTestRequest: [], trfDocument: [], trfAuthorization: [], trfReviewHistory: [],
    sampleReceipt: [],
    technicalReview: [], technicalReviewHistory: [],
    sampleRegistration: [],
    invoice: [], product: [], batch: [], sample: [],
    chainOfCustody: [], storageEvent: [], test: [],
    assayResult: [], dissolutionResult: [], impurityResult: [], microbiologyResult: [],
    stabilityStudy: [], stabilityTimepoint: [],
    instrument: [], calibrationRecord: [], maintenanceLog: [],
    deviation: [], capa: [], changeControl: [],
    document: [], downloadRecord: [], testReport: [],
    approval: [], auditLog: [], message: [],
  };

  // ---- Permissions ----
  const permId: Record<string, string> = {};
  for (const code of PERM_CODES) {
    const id = genId("permission");
    db.permission.push({ id, code, name: code, module: code.split(".")[0], createdAt: now });
    permId[code] = id;
  }

  // ---- Roles + links ----
  const roleId: Record<string, string> = {};
  for (const [role, perms] of ROLE_PERMS) {
    const id = genId("role");
    db.role.push({ id, name: role, description: ROLE_DESC[role], isSystem: true, createdAt: now, updatedAt: now });
    roleId[role] = id;
    for (const code of perms) {
      db.permissionRole.push({ roleId: id, permissionId: permId[code] });
    }
  }

  // ---- Users ----
  const USERS: [string, string, string, string, string][] = [
    ["admin@tnth.io", "Admin@123", "Karthik", "Subramaniam", "ADMIN"],
    ["manager@tnth.io", "Manager@123", "Meena", "Ramachandran", "MANAGER"],
    ["qa@tnth.io", "Qa@123456", "Suresh", "Balaji", "QA"],
    ["analyst@tnth.io", "Analyst@123", "Divya", "Krishnan", "ANALYST"],
    ["micro@tnth.io", "Micro@123", "Lakshmi", "Narayanan", "MICRO"],
    ["client@tnth.io", "Client@123", "Ravi", "Chandrasekaran", "CLIENT"],
  ];
  const userId: Record<string, string> = {};
  for (const [email, pass, first, last, role] of USERS) {
    const id = genId("user");
    db.user.push({
      id, email, passwordHash: bcrypt.hashSync(pass, 10),
      firstName: first, lastName: last, roleId: roleId[role], title: ROLE_DESC[role],
      phone: null, signature: null, isActive: true, twoFactorEnabled: false,
      clientId: null, lastLoginAt: null, createdAt: now, updatedAt: now,
    });
    userId[email] = id;
  }
  const analystId = userId["analyst@tnth.io"];
  const microId = userId["micro@tnth.io"];
  const adminId = userId["admin@tnth.io"];
  const qaId = userId["qa@tnth.io"];
  const managerId = userId["manager@tnth.io"];
  const clientUserId = userId["client@tnth.io"];

  // ---- Clients ----
  const CLIENTS: [string, string, string, string, string, string][] = [
    ["CL-001", "Sundar Pharma Formulations", "Pharmaceuticals", "Chennai", "Ravi Chandrasekaran", "quality@sundarpharma.example"],
    ["CL-002", "Kaveri Foods & Beverages", "Food Testing", "Coimbatore", "Anitha Selvam", ""],
    ["CL-003", "Glow Personal Care Pvt Ltd", "Personal Care & Cosmetics", "Chennai", "Priyanka Raj", ""],
    ["CL-004", "Chennai Metro Water Board", "Water & Environment", "Chennai", "Manoj Pillai", ""],
    ["CL-005", "Siddha Herbals Ayush", "Ayush Testing", "Madurai", "Gunasekaran M", ""],
    ["CL-006", "Vridhi Agro Exports", "Agriculture", "Salem", "Kavitha Muthu", ""],
    ["CL-007", "GenNext Biotech Labs", "Bio Technology", "Chennai", "Arjun Vetri", ""],
    ["CL-008", "Chennai Polymers & Plastics", "Polymer Testing", "Chennai", "Naveen Kumar", ""],
  ];
  const clientId: Record<string, string> = {};
  // Customer Master profile data (Module 1). Codes follow CUST-YYYY-NNNNN.
  const CUST_EXTRA: Record<string, { type: string; gst: string; pan: string; phone: string; active: boolean; age: number }> = {
    "CL-001": { type: "Company", gst: "33AABCS1234F1Z5", pan: "AABCS1234F", phone: "+919841000001", active: true, age: 400 },
    "CL-002": { type: "Company", gst: "33AAACK5678G1Z2", pan: "AAACK5678G", phone: "+919841000002", active: true, age: 300 },
    "CL-003": { type: "Company", gst: "", pan: "", phone: "+919841000003", active: true, age: 200 },
    "CL-004": { type: "Government", gst: "", pan: "", phone: "+919841000004", active: true, age: 150 },
    "CL-005": { type: "Company", gst: "33AAECS9012H1Z8", pan: "AAECS9012H", phone: "+919841000005", active: false, age: 90 },
    "CL-006": { type: "Company", gst: "", pan: "", phone: "+919841000006", active: true, age: 40 },
    "CL-007": { type: "Company", gst: "33AAGCG3456J1Z1", pan: "AAGCG3456J", phone: "+919841000007", active: true, age: 5 },
    "CL-008": { type: "Individual", gst: "", pan: "", phone: "+919841000008", active: true, age: 2 },
  };
  let custSeq = 0;
  for (const [code, name, industry, city, contact, email] of CLIENTS) {
    const id = genId("client");
    const x = CUST_EXTRA[code];
    custSeq += 1;
    const created = ago(x.age);
    const mail = email || `${contact.split(" ")[0].toLowerCase()}@${name.split(" ")[0].toLowerCase()}.example`;
    const addr = { line1: `${custSeq * 12}, Industrial Estate Road`, line2: "", city, district: city, state: "Tamil Nadu", pin: "600032", country: "India" };
    db.client.push({
      id, code: `CUST-${created.getFullYear()}-${String(custSeq).padStart(5, "0")}`, name, industry, address: null, city, country: "India",
      contactPerson: contact, email: mail, phone: x.phone, isActive: x.active,
      createdAt: created, updatedAt: created,
      customerType: x.type, tradeName: "", designation: "", alternatePhone: "", website: "",
      normalizedName: name.toLowerCase().replace(/\b(pvt|private|ltd|limited|llp|inc|co|company)\b\.?/g, "").replace(/[^a-z0-9]/g, ""),
      billing: addr, reportingSameAsBilling: true, reporting: { ...addr, contactPerson: "", email: "", phone: "" },
      gstStatus: x.gst ? "Registered" : "Unregistered", gstNumber: x.gst, panNumber: x.pan,
      billingTerms: "", poRequired: false, poReference: "", taxNotes: "",
      preferredComm: "Email", preferredDelivery: "Email", handlingInstructions: "", testingRequirements: "", reportingInstructions: "", notes: "",
      createdById: null, updatedById: null,
    });
    clientId[code] = id;
  }
  db.user.find((u) => u.id === clientUserId)!.clientId = clientId["CL-001"];

  // ---- Instruments ----
  const INSTR: [string, string, string, string, string][] = [
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
    const id = genId("instrument");
    db.instrument.push({
      id, code, name, category, manufacturer: mfr, model, serialNumber: null,
      location: "TNTH Main Lab, Vanagaram, Chennai",
      status: code === "HPLC-01" ? "IN_USE" : "AVAILABLE",
      calibrationFrequency: 365, lastCalibrated: ago(50), nextCalibration: ahead(315),
      calibrationStatus: "VALID", columnInfo: null, notes: null,
      createdAt: now, updatedAt: now,
    });
    instrId[code] = id;
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
  for (const [code, name, dosage, ing, ccode] of PROD) {
    const id = genId("product");
    db.product.push({
      id, code, name, description: `${dosage} ${name}`, dosage, form: null,
      monograph: null, activeIngredient: ing, clientId: clientId[ccode],
      createdAt: now, updatedAt: now,
    });
    prodId[code] = id;
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
  const batchId: Record<string, string> = {};
  for (const [pcode, num, qty, status, mfdAgo] of BATCH) {
    const id = genId("batch");
    db.batch.push({
      id, batchNumber: num, productId: prodId[pcode],
      mfgDate: ago(mfdAgo), expDate: ahead(700), quantity: qty,
      releaseStatus: status, releasedAt: status === "APPROVED" ? ago(5) : status === "REJECTED" ? ago(3) : null,
      createdAt: now, updatedAt: now,
    });
    batchId[num] = id;
  }

  // ---- Samples + Tests ----
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

  const instrumentByType: Record<string, string> = {
    ASSAY: instrId["HPLC-01"], DISSOLUTION: instrId["DISS-01"],
    IMPURITY: instrId["LCMSMS-01"], MICROBIOLOGY: instrId["MIC-01"],
    HPLC: instrId["HPLC-02"], GC: instrId["GCMSMS-01"],
    ICPMS: instrId["ICPMS-01"], HPTLC: instrId["HPTLC-01"],
    NMR: instrId["NMR-01"], DSC_TGA: instrId["DSC-01"], SPF: instrId["SPF-01"],
  };

  let sampleSeq = 0;
  let testSeq = 0;
  for (const s of SAMPLES) {
    sampleSeq += 1;
    const code = `SPL-${Y}-${pad(sampleSeq, 5)}`;
    const prod = db.product.find((p) => p.code === s.pcode)!;
    const batch = s.batch ? db.batch.find((b) => b.batchNumber === s.batch) : undefined;
    const sampleId = genId("sample");
    db.sample.push({
      id: sampleId, sampleCode: code, barcode: `B-${code}`,
      clientId: prod.clientId, productId: prod.id, productName: prod.name,
      batchId: batch?.id ?? null, batchNumber: batch?.batchNumber ?? null,
      mfgDate: batch?.mfgDate ?? null, expDate: batch?.expDate ?? null,
      quantity: s.amount, unit: "g", storageCondition: s.cond, storageLocation: s.loc,
      receivedDate: ago(s.recv), priority: s.prio, status: s.status,
      coOwner: "Sample Reception", requestedTests: [s.ttype],
      assignedToId: null, createdById: clientUserId, notes: "Registered via client portal.",
      invoiceId: null, createdAt: now, updatedAt: now,
    });

    if (s.status === "RECEIVED") continue;

    testSeq += 1;
    const testCode = `TST-${Y}-${pad(testSeq, 4)}`;
    const instrumentId = instrumentByType[s.ttype] ?? null;
    const statusFor = (ss: string) => {
      if (ss === "REJECTED") return "REJECTED";
      if (ss === "APPROVED" || ss === "RELEASED") return "APPROVED";
      if (ss === "REVIEW") return "REVIEW";
      if (ss === "TESTING") return "TESTING";
      return "REVIEW";
    };
    const status = statusFor(s.status);
    const pass = s.status !== "REJECTED";
    const assignedToId = s.ttype === "MICROBIOLOGY" ? microId : analystId;
    const testId = genId("test");

    db.test.push({
      id: testId, requestCode: testCode, sampleId, type: s.ttype,
      testName: `${TEST_NAMES[s.ttype] ?? "Analysis"} — ${s.pcode}`,
      method: METHODS[s.ttype] ?? "In-house validated method",
      status, priority: s.prio === "RUSH" ? "RUSH" : "NORMAL",
      assignedToId, instrumentId,
      startedAt: ago(s.recv), completedAt: null, dueDate: ago(s.recv - 6),
      result: status === "REJECTED" ? "FAIL" : status === "APPROVED" ? "PASS" : null,
      resultStatus: status === "REJECTED" ? "FAIL" : status === "APPROVED" ? "PASS" : null,
      worksheetData: null,
      attachments: ["raw/", "worksheet.pdf"].map((n) => `${testCode}/${n}`),
      reviewedById: status === "APPROVED" || status === "REVIEW" ? managerId : null,
      reviewedAt: status === "APPROVED" ? ago(2) : null,
      approvedById: status === "APPROVED" ? qaId : null,
      approvedAt: status === "APPROVED" ? ago(1) : null,
      createdAt: now, updatedAt: now,
    });

    if (s.ttype === "ASSAY") {
      const res = 92 + Math.random() * 12;
      const rv = s.status === "REJECTED" ? 90.2 : Math.min(105, res);
      db.assayResult.push({
        id: genId("assayResult"), testId, apiLabel: "Label claim 100%",
        expectedLow: 95, expectedHigh: 105, resultPercent: rv,
        calculationMethod: "Area normalization",
        observations: pass ? "Peak resolved, no deviation." : "Out-of-spec > limit",
        specPass: pass, instrumentId, chromatogram: null,
        status: status === "TESTING" ? "DRAFT" : "COMPLETED",
        createdAt: now, updatedAt: now,
      });
    } else if (s.ttype === "DISSOLUTION") {
      db.dissolutionResult.push({
        id: genId("dissolutionResult"), testId, apparatus: "USP II", medium: "0.1N HCl",
        rpm: 100, temperature: 37,
        timepoints: [{ t: 15, p: 62 }, { t: 30, p: 84 }, { t: 45, p: 96 }, { t: 60, p: 98 }],
        observations: "Dissolution profile within spec", pass,
        createdAt: now, updatedAt: now,
      });
    } else if (s.ttype === "IMPURITY") {
      db.impurityResult.push({
        id: genId("impurityResult"), testId, impurityName: "Pesticide Residue Screen (multi-residue)",
        type: "RELATED_SUBSTANCE", specLimit: "≤ 0.10 ppm", specMax: 0.10,
        observedValue: pass ? 0.02 : 0.28, analyticalMethod: "LC-MS/MS",
        instrumentId: instrId["LCMSMS-01"], status: "COMPLETED",
        createdAt: now, updatedAt: now,
      });
    } else if (s.ttype === "MICROBIOLOGY") {
      db.microbiologyResult.push({
        id: genId("microbiologyResult"), testId, testType: "TOTAL_BACTERIAL",
        media: "PCA", incubationTemp: 35, incubationTime: 48,
        colonyCount: pass ? 22 : 160, limitSpec: "≤ 100 CFU/g", pass,
        observations: pass ? "Within spec" : "Exceeds limit", instrumentId: null,
        createdAt: now, updatedAt: now,
      });
    }
  }

  // ---- Stability studies ----
  const STUDIES: { product: string; protocol: string; cond: string; start: number }[] = [
    { product: "PRD-0001", protocol: "LONG_TERM", cond: "25°C / 60% RH", start: 0 },
    { product: "PRD-0002", protocol: "ACCELERATED", cond: "40°C / 75% RH", start: 45 },
  ];
  let studySeq = 0;
  for (const st of STUDIES) {
    studySeq += 1;
    const prod = db.product.find((p) => p.code === st.product)!;
    const batch = db.batch[0];
    const studyId = genId("stabilityStudy");
    db.stabilityStudy.push({
      id: studyId, studyId: `STD-${Y}-${pad(studySeq, 3)}`, protocol: st.protocol,
      productId: prod.id, batchId: batch.id, storageCondition: st.cond,
      intervals: ["0M", "3M", "6M", "12M", "24M"],
      startDate: ago(st.start), endDate: ahead(720), status: "ACTIVE",
      createdAt: now, updatedAt: now,
    });
    ["0M", "3M", "6M", "12M", "24M"].forEach((iv, idx) => {
      db.stabilityTimepoint.push({
        id: genId("stabilityTimepoint"), studyId, interval: iv,
        dueDate: ahead(idx * 90),
        status: idx === 0 ? "COMPLETED" : idx === 1 ? "DUE" : "SCHEDULED",
        testId: null, completedAt: idx === 0 ? ago(1) : null,
        result: idx === 0 ? "100.2%" : null, createdAt: now,
      });
    });
  }

  // ---- Deviations / CAPA / Change control ----
  db.deviation.push({
    id: genId("deviation"), deviationId: `DEV-${Y}-0001`,
    sampleId: null, testId: null,
    description: "Recovery above upper limit on LC-MS/MS during trace pesticide screen.",
    category: "ANALYTICAL", impactLevel: "MAJOR",
    rootCause: "Matrix effect not corrected by internal standard",
    correctiveAction: "Re-run with matrix-matched calibration; re-train analyst",
    status: "INVESTIGATING", reportedById: analystId, approvedById: null, closedAt: null,
    createdAt: now, updatedAt: now,
  });
  db.deviation.push({
    id: genId("deviation"), deviationId: `DEV-${Y}-0002`,
    sampleId: null, testId: null,
    description: "Temperature probe deviation on stability chamber.",
    category: "EQUIPMENT", impactLevel: "MINOR",
    rootCause: "Probe sensor drift", correctiveAction: "Calibrate probe",
    status: "OPEN", reportedById: managerId, approvedById: null, closedAt: null,
    createdAt: now, updatedAt: now,
  });

  db.capa.push({
    id: genId("capa"), capaId: `CAPA-${Y}-0001`, title: "LC-MS/MS calibration procedure review",
    type: "PREVENTIVE", description: "Prevent recurrence of matrix-effect deviation",
    rootCause: null, action: "Update SOP LCMS-101 with matrix-matched calibration requirement",
    ownerId: qaId, dueDate: ahead(30), status: "IN_PROGRESS",
    relatedDeviationId: null, effectiveness: null, closedById: null, closedAt: null,
    createdAt: now, updatedAt: now,
  });

  db.changeControl.push({
    id: genId("changeControl"), ccId: `CC-${Y}-0001`, title: "HPLC column change on Instrument B",
    description: "Replace HPLC column with equivalent bonded C18", category: "EQUIPMENT",
    impactAnalysis: { risk: "medium", validation: "Partial IQ/OQ required" },
    justification: "Degraded column", proposedBy: "Meena Ramachandran",
    status: "IMPACT_REVIEW", approvedById: null, decidedAt: null,
    createdAt: now, updatedAt: now,
  });

  // ---- Documents ----
  const DOCS: [string, string, string][] = [
    ["SOP — Sample Receipt & Logging", "SOP"],
    ["Analytical Method — Assay (HPLC)", "TEST_METHOD"],
    ["SOP — Incubator Operation & Monitoring", "SOP"],
    ["Validation Report — LC-MS/MS System", "VALIDATION"],
    ["Certificate of Analysis Template", "COA"],
  ] as unknown as [string, string, string][];
  let docSeq = 0;
  for (const [title, cat] of DOCS as unknown as [string, string][]) {
    docSeq += 1;
    db.document.push({
      id: genId("document"), docCode: `DOC-${Y}-${pad(docSeq, 4)}`, title, category: cat,
      version: "1.0", status: "APPROVED", filePath: null, mimeType: null, fileSize: null,
      signedBy: null, approvedByUserId: qaId, approvedAt: ago(10),
      ownerId: qaId, previousVersionId: null, sampleId: null, reportId: null,
      approverLogic: { owner: qaId, reviewer: managerId },
      digitalSignature: "signed:rcx-iahan",
      createdAt: now, updatedAt: now,
    });
  }

  // ---- Reports ----
  let rptSeq = 0;
  for (const sample of db.sample.filter((x) => x.status === "APPROVED" || x.status === "RELEASED")) {
    const tests = db.test.filter((t) => t.sampleId === sample.id);
    for (const t of tests) {
      rptSeq += 1;
      const reportTypeFor: Record<string, string> = { ASSAY: "ASSAY", DISSOLUTION: "DISSOLUTION", IMPURITY: "IMPURITY", MICROBIOLOGY: "MICROBIOLOGY", HPLC: "HPLC", GC: "GC" };
      db.testReport.push({
        id: genId("testReport"), reportCode: `RPT-${Y}-${pad(rptSeq, 4)}`,
        sampleId: sample.id, batchId: null, testId: t.id,
        type: reportTypeFor[t.type] ?? "TEST", title: `${t.testName} Report`,
        content: { summary: "Conforms to specification", instrument: t.instrumentId },
        pdfPath: null, status: t.status === "APPROVED" ? "RELEASED" : "DRAFT",
        generatedById: managerId, approvedById: qaId,
        approvedAt: t.status === "APPROVED" ? ago(1) : null,
        digitalSignature: "sig:el-approval",
        createdAt: now, updatedAt: now,
      });
    }
  }

  // ---- Invoices ----
  const client1Samples = db.sample.filter((s) => s.clientId === clientId["CL-001"]).slice(0, 4);
  const invId = genId("invoice");
  db.invoice.push({
    id: invId, number: `INV-${Y}-0001`,
    amount: client1Samples.length * 1800, currency: "INR",
    status: client1Samples.some((s) => s.status === "RELEASED") ? "PAID" : "UNPAID",
    issuedAt: ago(3), dueAt: ahead(12), clientId: clientId["CL-001"],
    createdAt: now, updatedAt: now,
  });
  for (const s of client1Samples) s.invoiceId = invId;

  // ---- Audit logs ----
  const AUDIT: [string, string, string | undefined, string | undefined][] = [
    ["USER_LOGIN", "AUTH", "User", adminId],
    ["SAMPLE_CREATED", "SAMPLES", "Sample", client1Samples[0]?.id],
    ["RESULT_ENTERED", "TESTING", "Test", undefined],
    ["REPORT_APPROVED", "QA", "TestReport", undefined],
    ["DEVIATION_OPENED", "QA", "Deviation", undefined],
  ];
  for (const [action, module, et, eid] of AUDIT) {
    db.auditLog.push({
      id: genId("auditLog"), actorId: adminId, action, module,
      entityType: et ?? null, entityId: eid ?? null,
      oldValue: null, newValue: { status: "updated" },
      ip: null, userAgent: null, createdAt: now,
    });
  }

  // ---- Enquiries & Quotations (Module 2 demo data) ----
  const eq = seedEnquiriesAndQuotations(db, { managerId, adminId, clientId });

  // ---- TRFs (Module 3 demo data) ----
  seedTrfs(db, { managerId, adminId, clientId, ...eq });

  return db;
}

function seedEnquiriesAndQuotations(
  db: DB,
  ids: { managerId: string; adminId: string; clientId: Record<string, string> },
) {
  const { managerId, adminId, clientId } = ids;

  function enquiry(opts: {
    customerCode: string; status: string; ageDays: number;
    priority?: string; source?: string;
    products: { name: string; category: string; sampleType: string; tests: { serviceId: string; requestedTest: string; qty: number }[] }[];
  }) {
    const createdAt = ago(opts.ageDays);
    const id = genId("enquiry");
    db.enquiry.push({
      id, enquiryCode: `ENQ-${createdAt.getFullYear()}-${String(db.enquiry.length + 1).padStart(5, "0")}`,
      customerId: clientId[opts.customerCode], enquiryDate: createdAt,
      enquirySource: opts.source ?? "Email", assignedManagerId: managerId,
      priority: opts.priority ?? "Normal", status: opts.status,
      requestedTurnaroundDays: 7,
      purposeOfTesting: "Routine product release testing", regulatoryRequirements: "FSSAI",
      requiredReportingFormat: "PDF Certificate of Analysis", requiredAccreditation: "NABL",
      reportDeliveryMethod: "Email", customerNotes: "",
      createdById: managerId, updatedById: managerId, createdAt, updatedAt: createdAt,
    });
    for (const p of opts.products) {
      const productId = genId("enquiryProduct");
      db.enquiryProduct.push({
        id: productId, enquiryId: id, productName: p.name, productCategory: p.category,
        productDescription: "", batchNumber: "", sampleType: p.sampleType, sampleMatrix: "",
        quantity: 2, quantityUnit: "kg", packagingDetails: "Sealed food-grade pouch",
        storageRequirements: "Store at 4-8°C", specialHandlingInstructions: "",
        requestedTestingDate: null, notes: "", createdAt, updatedAt: createdAt,
      });
      for (const t of p.tests) {
        db.enquiryTestRequest.push({
          id: genId("enquiryTestRequest"), enquiryProductId: productId,
          serviceId: t.serviceId, customRequest: false, customServiceName: null,
          requestedTest: t.requestedTest, requestedMethod: null, specification: "",
          requestedQuantity: t.qty, specialRequirements: "", estimatedTurnaroundDays: 7,
          createdAt, updatedAt: createdAt,
        });
      }
    }
    return { id, createdAt };
  }

  // 1. A brand-new enquiry with no quotation yet.
  enquiry({
    customerCode: "CL-002", status: "NEW", ageDays: 2,
    products: [{ name: "Turmeric Powder (spice export lot)", category: "Spices", sampleType: "Powder", tests: [
      { serviceId: "contaminants-residues", requestedTest: "Pesticide residue screen", qty: 1 },
      { serviceId: "microbial-analysis", requestedTest: "Total plate count", qty: 1 },
    ] }],
  });

  // 2. An enquiry with a quotation sent, awaiting customer decision.
  const enq2 = enquiry({
    customerCode: "CL-002", status: "QUOTATION_SENT", ageDays: 10, priority: "High",
    products: [{ name: "Packaged Fruit Juice — Export Lot", category: "Beverages", sampleType: "Liquid", tests: [
      { serviceId: "vitamin-analysis", requestedTest: "Vitamin C content", qty: 1 },
      { serviceId: "nutritional-labeling", requestedTest: "Total sugar & calorie declaration", qty: 1 },
    ] }],
  });
  {
    const items = [
      { productReference: "Packaged Fruit Juice — Export Lot", serviceName: "Vitamin Analysis", method: "HPLC", quantity: 1, unitPrice: 2500, discount: 0 },
      { productReference: "Packaged Fruit Juice — Export Lot", serviceName: "Nutritional Labeling", method: "Total Mineral Content", quantity: 1, unitPrice: 3200, discount: 200 },
    ];
    const subtotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const discountTotal = items.reduce((a, i) => a + i.discount, 0);
    const taxable = subtotal - discountTotal;
    const taxTotal = Math.round(taxable * 0.18);
    const grand = taxable + taxTotal;
    const qDate = ago(9);
    const qId = genId("quotation");
    db.quotation.push({
      id: qId, quotationCode: `QUO-${qDate.getFullYear()}-00001`, enquiryId: enq2.id, customerId: clientId["CL-002"],
      quotationDate: qDate, validUntil: ahead(20), revisionNumber: 1, previousVersionId: null,
      status: "SENT", subtotal, discountTotal, taxableAmount: taxable, taxTotal, grandTotal: grand,
      currency: "INR", paymentTerms: "50% advance, balance on report delivery", advancePaymentRequired: true, poRequired: false,
      billingNotes: "", preparedById: managerId, approvedById: adminId, approvedAt: ago(7), sentAt: ago(6),
      acceptanceStatus: "PENDING", acceptanceDate: null, acceptedById: null, poNumber: null, acceptanceNotes: null, rejectionReason: null,
      revisionReason: null, createdAt: qDate, updatedAt: ago(6),
    });
    for (const it of items) {
      db.quotationItem.push({
        id: genId("quotationItem"), quotationId: qId, testRequestId: null,
        productReference: it.productReference, serviceName: it.serviceName, method: it.method,
        quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount, taxCategory: "GST 18%",
        taxAmount: Math.round((it.quantity * it.unitPrice - it.discount) * 0.18), lineTotal: it.quantity * it.unitPrice - it.discount + Math.round((it.quantity * it.unitPrice - it.discount) * 0.18),
        estimatedTurnaroundDays: 7, createdAt: qDate, updatedAt: qDate,
      });
    }
  }

  // 3. A fully accepted enquiry/quotation — the kind of record Module 3 (TRF) will pick up.
  const enq3 = enquiry({
    customerCode: "CL-006", status: "ACCEPTED", ageDays: 25, priority: "Normal",
    products: [{ name: "Basmati Rice — Pesticide Residue", category: "Grains", sampleType: "Grain", tests: [
      { serviceId: "contaminants-residues", requestedTest: "Multi-residue pesticide panel", qty: 1 },
    ] }],
  });
  {
    const items = [
      { productReference: "Basmati Rice — Pesticide Residue", serviceName: "Contaminants & Residues", method: "GC-MS", quantity: 1, unitPrice: 4500, discount: 0 },
    ];
    const subtotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const discountTotal = 0;
    const taxable = subtotal - discountTotal;
    const taxTotal = Math.round(taxable * 0.18);
    const grand = taxable + taxTotal;
    const qDate = ago(24);
    const qId = genId("quotation");
    db.quotation.push({
      id: qId, quotationCode: `QUO-${qDate.getFullYear()}-00002`, enquiryId: enq3.id, customerId: clientId["CL-006"],
      quotationDate: qDate, validUntil: ahead(5), revisionNumber: 1, previousVersionId: null,
      status: "ACCEPTED", subtotal, discountTotal, taxableAmount: taxable, taxTotal, grandTotal: grand,
      currency: "INR", paymentTerms: "Net 15", advancePaymentRequired: false, poRequired: true,
      billingNotes: "", preparedById: managerId, approvedById: adminId, approvedAt: ago(22), sentAt: ago(21),
      acceptanceStatus: "ACCEPTED", acceptanceDate: ago(18), acceptedById: managerId, poNumber: "PO-VRIDHI-8841",
      acceptanceNotes: "Confirmed by phone, PO to follow by email.", rejectionReason: null,
      revisionReason: null, createdAt: qDate, updatedAt: ago(18),
    });
    for (const it of items) {
      db.quotationItem.push({
        id: genId("quotationItem"), quotationId: qId, testRequestId: null,
        productReference: it.productReference, serviceName: it.serviceName, method: it.method,
        quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount, taxCategory: "GST 18%",
        taxAmount: Math.round((it.quantity * it.unitPrice - it.discount) * 0.18), lineTotal: it.quantity * it.unitPrice - it.discount + Math.round((it.quantity * it.unitPrice - it.discount) * 0.18),
        estimatedTurnaroundDays: 7, createdAt: qDate, updatedAt: qDate,
      });
    }
    return { acceptedQuotationId: qId, acceptedEnquiryId: enq3.id, acceptedCustomerCode: "CL-006" };
  }
}

function seedTrfs(
  db: DB,
  ids: { managerId: string; adminId: string; clientId: Record<string, string>; acceptedQuotationId: string; acceptedCustomerCode: string },
) {
  const { managerId, clientId, acceptedQuotationId, acceptedCustomerCode } = ids;
  const createdAt = ago(15);
  const trfId = genId("trf");
  db.trf.push({
    id: trfId, trfCode: `TRF-${createdAt.getFullYear()}-00001`, customerId: clientId[acceptedCustomerCode],
    quotationId: acceptedQuotationId, quotationRevisionSnapshot: 1, poNumber: "PO-VRIDHI-8841",
    acceptedChargesSnapshot: 4500, paymentTermsSnapshot: "Net 15",
    status: "ACCEPTED", priority: "Normal", requestedDueDate: ahead(10), agreedTurnaroundDays: 7,
    specialDeadlineInstructions: "", storageCondition: "Ambient", storageTemperature: "",
    specialHandlingInstructions: "Keep dry, avoid direct sunlight", lightSensitive: false, moistureSensitive: true,
    otherStorageNotes: "", reportRecipient: "Kavitha Muthu", reportEmail: "kavitha@vridhi.example",
    reportingUnits: "Metric (SI)", reportLanguage: "English", conformityStatementRequested: true,
    applicableSpecification: "Codex Alimentarius CXS 198-1995", reportingInstructions: "",
    submittedAt: ago(14), submittedById: managerId, holdReason: null, rejectionReason: null, clarificationComments: null,
    receiptStatus: "PENDING", receiptConfirmedAt: null, receiptConfirmedById: null,
    createdById: managerId, updatedById: managerId, createdAt, updatedAt: ago(14),
  });
  const sampleId = genId("trfSample");
  db.trfSample.push({
    id: sampleId, trfId, sampleName: "Basmati Rice — Lot A", productCategory: "Grains", brandName: "Vridhi Gold",
    batchNumber: "VR-2026-A1", customerSampleRef: "SMP-001", quantity: 2, quantityUnit: "kg", containers: 2,
    packagingType: "Sealed food-grade pouch", manufacturer: "Vridhi Agro Exports", manufacturingDate: ago(40),
    expiryDate: ahead(300), declaredComposition: "100% Basmati rice", labelClaim: "Premium export grade",
    productDescription: "Export-grade basmati rice for pesticide residue screening.",
    sampledBy: "Customer", samplingDate: ago(16), samplingLocation: "Vridhi Agro Exports, Salem", samplingProcedure: "",
    createdAt, updatedAt: createdAt,
  });
  db.trfTestRequest.push({
    id: genId("trfTestRequest"), trfSampleId: sampleId, serviceId: "contaminants-residues", customRequest: false, customServiceName: null,
    requestedParameter: "Multi-residue pesticide panel", preferredMethod: "GC-MS", specification: "FSSAI limits",
    testingPurpose: "Export compliance", requiredQuantity: "500 g", customerRequirements: "", subcontractingPreference: "",
    createdAt, updatedAt: createdAt,
  });
  db.trfAuthorization.push({
    id: genId("trfAuthorization"), trfId, status: "AUTHORIZED", authorizedPersonName: "Kavitha Muthu",
    authorizedPersonDesignation: "Quality Manager", authorizationDate: ago(15), authorizationMethod: "Signed TRF Upload",
    signedTrfDocumentId: null, notes: "", createdAt, updatedAt: createdAt,
  });
  db.trfReviewHistory.push(
    { id: genId("trfReviewHistory"), trfId, action: "SUBMITTED", actorId: managerId, comment: null, fromStatus: "DRAFT", toStatus: "SUBMITTED", createdAt: ago(14) },
    { id: genId("trfReviewHistory"), trfId, action: "REVIEW_STARTED", actorId: managerId, comment: null, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", createdAt: ago(13) },
    { id: genId("trfReviewHistory"), trfId, action: "ACCEPTED", actorId: managerId, comment: null, fromStatus: "UNDER_REVIEW", toStatus: "ACCEPTED", createdAt: ago(12) },
  );
}
