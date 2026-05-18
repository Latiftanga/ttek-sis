"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export type Outcome =
  | "promoted"
  | "repeated"
  | "graduated"
  | "transferred"
  | "withdrawn";

export interface RolloverClassBrief {
  id: string;
  name: string;
  level_group: string;
  level_number: number | null;
  stream: string | null;
}

export interface RolloverPreviewRow {
  student_id: string;
  enrollment_id: string;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  photo_url: string | null;
  year_aggregate: number | null;
  attendance_pct: number | null;
}

export interface RolloverPreviewResponse {
  source_class_id: string;
  source_class_name: string;
  source_academic_year_id: string;
  source_academic_year_name: string;
  target_academic_year_id: string;
  target_academic_year_name: string;
  is_terminal_class: boolean;
  rows: RolloverPreviewRow[];
  target_classes: RolloverClassBrief[];
}

export interface RolloverDecision {
  enrollment_id: string;
  student_id: string;
  outcome: Outcome;
  target_class_id?: string | null;
  reason?: string | null;
}

export interface RolloverCommitRequest {
  source_class_id: string;
  source_academic_year_id: string;
  target_academic_year_id: string;
  decisions: RolloverDecision[];
  end_date?: string;
  new_start_date?: string;
}

export interface RolloverCommitResponse {
  closed_count: number;
  opened_count: number;
  graduated_count: number;
  withdrawn_count: number;
  message: string;
}

const rolloverApi = {
  preview: (params: {
    source_class_id: string;
    source_academic_year_id: string;
    target_academic_year_id: string;
  }): Promise<RolloverPreviewResponse> =>
    api.get("/rollover/preview", { params }).then((r) => r.data),

  commit: (body: RolloverCommitRequest): Promise<RolloverCommitResponse> =>
    api.post("/rollover/commit", body).then((r) => r.data),
};

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

export function useRolloverPreview(args: {
  sourceClassId: string | null;
  sourceYearId: string | null;
  targetYearId: string | null;
}) {
  const slug = useSlug();
  const enabled =
    !!slug && !!args.sourceClassId && !!args.sourceYearId && !!args.targetYearId;
  return useQuery<RolloverPreviewResponse>({
    queryKey: [
      slug, "rollover-preview",
      args.sourceClassId, args.sourceYearId, args.targetYearId,
    ],
    queryFn: () =>
      rolloverApi.preview({
        source_class_id: args.sourceClassId!,
        source_academic_year_id: args.sourceYearId!,
        target_academic_year_id: args.targetYearId!,
      }),
    enabled,
    // Decisions are unsaved local state; if the user navigates away and
    // back, we want a fresh server snapshot rather than stale data that
    // might have been changed by another admin.
    staleTime: 0,
  });
}

export function useCommitRollover() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation<RolloverCommitResponse, Error, RolloverCommitRequest>({
    mutationFn: (body) => rolloverApi.commit(body),
    onSuccess: () => {
      // Enrollment state has changed for the whole class — flush related
      // queries so other pages don't show stale rosters.
      qc.invalidateQueries({ queryKey: [slug, "rollover-preview"] });
      qc.invalidateQueries({ queryKey: [slug, "students"] });
      qc.invalidateQueries({ queryKey: [slug, "classes"] });
    },
  });
}
