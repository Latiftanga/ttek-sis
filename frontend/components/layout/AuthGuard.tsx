"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, accessToken, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait until the persist store has finished reading from localStorage
    // before making any redirect decision — avoids false logout on reload.
    if (_hasHydrated && (!user || !accessToken)) {
      router.replace("/login");
    }
  }, [_hasHydrated, user, accessToken, router]);

  if (!_hasHydrated || !user || !accessToken) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"
      >
        <div
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
