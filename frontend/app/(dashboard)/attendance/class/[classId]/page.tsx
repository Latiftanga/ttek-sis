"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  StickyNote,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useTerms,
  useClasses,
  useClassStudents,
  type ClassStudent,
} from "@/lib/hooks/useAcademic";
import {
  useClassToday,
  useSessionRecords,
  useCreateSession,
  useSubmitSession,
} from "@/lib/hooks/useAttendance";
import { getApiError, getInitials, cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/api";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

const CYCLE: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent:  "Absent",
  late:    "Late",
  excused: "Excused",
};

const STATUS_PILL_CLASSES: Record<AttendanceStatus, string> = {
  present:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/30 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30",
  absent:
    "bg-red-50 text-red-700 ring-red-600/30 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/30",
  late:
    "bg-amber-50 text-amber-700 ring-amber-600/30 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/30",
  excused:
    "bg-blue-50 text-blue-700 ring-blue-600/30 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-500/30",
};

interface Mark {
  status: AttendanceStatus;
  reason: string;
}

export default function ClassAttendancePage() {
  const router = useRouter();
  const params = useParams<{ classId: string }>();
  const classId = params.classId;
  const { user } = useAuthStore();

  // Academic context
  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(
    currentYear?.id ?? null,
  );
  const currentTerm = terms.find((t) => t.is_current);

  // Class and roster
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const class_ = classes.find((c) => c.id === classId);
  const { data: students = [], isLoading: studentsLoading } = useClassStudents(
    classId,
    currentYear?.id,
  );

  // Today's session for this class (defines status / records)
  const { data: today, isLoading: todayLoading } = useClassToday(classId);

  // Existing records (for resume)
  const { data: existingRecords = [] } = useSessionRecords(
    today?.session_id ?? null,
  );

  const createSession = useCreateSession();
  const submitSession = useSubmitSession();

  // Local marking state
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [showReasonFor, setShowReasonFor] = useState<Set<string>>(new Set());
  const initRef = useRef(false);

  // Initialize the marking map once we have students + records
  useEffect(() => {
    if (initRef.current) return;
    if (students.length === 0) return;
    initRef.current = true;
    const init: Record<string, Mark> = {};
    const reasonShow = new Set<string>();
    for (const s of students) {
      const existing = existingRecords.find((r) => r.student_id === s.student_id);
      const status = (existing?.status as AttendanceStatus) ?? "present";
      const reason = existing?.reason ?? "";
      init[s.student_id] = { status, reason };
      if (reason) reasonShow.add(s.student_id);
    }
    setMarks(init);
    setShowReasonFor(reasonShow);
  }, [students, existingRecords]);

  // Auto-create today's session if none exists and we're not in a submitted state.
  // Uses a deterministic client_id so repeated mounts return the same session.
  const createOnceRef = useRef(false);
  useEffect(() => {
    if (createOnceRef.current) return;
    if (!currentTerm || !classId) return;
    if (todayLoading) return;
    if (!today) return;
    if (today.session_status === "submitted") return;
    if (today.session_id) return;

    createOnceRef.current = true;
    const todayDate = new Date().toISOString().slice(0, 10);
    createSession.mutate(
      {
        class_id: classId,
        term_id: currentTerm.id,
        session_type: "daily",
        date: todayDate,
        client_opened_at: new Date().toISOString(),
        client_id: `daily-${classId}-${todayDate}`,
      },
      {
        onError: (err) => {
          toast.error(getApiError(err, "Could not open today's session."));
          createOnceRef.current = false;
        },
      },
    );
  }, [currentTerm, classId, todayLoading, today, createSession]);

  // Live counts (derived from local marks)
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const m of Object.values(marks)) c[m.status] += 1;
    return c;
  }, [marks]);

  const sessionId = today?.session_id ?? createSession.data?.id ?? null;

  // ── Loading & gates ────────────────────────────────────────────────────

  const loading =
    yearsLoading ||
    termsLoading ||
    classesLoading ||
    studentsLoading ||
    todayLoading;

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!currentTerm) {
    return (
      <PageShell>
        <BackLink />
        <NoTermGate />
      </PageShell>
    );
  }

  if (!class_) {
    return (
      <PageShell>
        <BackLink />
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Class not found.
          </p>
        </div>
      </PageShell>
    );
  }

  if (today?.session_status === "submitted") {
    return (
      <PageShell>
        <BackLink />
        <SubmittedView
          classId={classId}
          className_={class_.name}
          today={today}
        />
      </PageShell>
    );
  }

  if (students.length === 0) {
    return (
      <PageShell>
        <BackLink />
        <ClassHeader name={class_.name} teacher={class_.class_teacher_name} />
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No students enrolled in this class for the current year.
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Mark interactions ──────────────────────────────────────────────────

  function cycleStatus(studentId: string) {
    setMarks((prev) => {
      const current = prev[studentId]?.status ?? "present";
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      return {
        ...prev,
        [studentId]: { ...prev[studentId], status: next },
      };
    });
  }

  function setReason(studentId: string, value: string) {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], reason: value },
    }));
  }

  function toggleReasonInput(studentId: string) {
    setShowReasonFor((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!sessionId) {
      toast.error("Session is still opening. Please wait a moment.");
      return;
    }
    const records = students.map((s) => {
      const m = marks[s.student_id];
      return {
        student_id: s.student_id,
        status: m?.status ?? "present",
        reason: m?.reason?.trim() || null,
      };
    });
    try {
      await submitSession.mutateAsync({
        sessionId,
        body: {
          client_submitted_at: new Date().toISOString(),
          records,
        },
      });
      toast.success("Attendance submitted");
      router.push("/attendance");
    } catch (err) {
      toast.error(getApiError(err, "Could not submit attendance. Please try again."));
    }
  }

  const sessionOpening = createSession.isPending && !sessionId;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <BackLink />
      <ClassHeader name={class_.name} teacher={class_.class_teacher_name} />

      {sessionOpening && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Opening today's session…
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {students.map((s) => (
            <RosterRow
              key={s.student_id}
              student={s}
              mark={marks[s.student_id] ?? { status: "present", reason: "" }}
              showReason={showReasonFor.has(s.student_id)}
              onCycle={() => cycleStatus(s.student_id)}
              onToggleReason={() => toggleReasonInput(s.student_id)}
              onReasonChange={(v) => setReason(s.student_id, v)}
            />
          ))}
        </ul>
      </div>

      <SubmitBar
        counts={counts}
        total={students.length}
        onSubmit={handleSubmit}
        submitting={submitSession.isPending}
        disabled={sessionOpening || !sessionId}
      />
    </PageShell>
  );
}

// ── Layout pieces ──────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  // pb-28 leaves room for the sticky submit bar
  return <div className="space-y-4 pb-28">{children}</div>;
}

function BackLink() {
  return (
    <Link
      href="/attendance"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Attendance
    </Link>
  );
}

function ClassHeader({
  name,
  teacher,
}: {
  name: string;
  teacher: string | null;
}) {
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        {name}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {todayLabel}
        {teacher ? ` · Class teacher: ${teacher}` : ""}
      </p>
    </div>
  );
}

function NoTermGate() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            No current term is set
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            A head teacher or admin must set the current term in{" "}
            <span className="font-medium">Academic → Calendar</span> before
            attendance can be taken.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Roster row ─────────────────────────────────────────────────────────────

function RosterRow({
  student,
  mark,
  showReason,
  onCycle,
  onToggleReason,
  onReasonChange,
}: {
  student: ClassStudent;
  mark: Mark;
  showReason: boolean;
  onCycle: () => void;
  onToggleReason: () => void;
  onReasonChange: (v: string) => void;
}) {
  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {getInitials(student.first_name, student.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {fullName}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {student.student_number}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleReason}
          aria-label={showReason ? "Hide reason" : "Add reason"}
          aria-pressed={showReason}
          className={cn(
            "shrink-0 rounded-full p-1.5 transition-colors",
            showReason || mark.reason
              ? "bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand)]"
              : "text-gray-300 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-400",
          )}
        >
          <StickyNote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onCycle}
          aria-label={`${STATUS_LABEL[mark.status]} — tap to change`}
          className={cn(
            "min-w-[88px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
            STATUS_PILL_CLASSES[mark.status],
          )}
        >
          {STATUS_LABEL[mark.status]}
        </button>
      </div>

      {showReason && (
        <div className="mt-2 pl-12">
          <input
            type="text"
            value={mark.reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. Sick, family emergency, doctor's appointment"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      )}
    </li>
  );
}

// ── Submit bar ─────────────────────────────────────────────────────────────

function SubmitBar({
  counts,
  total,
  onSubmit,
  submitting,
  disabled,
}: {
  counts: { present: number; absent: number; late: number; excused: number };
  total: number;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 border-t border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <CountChip label="Present" value={counts.present} tone="green" />
          <CountChip label="Absent" value={counts.absent} tone="red" />
          <CountChip label="Late" value={counts.late} tone="amber" />
          <CountChip label="Excused" value={counts.excused} tone="blue" />
          <span className="text-gray-400 dark:text-gray-500">of {total}</span>
        </div>
        <Button
          onClick={onSubmit}
          loading={submitting}
          disabled={disabled}
          size="lg"
        >
          Submit attendance
        </Button>
      </div>
    </div>
  );
}

function CountChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "amber" | "blue";
}) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    red:   "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    blue:  "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
        toneClass,
      )}
    >
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        {label}
      </span>
    </span>
  );
}

// ── Submitted view ─────────────────────────────────────────────────────────

function SubmittedView({
  classId,
  className_,
  today,
}: {
  classId: string;
  className_: string;
  today: {
    session_id: string | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total_students: number;
  };
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {className_}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-200">
              Today's attendance has been submitted
            </h2>
            {today.session_id && (
              <Link
                href={`/attendance/class/${classId}/sessions/${today.session_id}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
              >
                View records &amp; edit →
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Summary
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Present" value={today.present} tone="green" />
          <SummaryStat label="Absent" value={today.absent} tone="red" />
          <SummaryStat label="Late" value={today.late} tone="amber" />
          <SummaryStat label="Excused" value={today.excused} tone="blue" />
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {today.total_students} students total
        </p>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "amber" | "blue";
}) {
  const toneClass = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
  }[tone];
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-8 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded bg-gray-50 dark:bg-gray-800"
          />
        ))}
      </div>
    </div>
  );
}
