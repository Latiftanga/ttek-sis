"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useClassReports } from "@/lib/hooks/useAssessments";
import { useAcademicYears, useClasses, useSubjects, useTerms } from "@/lib/hooks/useAcademic";
import { useSchoolProfile } from "@/lib/hooks/useSchool";
import Button from "@/components/ui/Button";
import ReportCardBody from "@/components/students/ReportCardBody";

const ADMIN_ROLES = new Set(["school_admin", "headteacher", "superadmin"]);

export default function BulkPrintPage() {
  const { user } = useAuthStore();
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);
  const search = useSearchParams();
  const classId = search.get("class_id");
  const termId = search.get("term_id");

  const { data: school } = useSchoolProfile();
  const { data: years = [] } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [] } = useTerms(currentYear?.id ?? null);
  const { data: classes = [] } = useClasses(true);
  const { data: subjects = [] } = useSubjects();

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const className = classes.find((c) => c.id === classId)?.name ?? "—";
  const termName = terms.find((t) => t.id === termId)?.name ?? "—";

  const { data: reports = [], isLoading, error } = useClassReports(
    classId,
    termId,
  );

  // Skip rendering body if the URL is missing required params — we surface
  // a clear message instead of a confusing empty state.
  const missingParams = !classId;

  // Auto-open print dialog when reports are ready? No — the admin should
  // eyeball the list first (catches "wait, I should have computed first"
  // type mistakes). They press the Print button when ready.

  if (!isAdmin) {
    return (
      <PageShell>
        <BackLink />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Only headteachers and school admins can bulk-print report cards.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Action bar — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/assessments/results"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Term Results
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">{className}</span>
            {" · "}
            <span className="font-semibold">{termName}</span>
            {" · "}
            {isLoading
              ? "Loading…"
              : `${reports.length} student${reports.length === 1 ? "" : "s"}`}
          </p>
          <Button
            onClick={() => window.print()}
            disabled={isLoading || reports.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print all
          </Button>
        </div>
      </div>

      {missingParams ? (
        <EmptyState
          title="Pick a class first"
          body={
            <>
              This page bulk-prints report cards for one class and term. Go
              back to <Link href="/assessments/results" className="underline">
                Term Results
              </Link>, pick a class and term, then hit <em>Print all report
              cards</em>.
            </>
          }
        />
      ) : error ? (
        <EmptyState
          title="Could not load report cards"
          body={(error as Error).message ?? "Please try again."}
        />
      ) : isLoading ? (
        <PrintSkeleton />
      ) : reports.length === 0 ? (
        <EmptyState
          title="Nothing to print"
          body={
            <>
              No active students enrolled in this class for the selected
              term, or term results haven&apos;t been computed yet. Run{" "}
              <Link href="/assessments/results" className="underline">
                Compute
              </Link>{" "}
              first.
            </>
          }
        />
      ) : (
        <div className="space-y-6 print:space-y-0">
          {reports.map((report, idx) => (
            <div
              key={report.student_id}
              className={
                // Page break after every card except the last so the printer
                // starts each report on a fresh A4 page.
                idx < reports.length - 1
                  ? "print:break-after-page"
                  : undefined
              }
            >
              <ReportCardBody
                report={report}
                school={school}
                subjects={report.results
                  .map((r) => ({
                    subject_id: r.subject_id,
                    subject_name:
                      subjectNameById.get(r.subject_id) ?? "Unknown",
                    raw_score: r.raw_score,
                    ca_score: r.ca_score,
                    exam_score: r.exam_score,
                    grade: r.grade,
                    remark: r.remark,
                    position: r.position,
                    categories: [],
                  }))
                  .sort((a, b) =>
                    a.subject_name.localeCompare(b.subject_name),
                  )}
                showBreakdownToggle={false}
                verificationUrl={
                  report.verification_token && typeof window !== "undefined"
                    ? `${window.location.origin}/verify/${report.verification_token}`
                    : null
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/assessments/results"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Term Results
    </Link>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 pb-12">{children}</div>;
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
      <p className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{body}</p>
    </div>
  );
}

function PrintSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="mt-4 h-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
