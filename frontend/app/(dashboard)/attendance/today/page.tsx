"use client";
import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  School as SchoolIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useClasses } from "@/lib/hooks/useAcademic";
import {
  useSessions,
  useSchoolToday,
  useAlerts,
} from "@/lib/hooks/useAttendance";
import { formatDate, cn } from "@/lib/utils";
import type { AttendanceSession, FlaggedSessionBrief } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const ADMIN_ROLES = new Set(["school_admin", "headteacher"]);

const FLAG_LABEL: Record<string, string> = {
  outside_time_window: "Marked outside class hours",
  outside_school_hours: "Marked outside school hours",
  large_sync_gap: "Synced more than 12 hours after marking",
  submitted_too_fast: "Submitted very quickly",
  future_timestamp: "Device clock was in the future",
};

export default function SchoolTodayPage() {
  const { user } = useAuthStore();
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);

  if (!isAdmin) {
    return <AccessDenied />;
  }
  return <SchoolTodayView />;
}

function SchoolTodayView() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: classes = [], isLoading: classesLoading } = useClasses(true);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions({
    date: todayIso,
  });
  const { data: stats } = useSchoolToday();
  const { data: alerts } = useAlerts();

  // Group classes by today's status (single sessions call, in-memory join).
  const groups = useMemo(() => {
    const byClass = new Map<string, AttendanceSession>();
    for (const s of sessions) {
      // Prefer non-cancelled and most recent (sessions already sorted by date desc).
      if (s.status === "cancelled") continue;
      if (!byClass.has(s.class_id)) byClass.set(s.class_id, s);
    }
    const notStarted = [];
    const open = [];
    const submitted = [];
    for (const c of classes) {
      const sess = byClass.get(c.id) ?? null;
      const row = { class_: c, session: sess };
      if (!sess) notStarted.push(row);
      else if (sess.status === "submitted") submitted.push(row);
      else open.push(row);
    }
    return { notStarted, open, submitted };
  }, [classes, sessions]);

  const loading = classesLoading || sessionsLoading;
  const flagged = alerts?.flagged_sessions ?? [];

  return (
    <div className="space-y-5">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Attendance
      </Link>

      <header className="flex items-center gap-3">
        <SchoolIcon className="h-5 w-5 text-gray-400" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            School today
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* Top stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigStat label="Submitted" value={stats.sessions_submitted} tone="green" />
          <BigStat label="In progress" value={stats.sessions_open} tone="blue" />
          <BigStat label="Not started" value={stats.sessions_not_started} tone="red" />
          <BigStat
            label="Flagged"
            value={stats.flagged_sessions}
            tone={stats.flagged_sessions > 0 ? "amber" : "gray"}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      )}

      {/* Flagged sessions */}
      {flagged.length > 0 && <FlaggedPanel flagged={flagged} classes={classes} />}

      {/* Groups */}
      {loading ? (
        <ClassListSkeleton />
      ) : (
        <>
          <ClassGroup
            title="Not started"
            tone="red"
            icon={<Circle className="h-3.5 w-3.5" />}
            rows={groups.notStarted}
            emptyText="Every class has at least started attendance."
          />
          <ClassGroup
            title="In progress"
            tone="blue"
            icon={<Clock className="h-3.5 w-3.5" />}
            rows={groups.open}
            emptyText="No classes in progress right now."
          />
          <ClassGroup
            title="Submitted"
            tone="green"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            rows={groups.submitted}
            emptyText="Nothing submitted yet today."
          />
        </>
      )}
    </div>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────

function BigStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "red" | "amber" | "gray";
}) {
  const toneClass = {
    green: "text-emerald-600 dark:text-emerald-400",
    blue:  "text-blue-600 dark:text-blue-400",
    red:   "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    gray:  "text-gray-600 dark:text-gray-300",
  }[tone];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className={cn("text-3xl font-semibold", toneClass)}>{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}

// ── Flagged sessions panel ────────────────────────────────────────────────

function FlaggedPanel({
  flagged,
  classes,
}: {
  flagged: FlaggedSessionBrief[];
  classes: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <ShieldAlert className="h-4 w-4" />
        <h2 className="text-sm font-semibold">
          Flagged sessions ({flagged.length})
        </h2>
      </div>
      <ul className="space-y-2">
        {flagged.map((f) => {
          const cls = classes.find((c) => c.id === f.class_id);
          const reason =
            (f.flag_reason && FLAG_LABEL[f.flag_reason]) ||
            f.flag_reason ||
            "Flagged for review";
          return (
            <li
              key={f.session_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-gray-900"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {cls?.name ?? "Unknown class"}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {reason}
                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                    · {formatDate(f.date)}
                  </span>
                </p>
              </div>
              <Link
                href={`/attendance/class/${f.class_id}/sessions/${f.session_id}`}
                className="shrink-0 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Open →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Class group ───────────────────────────────────────────────────────────

function ClassGroup({
  title,
  tone,
  icon,
  rows,
  emptyText,
}: {
  title: string;
  tone: "red" | "blue" | "green";
  icon: React.ReactNode;
  rows: { class_: { id: string; name: string; class_teacher_name: string | null }; session: AttendanceSession | null }[];
  emptyText: string;
}) {
  const badgeVariant = ({ red: "red", blue: "blue", green: "green" } as const)[tone];
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {title}
        </h2>
        <Badge variant={badgeVariant}>{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          {emptyText}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {rows.map(({ class_, session }) => (
            <li key={class_.id}>
              <Link
                href={
                  session
                    ? `/attendance/class/${class_.id}/sessions/${session.id}`
                    : `/attendance/class/${class_.id}`
                }
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {class_.name}
                  </p>
                  <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {class_.class_teacher_name ?? "No class teacher"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--brand)]">
                  {session ? "View →" : "Chase →"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Loading & access denied ───────────────────────────────────────────────

function ClassListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
        />
      ))}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="space-y-4">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Attendance
      </Link>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              School-wide attendance is for admins only
            </h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Ask a head teacher or school admin if you need this view. Teachers
              can take attendance for their own class from the Attendance home
              page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
