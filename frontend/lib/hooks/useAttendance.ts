"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  attendanceApi,
  type AttendanceSession,
  type AttendanceRecord,
  type ClassAttendanceSummary,
  type SchoolAttendanceToday,
  type AttendanceAlertsResponse,
  type SessionCreateBody,
  type SessionSubmitBody,
  type RecordEditBody,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

// Today's summary for a single class — drives the "Not started / In progress
// / Submitted" badges on the attendance home page.
export function useClassToday(classId: string | null) {
  const slug = useSlug();
  return useQuery<ClassAttendanceSummary>({
    queryKey: [slug, "attendance", "class-today", classId],
    queryFn: () => attendanceApi.getTodayForClass(classId!),
    enabled: !!slug && !!classId,
    staleTime: 30_000,
  });
}

// School-wide snapshot for the admin "today" view.
export function useSchoolToday() {
  const slug = useSlug();
  return useQuery<SchoolAttendanceToday>({
    queryKey: [slug, "attendance", "school-today"],
    queryFn: () => attendanceApi.getSchoolToday(),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

// Flagged sessions + at-risk students for the admin alerts panel.
export function useAlerts() {
  const slug = useSlug();
  return useQuery<AttendanceAlertsResponse>({
    queryKey: [slug, "attendance", "alerts"],
    queryFn: () => attendanceApi.getAlerts(),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

// Sessions list, scoped by params (class_id, date, etc.).
export function useSessions(params?: Record<string, string>) {
  const slug = useSlug();
  return useQuery<AttendanceSession[]>({
    queryKey: [slug, "attendance", "sessions", params],
    queryFn: () => attendanceApi.listSessions(params),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

// Records for a single session — used by the roster screen in read mode.
export function useSessionRecords(sessionId: string | null) {
  const slug = useSlug();
  return useQuery<AttendanceRecord[]>({
    queryKey: [slug, "attendance", "records", sessionId],
    queryFn: () => attendanceApi.listRecords(sessionId!),
    enabled: !!slug && !!sessionId,
  });
}

// Open a new session for today's attendance (called when teacher taps "Take
// attendance"). Returns the session including its server-assigned id.
export function useCreateSession() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SessionCreateBody) => attendanceApi.createSession(body),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: [slug, "attendance"] });
      qc.invalidateQueries({
        queryKey: [slug, "attendance", "class-today", session.class_id],
      });
    },
  });
}

// Submit the full set of records for a session — locks it.
export function useSubmitSession() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: string; body: SessionSubmitBody }) =>
      attendanceApi.submitSession(sessionId, body),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: [slug, "attendance"] });
      qc.invalidateQueries({
        queryKey: [slug, "attendance", "class-today", session.class_id],
      });
    },
  });
}

// Patch one record (correction). Backend requires edit_reason.
export function usePatchRecord() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, body }: { recordId: string; body: RecordEditBody }) =>
      attendanceApi.patchRecord(recordId, body),
    onSuccess: (record) => {
      qc.invalidateQueries({
        queryKey: [slug, "attendance", "records", record.session_id],
      });
    },
  });
}
