import NotFound from "../not-found";

// Catch-all for any URL inside (dashboard) that has no matching page.
// Renders the segment's not-found UI within the dashboard layout so the
// sidebar stays mounted and back-button navigation doesn't remount AuthGuard.
//
// We render <NotFound /> directly rather than throwing via notFound(): on
// Next.js 16 + Turbopack a synchronously-throwing page component triggers
// a "negative time stamp" error from performance.measure instrumentation.
export default function CatchAllPage() {
  return <NotFound />;
}
