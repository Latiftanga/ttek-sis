"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";

type Status = "loading" | "authed" | "unauthed";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const check = async () => {
      const { user, accessToken } = useAuthStore.getState();

      if (!user) {
        setStatus("unauthed");
        return;
      }

      if (accessToken) {
        setStatus("authed");
        return;
      }

      // User metadata is persisted but the access token is in-memory only.
      // On page reload the token is gone — attempt a silent refresh via the
      // httpOnly refresh_token cookie before redirecting to login.
      try {
        const data = await authApi.refresh();
        useAuthStore.getState().setAccessToken(data.access_token);
        setStatus("authed");
      } catch {
        useAuthStore.getState().clearAuth();
        setStatus("unauthed");
      }
    };

    if (useAuthStore.persist.hasHydrated()) {
      check();
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(check);
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (status === "unauthed") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authed") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950"
      >
        <div
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading your school…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
