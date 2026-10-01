// Runs once when a server instance boots (Next.js instrumentation hook),
// before it starts handling requests — used only to seed the demo
// workflow data (see lib/mock/demo-workflow-seed.ts) on top of the base
// mock dataset. No-op in the test runner (vitest never imports this file).
export async function register() {
  const { ensureDemoSeeded } = await import("./lib/mock/demo-workflow-seed");
  await ensureDemoSeeded();
}
