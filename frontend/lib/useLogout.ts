"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./store";

/**
 * Centralised logout: clears auth state AND the React Query cache so no
 * stale data from the previous tenant is visible to the next login.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return () => {
    clearAuth();
    queryClient.clear();
  };
}
