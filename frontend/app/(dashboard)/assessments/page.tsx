"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, Settings, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useTerms,
  useClasses,
  useSubjects,
} from "@/lib/hooks/useAcademic";
import {
  useAssessments,
  useAssessmentCategories,
} from "@/lib/hooks/useAssessments";
import { formatDate, cn } from "@/lib/utils";
import type { Assessment, AssessmentCategory } from "@/lib/api";
import Button from "@/components/ui/Button";

const ACTOR_ROLES = new Set(["school_admin", "headteacher", "teacher"]);
const ADMIN_ROLES = new Set(["school_admin", "headteacher"]);

const STATUS_TABS = [
  { key: "",          label: "All"       },
  { key: "draft",     label: "Draft"     },
  { key: "published", label: "Published" },
];

const CATEGORY_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
];

function AssessmentIcon({ category }: { category: AssessmentCategory | null }) {
  const letter = category?.name?.[0]?.toUpperCase() ?? "A";
  const color = CATEGORY_COLORS[(category?.name?.charCodeAt(0) ?? 0) % CATEGORY_COLORS.length];
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}>
      {letter}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
        </td>
      ))}
    </tr>
  );
}

export default function AssessmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canCreate = !!user?.role && ACTOR_ROLES.has(user.role);
  const isAdmin   = !!user?.role && ADMIN_ROLES.has(user.role);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(currentYear?.id ?? null);
  const currentTerm = terms.find((t) => t.is_current);

  const { data: classes   = [] } = useClasses(true);
  const { data: subjects  = [] } = useSubjects();
  const { data: categories = [] } = useAssessmentCategories();

  const [termId,    setTermId]    = useState("");
  const [classId,   setClassId]   = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [statusTab, setStatusTab] = useState("");

  const effectiveTermId = termId || currentTerm?.id || "";

  const { data: assessments = [], isLoading: assessmentsLoading, isFetching } =
    useAssessments({
      class_id:   classId   || undefined,
      subject_id: subjectId || undefined,
      term_id:    effectiveTermId || undefined,
    });

  // Client-side published/draft filter
  const filtered = useMemo(() => {
    if (statusTab === "published") return assessments.filter((a) => a.is_published);
    if (statusTab === "draft")     return assessments.filter((a) => !a.is_published);
    return assessments;
  }, [assessments, statusTab]);

  const classMap    = useMemo(() => new Map(classes.map((c)    => [c.id, c])),    [classes]);
  const subjectMap  = useMemo(() => new Map(subjects.map((s)   => [s.id, s])),    [subjects]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const loading = yearsLoading || termsLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Assessments</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Track and manage assessments for your school
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:flex-wrap">
          {isAdmin && (
            <Link href="/assessments/setup">
              <Button variant="secondary" size="sm" className="h-10 sm:h-8">
                <Settings className="h-4 w-4" />
                Setup
              </Button>
            </Link>
          )}
          {canCreate && (
            <Link href="/assessments/new">
              <Button size="sm" className="h-10 flex-1 sm:h-8 sm:flex-none">
                <Plus className="h-4 w-4" />
                New assessment
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : !currentTerm ? (
        <NoTermGate hasYear={!!currentYear} />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <select
              value={effectiveTermId}
              onChange={(e) => setTermId(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 md:w-auto dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>

            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 md:w-auto dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 md:w-auto dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Status tabs */}
            <div className="flex w-full overflow-hidden rounded-lg border border-gray-200 bg-white md:w-auto dark:border-gray-700 dark:bg-gray-800">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusTab(key)}
                  aria-pressed={statusTab === key}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-xs font-medium transition-colors md:flex-none",
                    statusTab === key
                      ? "bg-[var(--brand)] text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table card */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                    {["Assessment", "Class", "Subject", "Date", "Max score", "Status"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="w-16 px-4 py-3" />
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-gray-100 dark:divide-gray-700"
                  aria-busy={isFetching}
                >
                  {assessmentsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div role="status" aria-live="polite" aria-atomic="true">
                          <ClipboardList className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                            {classId || subjectId || statusTab
                              ? "No assessments match these filters"
                              : "No assessments for this term yet"}
                          </p>
                          {canCreate && !classId && !subjectId && !statusTab && (
                            <Link
                              href="/assessments/new"
                              className="mt-2 inline-block text-sm font-medium text-[var(--brand)] hover:underline"
                            >
                              Create one →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => {
                      const category = categoryMap.get(a.category_id) ?? null;
                      const class_   = classMap.get(a.class_id) ?? null;
                      const subject  = subjectMap.get(a.subject_id) ?? null;
                      return (
                        <tr
                          key={a.id}
                          onClick={() => router.push(`/assessments/${a.id}`)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40",
                            isFetching && "opacity-60",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <AssessmentIcon category={category} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900 dark:text-white">
                                  {category?.name ?? "Assessment"}
                                  {a.date_administered
                                    ? ` – ${formatDate(a.date_administered)}`
                                    : ""}
                                </p>
                                {a.description && (
                                  <p className="truncate text-xs italic text-gray-400 dark:text-gray-500">
                                    {a.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {class_?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {subject?.name ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {a.date_administered ? formatDate(a.date_administered) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {Number(a.max_score)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge published={a.is_published} />
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-[var(--brand)]">
                            {a.is_published ? "View →" : "Enter scores →"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-gray-100 md:hidden dark:divide-gray-700">
              {assessmentsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex animate-pulse items-center gap-3 p-4"
                      aria-hidden="true"
                    >
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                      </div>
                    </div>
                  ))
                : filtered.length === 0
                ? (
                  <div className="py-16 text-center" role="status" aria-live="polite">
                    <ClipboardList className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      {classId || subjectId || statusTab
                        ? "No assessments match these filters"
                        : "No assessments for this term yet"}
                    </p>
                  </div>
                )
                : filtered.map((a) => {
                    const category = categoryMap.get(a.category_id) ?? null;
                    const class_   = classMap.get(a.class_id) ?? null;
                    const subject  = subjectMap.get(a.subject_id) ?? null;
                    return (
                      <Link
                        key={a.id}
                        href={`/assessments/${a.id}`}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <AssessmentIcon category={category} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900 dark:text-white">
                            {category?.name ?? "Assessment"}
                            {a.date_administered
                              ? ` – ${formatDate(a.date_administered)}`
                              : ""}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                            {class_?.name ?? "—"}
                            {subject ? ` · ${subject.name}` : ""}
                          </p>
                        </div>
                        <StatusBadge published={a.is_published} />
                      </Link>
                    );
                  })}
            </div>

            {/* Footer row count */}
            {!assessmentsLoading && filtered.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {filtered.length} assessment{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

function StatusBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Draft
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-gray-700">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoTermGate({ hasYear }: { hasYear: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            No current term is set
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {hasYear
              ? "Assessments are tied to a term. Set the current term in Academic → Calendar to start recording them."
              : "Assessments need an academic year and a current term. Set those up in Academic → Calendar first."}
          </p>
          <Link
            href="/academic"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
          >
            Open Academic → Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
