import { Splash } from "@/components/layout/splash";

// Root-level Suspense fallback — Next.js shows this automatically on the
// very first request to any route while the server checks the session and
// resolves the destination (login vs. app). No artificial delay: it only
// renders for as long as that server work actually takes.
export default function RootLoading() {
  return <Splash />;
}
