"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolApi, type SchoolProfile } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

export function useSchoolProfile() {
  const slug = useSlug();
  return useQuery<SchoolProfile>({
    queryKey: [slug, "school", "profile"],
    queryFn: () => schoolApi.getProfile(),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useUpdateSchoolProfile() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<SchoolProfile, "id" | "slug" | "subscription">>) =>
      schoolApi.updateProfile(body),
    onSuccess: (updated) => {
      qc.setQueryData([slug, "school", "profile"], updated);
      // Sync auth store so BrandingProvider immediately picks up the new
      // accent_color / name / logo_url without requiring a re-login.
      useAuthStore.setState((state) => ({
        school: state.school
          ? {
              ...state.school,
              name:         updated.name,
              accent_color: updated.accent_color,
              logo_url:     updated.logo_url ?? undefined,
            }
          : null,
      }));
    },
  });
}
