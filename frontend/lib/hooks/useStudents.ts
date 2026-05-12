"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export interface StudentContact {
  id: string;
  student_id: string;
  first_name: string;
  last_name?: string | null;
  relation: string;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  occupation?: string | null;
  home_address?: string | null;
  is_parent: boolean;
  is_primary_contact: boolean;
  can_pickup: boolean;
  receives_sms: boolean;
  is_alive: boolean;
  notes?: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  student_number: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  home_address?: string | null;
  admission_date?: string | null;
  status: "active" | "graduated" | "transferred" | "withdrawn";
  house?: string | null;
  programme?: string | null;
  notes?: string | null;
  contacts: StudentContact[];
  created_at: string;
}

export interface StudentFilters {
  search?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

export function useStudents(filters: StudentFilters = {}) {
  const slug = useSlug();
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.skip !== undefined) params.skip = filters.skip;
  if (filters.limit !== undefined) params.limit = filters.limit;

  return useQuery<Student[]>({
    queryKey: [slug, "students", filters],
    queryFn: () => studentsApi.list(params),
    enabled: !!slug,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useStudent(id: string) {
  const slug = useSlug();
  return useQuery<Student>({
    queryKey: [slug, "students", id],
    queryFn: () => studentsApi.get(id),
    enabled: !!id && !!slug,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => studentsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "students"] }),
  });
}

export function useUpdateStudent(id: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => studentsApi.update(id, body),
    onSuccess: (updated: Student) => {
      // update the individual cache entry immediately, then bust the list
      qc.setQueryData([slug, "students", id], updated);
      qc.invalidateQueries({ queryKey: [slug, "students"] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "students"] }),
  });
}

export function useAddContact(studentId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => studentsApi.addContact(studentId, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [slug, "students", studentId] }),
  });
}

export function usePortalActions(studentId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [slug, "students", studentId] });

  const enable = useMutation({
    mutationFn: () => studentsApi.enablePortal(studentId),
    onSuccess: invalidate,
  });
  const disable = useMutation({
    mutationFn: () => studentsApi.disablePortal(studentId),
    onSuccess: invalidate,
  });
  const resetPin = useMutation({
    mutationFn: () => studentsApi.resetPin(studentId),
    onSuccess: invalidate,
  });

  return { enable, disable, resetPin };
}
