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
  school_id: string;
  name: string;
  code: string | null;
  category: string | null;   // SHS only — null for basic schools
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
  short_name: string | null;
  description: string | null;
}

export interface SchoolHouse {
  id: string;
  name: string;
  color: string | null;
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

export function useSchoolProgrammes(ownOnly = false) {
  const slug = useSlug();
  return useQuery<SchoolProgramme[]>({
    queryKey: ["school-programmes", slug, ownOnly],
    queryFn: () => schoolApi.listProgrammes(ownOnly),
    enabled: !!slug,
    staleTime: Infinity,
  });
}

export function useSchoolHouses() {
  const slug = useSlug();
  return useQuery<SchoolHouse[]>({
    queryKey: ["school-houses", slug],
    queryFn: () => schoolApi.listHouses(),
    enabled: !!slug,
    staleTime: Infinity,
  });
}

export function useCreateProgramme() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: { name: string; short_name: string; description?: string; order?: number }) =>
      schoolApi.createProgramme(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-programmes", slug] }),
  });
}

export function useUpdateProgramme() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; short_name?: string; description?: string }) =>
      schoolApi.updateProgramme(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-programmes", slug] }),
  });
}

export function useDeleteProgramme() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => schoolApi.deleteProgramme(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-programmes", slug] }),
  });
}

export function useCreateHouse() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: { name: string; color?: string; order?: number }) =>
      schoolApi.createHouse(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-houses", slug] }),
  });
}

export function useUpdateHouse() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string }) =>
      schoolApi.updateHouse(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-houses", slug] }),
  });
}

export function useDeleteHouse() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => schoolApi.deleteHouse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-houses", slug] }),
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

export function useDemoteStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: unknown }) =>
      academicApi.demoteStudent(enrollmentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

export function useUnenrollStudent() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (enrollmentId: string) => academicApi.unenroll(enrollmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-students"] }),
  });
}

// ── Class subjects (curriculum + teacher assignment) ──────────────────────

export interface ClassSubjectRow {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  subject_category: string;
  teacher_id: string | null;
  teacher_name: string | null;
  order: number;
}

export function useClassSubjects(classId: string | null) {
  const slug = useSlug();
  return useQuery<ClassSubjectRow[]>({
    queryKey: [slug, "class-subjects", classId],
    queryFn: () => academicApi.listClassSubjects(classId!),
    enabled: !!slug && !!classId,
  });
}

export function useAddClassSubject(classId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => academicApi.addClassSubject(classId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-subjects", classId] }),
  });
}

export function useUpdateClassSubject(classId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ csId, body }: { csId: string; body: unknown }) =>
      academicApi.updateClassSubject(classId, csId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-subjects", classId] }),
  });
}

export function useRemoveClassSubject(classId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (csId: string) => academicApi.removeClassSubject(classId, csId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "class-subjects", classId] }),
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

export function useUpdateSubject() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      academicApi.updateSubject(id, body),
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
