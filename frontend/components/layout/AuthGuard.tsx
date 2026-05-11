"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  // `useEffect` only runs on the client. By the time it fires, Zustand's
  // persist middleware has already read localStorage synchronously and
  // restored the auth state — so reading `user`/`accessToken` after setting
  // hydrated=true will always reflect the real persisted values.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && (!user || !accessToken)) {
      router.replace("/login");
    }
  }, [hydrated, user, accessToken, router]);

  if (!hydrated || !user || !accessToken) {
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
