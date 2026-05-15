"use client";
import Link from "next/link";
import {
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Circle,
  School as SchoolIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useTerms,
  useClasses,
  type Class as ClassType,
} from "@/lib/hooks/useAcademic";
import { useClassToday, useSchoolToday } from "@/lib/hooks/useAttendance";
import Badge from "@/components/ui/Badge";

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin =
    user?.role === "school_admin" || user?.role === "headteacher";

  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(
    currentYear?.id ?? null,
  );
  const currentTerm = terms.find((t) => t.is_current);

  const { data: classes = [], isLoading: classesLoading } = useClasses(true);
  const { data: schoolToday } = useSchoolToday();

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const loading = yearsLoading || termsLoading || classesLoading;

  return (
    <div className="space-y-6">
      <PageHeader todayLabel={todayLabel} />

      {loading ? (
        <LoadingPlaceholder />
      ) : !currentTerm ? (
        <NoTermGate hasYear={!!currentYear} isAdmin={isAdmin} />
      ) : (
        <>
          {isAdmin && schoolToday && (
            <SchoolTodayBanner data={schoolToday} totalClasses={classes.length} />
          )}

          {classes.length === 0 ? (
            <EmptyClasses isAdmin={isAdmin} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((c) => (
                <ClassTodayCard key={c.id} class_={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────

function PageHeader({ todayLabel }: { todayLabel: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Attendance
        </h1>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {todayLabel}
      </p>
    </div>
  );
}

// ── Term gate ─────────────────────────────────────────────────────────────

function NoTermGate({
  hasYear,
  isAdmin,
}: {
  hasYear: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-2">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            No current term is set
          </h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {hasYear
              ? "Attendance is tied to a term. Set the current term before staff can mark attendance."
              : "Attendance is tied to a term, and a term belongs to an academic year. Set up the current year and term before staff can mark attendance."}
          </p>
          {isAdmin && (
            <Link
              href="/academic"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              Open Academic → Calendar
            </Link>
          )}
          {!isAdmin && (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              A head teacher or school admin can set it from{" "}
              <span className="font-medium">Academic → Calendar</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── School-wide banner (admin only) ───────────────────────────────────────

function SchoolTodayBanner({
  data,
  totalClasses,
}: {
  data: {
    sessions_submitted: number;
    sessions_open: number;
    sessions_not_started: number;
    flagged_sessions: number;
  };
  totalClasses: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SchoolIcon className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            School today
          </h2>
        </div>
        <Link
          href="/attendance/today"
          className="text-xs font-medium text-[var(--brand)] hover:underline"
        >
          View school today →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Submitted" value={data.sessions_submitted} tone="green" />
        <Stat label="In progress" value={data.sessions_open} tone="blue" />
        <Stat
          label="Not started"
          value={data.sessions_not_started}
          tone="gray"
        />
        <Stat
          label="Flagged"
          value={data.flagged_sessions}
          tone={data.flagged_sessions > 0 ? "red" : "gray"}
        />
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {totalClasses} active classes total
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "gray" | "red";
}) {
  const toneClass = {
    green: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    gray: "text-gray-600 dark:text-gray-300",
    red: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ── Class card ────────────────────────────────────────────────────────────

function ClassTodayCard({ class_ }: { class_: ClassType }) {
  const { data, isLoading } = useClassToday(class_.id);

  const status = data?.session_status ?? null;
  const counts = data;

  const cta =
    status === "submitted"
      ? "View"
      : status === "open"
        ? "Continue"
        : "Take attendance";

  return (
    <Link
      href={`/attendance/class/${class_.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-white">
            {class_.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
            {class_.class_teacher_name ?? "No class teacher"}
          </p>
        </div>
        <StatusBadge status={status} loading={isLoading} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1 text-center">
        <Tally label="Present" value={counts?.present} tone="green" />
        <Tally label="Absent" value={counts?.absent} tone="red" />
        <Tally label="Late" value={counts?.late} tone="amber" />
        <Tally label="Excused" value={counts?.excused} tone="gray" />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-400 dark:text-gray-500">
          {counts && counts.total_students > 0
            ? `${counts.total_students - counts.not_marked} of ${counts.total_students} marked`
            : " "}
        </span>
        <span className="font-medium text-[var(--brand)] group-hover:underline">
          {cta} →
        </span>
      </div>
    </Link>
  );
}

function StatusBadge({
  status,
  loading,
}: {
  status: "open" | "submitted" | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="h-5 w-20 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
    );
  }
  if (status === "submitted") {
    return (
      <Badge variant="green" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Submitted
      </Badge>
    );
  }
  if (status === "open") {
    return (
      <Badge variant="blue" className="gap-1">
        <Clock className="h-3 w-3" />
        In progress
      </Badge>
    );
  }
  return (
    <Badge variant="gray" className="gap-1">
      <Circle className="h-3 w-3" />
      Not started
    </Badge>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: "green" | "red" | "amber" | "gray";
}) {
  const toneClass = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    gray: "text-gray-500 dark:text-gray-400",
  }[tone];
  return (
    <div>
      <p className={`text-base font-semibold ${toneClass}`}>{value ?? "—"}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
    </div>
  );
}

// ── Empty / loading / phase-2 note ────────────────────────────────────────

function EmptyClasses({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No active classes yet.
      </p>
      {isAdmin && (
        <Link
          href="/academic"
          className="mt-2 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          Set up classes in Academic
        </Link>
      )}
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
        />
      ))}
    </div>
  );
}

