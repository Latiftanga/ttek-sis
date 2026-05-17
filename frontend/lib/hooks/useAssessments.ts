"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assessmentsApi,
  type Assessment,
  type AssessmentCategory,
  type AssessmentCreateBody,
  type AssessmentUpdateBody,
  type BulkScoreBody,
  type ComputeResult,
  type GradebookResponse,
  type GradingScale,
  type LockResult,
  type ScoreEditBody,
  type ScoreEditLog,
  type StudentTermReport,
  type StudentTermBreakdown,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

// ── Queries ───────────────────────────────────────────────────────────────

export function useAssessments(params?: {
  class_id?: string;
  subject_id?: string;
  term_id?: string;
}) {
  const slug = useSlug();
  const queryParams: Record<string, string> = {};
  if (params?.class_id) queryParams.class_id = params.class_id;
  if (params?.subject_id) queryParams.subject_id = params.subject_id;
  if (params?.term_id) queryParams.term_id = params.term_id;

  return useQuery<Assessment[]>({
    queryKey: [slug, "assessments", queryParams],
    queryFn: () => assessmentsApi.list(queryParams),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useAssessmentCategories() {
  const slug = useSlug();
  return useQuery<AssessmentCategory[]>({
    queryKey: [slug, "assessment-categories"],
    queryFn: () => assessmentsApi.listCategories(),
    enabled: !!slug,
    staleTime: 10 * 60_000,
  });
}

export function useGradingScales() {
  const slug = useSlug();
  return useQuery<GradingScale[]>({
    queryKey: [slug, "grading-scales"],
    queryFn: () => assessmentsApi.listScales(),
    enabled: !!slug,
    staleTime: Infinity,
  });
}

export function useGradebook(assessmentId: string | null) {
  const slug = useSlug();
  return useQuery<GradebookResponse>({
    queryKey: [slug, "gradebook", assessmentId],
    queryFn: () => assessmentsApi.getGradebook(assessmentId!),
    enabled: !!slug && !!assessmentId,
  });
}

export function useScoreHistory(
  assessmentId: string | null,
  studentId: string | null,
) {
  const slug = useSlug();
  return useQuery<ScoreEditLog[]>({
    queryKey: [slug, "score-history", assessmentId, studentId],
    queryFn: () => assessmentsApi.getScoreHistory(assessmentId!, studentId!),
    enabled: !!slug && !!assessmentId && !!studentId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function useCreateAssessment() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssessmentCreateBody) => assessmentsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessments"] });
    },
  });
}

export function useCreateCategory() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      weight: number;
      max_score: number;
      is_ca: boolean;
      allows_multiple: boolean;
      order: number;
    }) => assessmentsApi.createCategory(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessment-categories"] });
    },
  });
}

export function useUpdateCategory() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<{
        name: string;
        weight: number;
        max_score: number;
        is_ca: boolean;
        allows_multiple: boolean;
        order: number;
        is_active: boolean;
      }>;
    }) => assessmentsApi.updateCategory(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessment-categories"] });
    },
  });
}

export function useDeleteCategory() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assessmentsApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessment-categories"] });
    },
  });
}

export function useCreateScale() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      assessmentsApi.createScale(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useUpdateScale() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; description?: string | null; is_active?: boolean };
    }) => assessmentsApi.updateScale(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useDeleteScale() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assessmentsApi.deleteScale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useAddGrade() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      scaleId,
      body,
    }: {
      scaleId: string;
      body: {
        min_score: number;
        max_score: number;
        label: string;
        remark?: string;
        order: number;
      };
    }) => assessmentsApi.addGrade(scaleId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useUpdateGrade() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      scaleId,
      gradeId,
      body,
    }: {
      scaleId: string;
      gradeId: string;
      body: Partial<{
        min_score: number;
        max_score: number;
        label: string;
        remark: string | null;
        order: number;
      }>;
    }) => assessmentsApi.updateGrade(scaleId, gradeId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useDeleteGrade() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scaleId, gradeId }: { scaleId: string; gradeId: string }) =>
      assessmentsApi.deleteGrade(scaleId, gradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "grading-scales"] });
    },
  });
}

export function useUpdateAssessment(assessmentId: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssessmentUpdateBody) =>
      assessmentsApi.update(assessmentId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessments"] });
      qc.invalidateQueries({ queryKey: [slug, "gradebook", assessmentId] });
    },
  });
}

export function useDeleteAssessment() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) => assessmentsApi.delete(assessmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessments"] });
    },
  });
}

export function usePublishAssessment(assessmentId: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => assessmentsApi.publish(assessmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessments"] });
      qc.invalidateQueries({ queryKey: [slug, "gradebook", assessmentId] });
    },
  });
}

export function useUnpublishAssessment(assessmentId: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => assessmentsApi.unpublish(assessmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "assessments"] });
      qc.invalidateQueries({ queryKey: [slug, "gradebook", assessmentId] });
    },
  });
}

export function useBulkScore(assessmentId: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkScoreBody) =>
      assessmentsApi.bulkScore(assessmentId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [slug, "gradebook", assessmentId] });
    },
  });
}

export function useComputeTermResults() {
  return useMutation<
    ComputeResult,
    Error,
    { class_id: string; term_id: string; subject_id?: string }
  >({
    mutationFn: (body) => assessmentsApi.computeTermResults(body),
  });
}

export function useLockTermResults() {
  return useMutation<LockResult, Error, { class_id: string; term_id: string }>({
    mutationFn: (body) => assessmentsApi.lockTermResults(body),
  });
}

export function useEditScore(assessmentId: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, body }: { studentId: string; body: ScoreEditBody }) =>
      assessmentsApi.editScore(assessmentId, studentId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [slug, "gradebook", assessmentId] });
      qc.invalidateQueries({
        queryKey: [slug, "score-history", assessmentId, vars.studentId],
      });
    },
  });
}

export function useStudentReport(
  studentId: string | null,
  termId: string | null,
) {
  const slug = useSlug();
  return useQuery<StudentTermReport>({
    queryKey: [slug, "student-report", studentId, termId],
    queryFn: () =>
      assessmentsApi.studentReport(studentId!, termId ? { term_id: termId } : undefined),
    enabled: !!slug && !!studentId,
  });
}

export function useClassReports(
  classId: string | null,
  termId: string | null,
) {
  const slug = useSlug();
  return useQuery<StudentTermReport[]>({
    queryKey: [slug, "class-reports", classId, termId],
    queryFn: () =>
      assessmentsApi.classReports(classId!, termId ? { term_id: termId } : undefined),
    enabled: !!slug && !!classId,
  });
}

export function useStudentBreakdown(
  studentId: string | null,
  termId: string | null,
) {
  const slug = useSlug();
  return useQuery<StudentTermBreakdown>({
    queryKey: [slug, "student-breakdown", studentId, termId],
    queryFn: () =>
      assessmentsApi.studentBreakdown(
        studentId!,
        termId ? { term_id: termId } : undefined,
      ),
    enabled: !!slug && !!studentId,
  });
}
