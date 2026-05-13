"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicApi, schoolApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  level_group: string;
  level_number: number | null;
  stream: string | null;
  programme: string | null;
  capacity: number;
  is_active: boolean;
  is_bece_level: boolean;
  is_wassce_level: boolean;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  category: string;
  level_group: string;
  created_at: string;
}

export interface ClassStudent {
  enrollment_id: string;
  student_id: string;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  is_boarding: boolean;
}

export interface SchoolProgramme {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

// ── Queries ───────────────────────────────────────────────────────────────

export function useAcademicYears() {
  const slug = useSlug();
  return useQuery<AcademicYear[]>({
    queryKey: [slug, "academic-years"],
    queryFn: () => academicApi.listYears(),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useTerms(yearId: string | null) {
  const slug = useSlug();
  return useQuery<Term[]>({
    queryKey: [slug, "terms", yearId],
    queryFn: () => academicApi.listTerms(yearId!),
    enabled: !!slug && !!yearId,
    staleTime: 5 * 60_000,
  });
}

export function useClasses(isActive?: boolean) {
  const slug = useSlug();
  const params: Record<string, string> = {};
  if (isActive !== undefined) params.is_active = String(isActive);
  return useQuery<Class[]>({
    queryKey: [slug, "classes", isActive],
    queryFn: () => academicApi.listClasses(params),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useClassStudents(classId: string | null, yearId?: string) {
  const slug = useSlug();
  return useQuery<ClassStudent[]>({
    queryKey: [slug, "class-students", classId, yearId],
    queryFn: () => academicApi.getClassStudents(classId!, yearId),
    enabled: !!slug && !!classId,
  });
}

export function useSubjects() {
  const slug = useSlug();
  return useQuery<Subject[]>({
    queryKey: [slug, "subjects"],
    queryFn: () => academicApi.listSubjects(),
    enabled: !!slug,
    staleTime: 10 * 60_000,
  });
}

export function useSchoolProgrammes() {
  const slug = useSlug();
  return useQuery<SchoolProgramme[]>({
    queryKey: ["school-programmes", slug],
    queryFn: () => schoolApi.listProgrammes(),
    enabled: !!slug,
    staleTime: Infinity,
  });
}

// ── Year mutations ────────────────────────────────────────────────────────

export function useCreateYear() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.createYear(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "academic-years"] }),
  });
}

export function useUpdateYear(id: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.updateYear(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "academic-years"] }),
  });
}

export function useSetCurrentYear() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => academicApi.setCurrentYear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "academic-years"] }),
  });
}

// ── Term mutations ────────────────────────────────────────────────────────

export function useCreateTerm(yearId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.createTerm(yearId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "terms", yearId] }),
  });
}

export function useUpdateTerm(yearId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ termId, body }: { termId: string; body: unknown }) =>
      academicApi.updateTerm(termId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "terms", yearId] }),
  });
}

export function useSetCurrentTerm(yearId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (termId: string) => academicApi.setCurrentTerm(termId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "terms", yearId] });
      qc.invalidateQueries({ queryKey: [slug, "academic-years"] });
    },
  });
}

// ── Class mutations ───────────────────────────────────────────────────────

export function useCreateClass() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.createClass(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "classes"] }),
  });
}

export function useUpdateClass(classId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.updateClass(classId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "classes"] });
      qc.invalidateQueries({ queryKey: [slug, "class", classId] });
    },
  });
}

// ── Class detail + enrollment mutations ──────────────────────────────────

export function useClassDetail(classId: string | null) {
  const slug = useSlug();
  return useQuery<Class>({
    queryKey: [slug, "class", classId],
    queryFn: () => academicApi.getClass(classId!),
    enabled: !!slug && !!classId,
    staleTime: 5 * 60_000,
  });
}

export function useEnrollStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.enroll(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function usePromoteStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: unknown }) =>
      academicApi.promoteStudent(enrollmentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function useRepeatStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: unknown }) =>
      academicApi.repeatStudent(enrollmentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function useTransferStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: unknown }) =>
      academicApi.transferStudent(enrollmentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function useGraduateStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: unknown }) =>
      academicApi.graduateStudent(enrollmentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function useBulkPromote() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.bulkPromote(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

// ── Subject mutations ─────────────────────────────────────────────────────

export function useCreateSubject() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.createSubject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "subjects"] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => academicApi.deleteSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "subjects"] }),
  });
}
