"use client";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./store";
import { authApi } from "./api";

export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useCallback(async () => {
    await authApi.logout(); // clears the httpOnly refresh_token cookie server-side
    clearAuth();
    queryClient.clear();
    window.location.href = "/login";
  }, [clearAuth, queryClient]);
}
