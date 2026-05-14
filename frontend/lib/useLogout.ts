"use client";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./store";

export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useCallback(() => {
    clearAuth();
    queryClient.clear();
  }, [clearAuth, queryClient]);
}
