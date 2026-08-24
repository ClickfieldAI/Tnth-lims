const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  for (const [k, v] of Object.entries({
    users: p.user.count(), clients: p.client.count(), products: p.product.count(),
    batches: p.batch.count(), samples: p.sample.count(), tests: p.test.count(),
    instruments: p.instrument.count(), studies: p.stabilityStudy.count(),
    deviations: p.deviation.count(), capas: p.capa.count(), changeControls: p.changeControl.count(),
    docs: p.document.count(), reports: p.testReport.count(), invoices: p.invoice.count(),
    auditLogs: p.auditLog.count(), timepoints: p.stabilityTimepoint.count(),
    assayResults: p.assayResult.count(), dissolutionResults: p.dissolutionResult.count(),
    impurityResults: p.impurityResult.count(), microResults: p.microbiologyResult.count(),
  })) {
    console.log(k, await v);
  }
  await p.$disconnect();
})();