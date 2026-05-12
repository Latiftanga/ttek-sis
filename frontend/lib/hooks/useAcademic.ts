"use client";
import { useQuery } from "@tanstack/react-query";
import { academicApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

export interface Class {
  id: string;
  name: string;
  level_group: string;
  level_number: number | null;
  stream: string | null;
  programme: string | null;
  is_active: boolean;
  capacity: number;
}

export function useAcademicYears() {
  const slug = useAuthStore((s) => s.school?.slug);
  return useQuery<AcademicYear[]>({
    queryKey: [slug, "academic-years"],
    queryFn: () => academicApi.listYears(),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useClasses() {
  const slug = useAuthStore((s) => s.school?.slug);
  return useQuery<Class[]>({
    queryKey: [slug, "classes"],
    queryFn: () => academicApi.listClasses({ is_active: "true" }),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}
