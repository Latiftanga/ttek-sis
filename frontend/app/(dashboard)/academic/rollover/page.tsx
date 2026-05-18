"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  AlertCircle,
  ArrowRightCircle,
  Check,
  RotateCcw,
  GraduationCap,
  LogOut,
  UserMinus,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useAcademicYears, useClasses } from "@/lib/hooks/useAcademic";
import {
  useRolloverPreview,
  useCommitRollover,
  type Outcome,
  type RolloverDecision,
  type RolloverPreviewRow,
} from "@/lib/hooks/useRollover";
import { getApiError, getInitials, cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import ConfirmSheet from "@/components/ui/ConfirmSheet";

const ADMIN_ROLES = new Set(["school_admin", "headteacher", "superadmin"]);

type DecisionState = {
  outcome: Outcome | null;
  target_class_id: string | null;
  reason: string;
};

const blank = (): DecisionState => ({
  outcome: null,
  target_class_id: null,
  reason: "",
});

export default function RolloverPage() {
  const { user } = useAuthStore();
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);

  const { data: years = [] } = useAcademicYears();
  const { data: classes = [] } = useClasses(true);

  const [sourceYearId, setSourceYearId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pre-select sensible defaults once data is loaded.
  useEffect(() => {
    if (!sourceYearId && years.length) {
      const current = years.find((y) => y.is_current);
      setSourceYearId(current?.id ?? years[0].id);
    }
  }, [years, sourceYearId]);

  const { data: preview, isLoading: previewLoading, error: previewError } =
    useRolloverPreview({
      sourceClassId: sourceClassId || null,
      sourceYearId: sourceYearId || null,
      targetYearId: targetYearId || null,
    });

  const commit = useCommitRollover();

  // Per-row decision state, keyed by enrollment_id.
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});

  // When the preview loads (or changes), seed each row with a sensible
  // default: Graduate for terminal classes, Promote (no target) otherwise.
  // Headteacher overrides per-row as needed.
  useEffect(() => {
    if (!preview) return;
    const init: Record<string, DecisionState> = {};
    const defaultOutcome: Outcome = preview.is_terminal_class
      ? "graduated"
      : "promoted";
    for (const row of preview.rows) {
      init[row.enrollment_id] = {
        outcome: defaultOutcome,
        target_class_id: null,
        reason: "",
      };
    }
    setDecisions(init);
  }, [preview]);

  function setDecision(
    enrollmentId: string,
    patch: Partial<DecisionState>,
  ) {
    setDecisions((prev) => ({
      ...prev,
      [enrollmentId]: { ...(prev[enrollmentId] ?? blank()), ...patch },
    }));
  }

  // Summary counts for the confirm modal.
  const summary = useMemo(() => {
    const s = { promoted: 0, repeated: 0, graduated: 0, transferred: 0, withdrawn: 0 };
    for (const d of Object.values(decisions)) {
      if (d.outcome) s[d.outcome] += 1;
    }
    return s;
  }, [decisions]);

  // Which rows are still missing a target class (promote/repeat must point
  // at a class). Used to disable Continue and surface the count.
  const missingTargets = useMemo(() => {
    if (!preview) return 0;
    return preview.rows.reduce((n, row) => {
      const d = decisions[row.enrollment_id];
      if (!d || !d.outcome) return n + 1;
      if ((d.outcome === "promoted" || d.outcome === "repeated") &&
          !d.target_class_id) {
        return n + 1;
      }
      return n;
    }, 0);
  }, [preview, decisions]);

  async function handleCommit() {
    if (!preview) return;
    const payload: RolloverDecision[] = preview.rows.map((row) => {
      const d = decisions[row.enrollment_id]!;
      return {
        enrollment_id: row.enrollment_id,
        student_id: row.student_id,
        outcome: d.outcome!,
        target_class_id:
          d.outcome === "promoted" || d.outcome === "repeated"
            ? d.target_class_id
            : null,
        reason: d.reason.trim() || null,
      };
    });

    try {
      const result = await commit.mutateAsync({
        source_class_id: preview.source_class_id,
        source_academic_year_id: preview.source_academic_year_id,
        target_academic_year_id: preview.target_academic_year_id,
        decisions: payload,
      });
      toast.success(result.message);
      setConfirmOpen(false);
      // Clear local state so the headteacher sees a fresh table for the
      // next class.
      setDecisions({});
      setSourceClassId("");
    } catch (err) {
      toast.error(getApiError(err, "Could not commit roll-over"));
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 pb-12">
        <BackLink />
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <BackLink />

      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          End-of-year roll-over
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Move every student in a class to the new academic year. You choose
          who promotes, who repeats, who graduates, and who leaves.
        </p>
      </div>

      {/* Year + class pickers */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          1. Choose academic years and class
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="From year">
            <select
              value={sourceYearId}
              onChange={(e) => {
                setSourceYearId(e.target.value);
                setSourceClassId("");
              }}
              className="select-base"
            >
              <option value="">— Select —</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To year">
            <select
              value={targetYearId}
              onChange={(e) => setTargetYearId(e.target.value)}
              className="select-base"
            >
              <option value="">— Select —</option>
              {years
                .filter((y) => y.id !== sourceYearId)
                .map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}{y.is_current ? " (current)" : ""}
                  </option>
                ))}
            </select>
            {years.length < 2 && (
              <p className="mt-1 text-xs text-amber-600">
                You need at least two academic years.{" "}
                <Link href="/academic" className="underline">
                  Create the new year first
                </Link>.
              </p>
            )}
          </Field>
          <Field label="Class to roll over">
            <select
              value={sourceClassId}
              onChange={(e) => setSourceClassId(e.target.value)}
              disabled={!sourceYearId || !targetYearId}
              className="select-base"
            >
              <option value="">— Select —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Decision table */}
      {sourceClassId && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              2. Decide each student
            </h2>
            {preview && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {preview.rows.length} student{preview.rows.length === 1 ? "" : "s"}{" "}
                · <strong>{preview.source_class_name}</strong>{" "}
                · <em>{preview.source_academic_year_name}</em>{" "}
                → <em>{preview.target_academic_year_name}</em>
                {preview.is_terminal_class && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                    Terminal class
                  </span>
                )}
              </p>
            )}
          </div>

          {previewError ? (
            <div className="p-6 text-sm text-rose-600">
              {(previewError as Error).message}
            </div>
          ) : previewLoading || !preview ? (
            <TableSkeleton />
          ) : preview.rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No active students in this class for the selected year.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {preview.rows.map((row) => {
                const d = decisions[row.enrollment_id] ?? blank();
                return (
                  <DecisionRow
                    key={row.enrollment_id}
                    row={row}
                    decision={d}
                    targetClasses={preview.target_classes}
                    sourceClassId={preview.source_class_id}
                    onChange={(patch) => setDecision(row.enrollment_id, patch)}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Commit bar */}
      {preview && preview.rows.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:-mx-6 sm:px-6 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>{summary.promoted}</strong> promote ·{" "}
              <strong>{summary.repeated}</strong> repeat ·{" "}
              <strong>{summary.graduated}</strong> graduate ·{" "}
              <strong>{summary.transferred + summary.withdrawn}</strong> leave
              {missingTargets > 0 && (
                <span className="ml-2 text-amber-600">
                  · {missingTargets} need a target class
                </span>
              )}
            </p>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={missingTargets > 0 || commit.isPending}
            >
              Review & commit
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Commit roll-over?"
        description={
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              For <strong>{preview?.source_class_name}</strong>{" "}
              ({preview?.source_academic_year_name} →{" "}
              {preview?.target_academic_year_name}):
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
              <li>{summary.promoted} promoted</li>
              <li>{summary.repeated} repeated</li>
              <li>{summary.graduated} graduated</li>
              <li>{summary.transferred} transferred</li>
              <li>{summary.withdrawn} withdrawn</li>
            </ul>
            <p className="mt-3 text-xs text-amber-700">
              This closes every enrolment in the source year and opens new
              ones for the target year. Mistakes can be corrected via the
              enrolment editor afterwards.
            </p>
          </>
        }
        confirmLabel="Commit roll-over"
        loading={commit.isPending}
        onConfirm={handleCommit}
      />

      {/* Local style for select to match the rest of the app */}
      <style jsx>{`
        .select-base {
          height: 2.5rem;
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(209 213 219);
          background: white;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
          font-size: 0.875rem;
        }
        .select-base:focus {
          outline: none;
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 1px rgb(59 130 246);
        }
      `}</style>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

const OUTCOMES: { key: Outcome; label: string; icon: React.ReactNode; tint: string }[] = [
  { key: "promoted", label: "Promote", icon: <ArrowRightCircle className="h-4 w-4" />, tint: "emerald" },
  { key: "repeated", label: "Repeat",   icon: <RotateCcw className="h-4 w-4" />,        tint: "amber" },
  { key: "graduated",label: "Graduate", icon: <GraduationCap className="h-4 w-4" />,     tint: "blue" },
  { key: "transferred",label:"Transfer",icon: <LogOut className="h-4 w-4" />,            tint: "gray" },
  { key: "withdrawn",label: "Withdraw", icon: <UserMinus className="h-4 w-4" />,         tint: "gray" },
];

function DecisionRow({
  row,
  decision,
  targetClasses,
  sourceClassId,
  onChange,
}: {
  row: RolloverPreviewRow;
  decision: DecisionState;
  targetClasses: { id: string; name: string }[];
  sourceClassId: string;
  onChange: (patch: Partial<DecisionState>) => void;
}) {
  const fullName = [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ");
  const aggregate = row.year_aggregate != null ? Number(row.year_aggregate) : null;
  const attendance = row.attendance_pct != null ? Number(row.attendance_pct) : null;
  const concerns = (aggregate !== null && aggregate < 30) ||
                   (attendance !== null && attendance < 50);

  // If user picks Repeat, default the target class to the source class
  // (most repeats stay in the same class).
  function handleOutcome(o: Outcome) {
    onChange({
      outcome: o,
      target_class_id:
        o === "repeated"
          ? sourceClassId
          : o === "promoted"
          ? decision.target_class_id
          : null,
    });
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Photo */}
        <div className="shrink-0">
          {row.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.photo_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {getInitials(row.first_name, row.last_name)}
            </div>
          )}
        </div>

        {/* Name + stats */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {fullName}
            {concerns && (
              <AlertCircle className="ml-1 inline h-3.5 w-3.5 text-rose-500" />
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.student_number}
            {" · Year avg "}
            <span className={cn("font-semibold",
              aggregate === null ? "text-gray-400"
              : aggregate < 30 ? "text-rose-600"
              : aggregate < 50 ? "text-amber-600"
              : "text-emerald-600",
            )}>
              {aggregate === null ? "—" : `${aggregate.toFixed(1)}%`}
            </span>
            {" · Attendance "}
            <span className={cn("font-semibold",
              attendance === null ? "text-gray-400"
              : attendance < 50 ? "text-rose-600"
              : attendance < 75 ? "text-amber-600"
              : "text-emerald-600",
            )}>
              {attendance === null ? "—" : `${attendance.toFixed(0)}%`}
            </span>
          </p>
        </div>

        {/* Outcome buttons */}
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map(({ key, label, icon }) => {
            const selected = decision.outcome === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleOutcome(key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "bg-[var(--brand)] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>

        {/* Target class (only for promote/repeat) */}
        {(decision.outcome === "promoted" || decision.outcome === "repeated") && (
          <select
            value={decision.target_class_id ?? ""}
            onChange={(e) => onChange({ target_class_id: e.target.value || null })}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">— Target class —</option>
            {targetClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {decision.outcome &&
          (decision.outcome === "promoted" || decision.outcome === "repeated") &&
          decision.target_class_id && (
            <Check className="h-4 w-4 text-emerald-500" />
          )}
      </div>

      {/* Reason — collapsed by default, shown when outcome is set */}
      {decision.outcome && (
        <div className="mt-2 pl-13">
          <input
            type="text"
            value={decision.reason}
            onChange={(e) => onChange({ reason: e.target.value })}
            placeholder="Reason (optional, e.g. parent request, poor performance)"
            className="h-7 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-xs dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
      )}
    </li>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Dashboard
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Only headteachers and school admins can run end-of-year roll-over.
        </p>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="px-5 py-3">
          <div className="h-8 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
        </li>
      ))}
    </ul>
  );
}
