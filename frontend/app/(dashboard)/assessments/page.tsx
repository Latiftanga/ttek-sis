"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  AlertCircle,
  CalendarDays,
  Plus,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useTerms,
  useClasses,
  useSubjects,
  type Class as ClassType,
  type Subject,
} from "@/lib/hooks/useAcademic";
import {
  useAssessments,
  useAssessmentCategories,
} from "@/lib/hooks/useAssessments";
import { formatDate, cn } from "@/lib/utils";
import type { Assessment, AssessmentCategory } from "@/lib/api";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";

const ACTOR_ROLES = new Set([
  "school_admin",
  "headteacher",
  "teacher",
]);

const ADMIN_ROLES = new Set(["school_admin", "headteacher"]);

export default function AssessmentsPage() {
  const { user } = useAuthStore();
  const canCreate = !!user?.role && ACTOR_ROLES.has(user.role);
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(
    currentYear?.id ?? null,
  );
  const currentTerm = terms.find((t) => t.is_current);

  const { data: classes = [], isLoading: classesLoading } = useClasses(true);
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: categories = [] } = useAssessmentCategories();

  // Filters — default term = current, class/subject = all
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [termId, setTermId] = useState<string>("");

  // When current term becomes available and no term selected yet, adopt it.
  const effectiveTermId = termId || currentTerm?.id || "";

  const { data: assessments = [], isLoading: assessmentsLoading } =
    useAssessments({
      class_id: classId || undefined,
      subject_id: subjectId || undefined,
      term_id: effectiveTermId || undefined,
    });

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );
  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const loading =
    yearsLoading ||
    termsLoading ||
    classesLoading ||
    subjectsLoading;

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Assessments
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {todayLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Link href="/assessments/setup">
              <Button size="sm" variant="secondary">
                <Settings className="h-4 w-4" />
                Setup
              </Button>
            </Link>
          )}
          {canCreate && (
            <Link href="/assessments/new">
              <Button size="sm">
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
          <FilterRow
            terms={terms}
            classes={classes}
            subjects={subjects}
            termId={effectiveTermId}
            classId={classId}
            subjectId={subjectId}
            onTermChange={setTermId}
            onClassChange={setClassId}
            onSubjectChange={setSubjectId}
          />

          {assessmentsLoading ? (
            <ListSkeleton />
          ) : assessments.length === 0 ? (
            <EmptyState filtered={!!classId || !!subjectId} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assessments.map((a) => (
                <AssessmentCard
                  key={a.id}
                  assessment={a}
                  class_={classMap.get(a.class_id) ?? null}
                  subject={subjectMap.get(a.subject_id) ?? null}
                  category={categoryMap.get(a.category_id) ?? null}
                />
              ))}
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ── Filter row ────────────────────────────────────────────────────────────

function FilterRow({
  terms,
  classes,
  subjects,
  termId,
  classId,
  subjectId,
  onTermChange,
  onClassChange,
  onSubjectChange,
}: {
  terms: { id: string; name: string; is_current: boolean }[];
  classes: ClassType[];
  subjects: Subject[];
  termId: string;
  classId: string;
  subjectId: string;
  onTermChange: (v: string) => void;
  onClassChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select
        id="f_term"
        label="Term"
        value={termId}
        onChange={(e) => onTermChange(e.target.value)}
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.is_current ? " (current)" : ""}
          </option>
        ))}
      </Select>
      <Select
        id="f_class"
        label="Class"
        value={classId}
        onChange={(e) => onClassChange(e.target.value)}
      >
        <option value="">All classes</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        id="f_subject"
        label="Subject"
        value={subjectId}
        onChange={(e) => onSubjectChange(e.target.value)}
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function AssessmentCard({
  assessment,
  class_,
  subject,
  category,
}: {
  assessment: Assessment;
  class_: ClassType | null;
  subject: Subject | null;
  category: AssessmentCategory | null;
}) {
  return (
    <Link
      href={`/assessments/${assessment.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-white">
            {assessment.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {class_?.name ?? "—"}
            {subject ? ` · ${subject.name}` : ""}
          </p>
        </div>
        <PublishedBadge published={assessment.is_published} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {category && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {category.name}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {assessment.date_administered
            ? formatDate(assessment.date_administered)
            : "Date not set"}
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          out of {Number(assessment.max_score)}
        </span>
      </div>

      <div className="mt-3 text-right text-xs font-medium text-[var(--brand)] group-hover:underline">
        Enter scores →
      </div>
    </Link>
  );
}

function PublishedBadge({ published }: { published: boolean }) {
  if (published) return <Badge variant="green">Published</Badge>;
  return <Badge variant="gray">Draft</Badge>;
}

// ── Empty & loading & term gate ───────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {filtered
          ? "No assessments match these filters."
          : "No assessments for this term yet."}
      </p>
      <Link
        href="/assessments/new"
        className="mt-2 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        Create one →
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>
      <ListSkeleton />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
        />
      ))}
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
