import { notFound } from "next/navigation";

// Catch-all for any URL that has no matching page inside the (dashboard)
// segment. Calling notFound() here triggers app/(dashboard)/not-found.tsx,
// which renders within the layout so the sidebar stays mounted and the
// browser back button works without remounting AuthGuard.
export default function CatchAllPage(): never {
  notFound();
}
