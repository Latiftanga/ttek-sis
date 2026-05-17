"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import {
  useStudentReport,
  useStudentBreakdown,
} from "@/lib/hooks/useAssessments";
import { useAcademicYears, useTerms } from "@/lib/hooks/useAcademic";
import { useSchoolProfile } from "@/lib/hooks/useSchool";
import { useAuthStore } from "@/lib/store";
import type { SubjectBreakdown } from "@/lib/api";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ReportCardBody from "@/components/students/ReportCardBody";
import EditTermCardDrawer from "@/components/students/EditTermCardDrawer";

const EDIT_ROLES = new Set([
  "teacher",
  "headteacher",
  "school_admin",
  "superadmin",
]);
const HEADTEACHER_ROLES = new Set([
  "headteacher",
  "school_admin",
  "superadmin",
]);

export default function ReportCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const studentId = params.id;

  const { user } = useAuthStore();
  const canEdit = !!user?.role && EDIT_ROLES.has(user.role);
  const canEditHeadteacher =
    !!user?.role && HEADTEACHER_ROLES.has(user.role);

  const { data: school } = useSchoolProfile();
  const { data: years = [] } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [] } = useTerms(currentYear?.id ?? null);
  const currentTerm = terms.find((t) => t.is_current);

  const [editOpen, setEditOpen] = useState(false);

  // ?term_id=... wins so a deep link to a past term works.
  const urlTermId = search.get("term_id");
  const [termId, setTermId] = useState<string>(
    urlTermId || currentTerm?.id || "",
  );
  const effectiveTermId = termId || currentTerm?.id || null;

  const { data: report, isLoading: loadingReport } = useStudentReport(
    studentId,
    effectiveTermId,
  );
  const { data: breakdown, isLoading: loadingBreakdown } = useStudentBreakdown(
    studentId,
    effectiveTermId,
  );

  // Combine the flat results with the breakdown so each subject row owns
  // its categories. Falls back to a sparse list while breakdown is loading.
  const subjects = useMemo<SubjectBreakdown[]>(() => {
    if (breakdown) {
      return [...breakdown.subjects].sort((a, b) =>
        a.subject_name.localeCompare(b.subject_name),
      );
    }
    if (!report) return [];
    return report.results.map((r) => ({
      subject_id: r.subject_id,
      subject_name: "Loading…",
      raw_score: r.raw_score,
      ca_score: r.ca_score,
      exam_score: r.exam_score,
      grade: r.grade,
      remark: r.remark,
      position: r.position,
      categories: [],
    }));
  }, [breakdown, report]);

  if (loadingReport || !report) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Action bar — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/students/${studentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to student
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            id="term-picker"
            value={effectiveTermId ?? ""}
            onChange={(e) => {
              setTermId(e.target.value);
              router.replace(
                `/students/${studentId}/report?term_id=${e.target.value}`,
              );
            }}
            className="min-w-[10rem]"
          >
            {terms.length === 0 && <option value="">No terms</option>}
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_current ? " (current)" : ""}
              </option>
            ))}
          </Select>
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => setEditOpen(true)}
              disabled={!effectiveTermId}
            >
              <Pencil className="h-4 w-4" />
              Edit remarks & skills
            </Button>
          )}
          <Button onClick={() => window.print()} variant="secondary">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <ReportCardBody
        report={report}
        school={school}
        subjects={subjects}
        showBreakdownToggle
        verificationUrl={
          report.verification_token && typeof window !== "undefined"
            ? `${window.location.origin}/verify/${report.verification_token}`
            : null
        }
      />

      {loadingBreakdown && !breakdown && (
        <p className="mt-2 text-xs text-gray-400 print:hidden">
          Loading breakdown…
        </p>
      )}

      {canEdit && effectiveTermId && (
        <EditTermCardDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          studentId={studentId}
          termId={effectiveTermId}
          termName={report.term_name}
          existing={report.term_card}
          canEditHeadteacher={canEditHeadteacher}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-4 h-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
