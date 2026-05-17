"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, AlertCircle, CheckCircle2, Lock, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useAcademicYears, useTerms, useClasses } from "@/lib/hooks/useAcademic";
import {
  useComputeTermResults,
  useLockTermResults,
} from "@/lib/hooks/useAssessments";
import { getApiError } from "@/lib/utils";
import type { ComputeResult } from "@/lib/api";
import Button from "@/components/ui/Button";

const ACTOR_ROLES = new Set(["school_admin", "headteacher", "superadmin"]);

export default function TermResultsPage() {
  const { user } = useAuthStore();
  const canAccess = !!user?.role && ACTOR_ROLES.has(user.role);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(
    currentYear?.id ?? null,
  );
  const currentTerm = terms.find((t) => t.is_current);
  const { data: classes = [] } = useClasses(true);

  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState(() => "");
  const [lastResult, setLastResult] = useState<ComputeResult | null>(null);
  const [lockConfirm, setLockConfirm] = useState(false);

  // Pre-select current term once loaded
  const resolvedTermId = termId || currentTerm?.id || "";

  const compute = useComputeTermResults();
  const lock = useLockTermResults();

  async function handleCompute() {
    if (!classId || !resolvedTermId) {
      toast.error("Select a class and term first.");
      return;
    }
    try {
      const result = await compute.mutateAsync({
        class_id: classId,
        term_id: resolvedTermId,
      });
      setLastResult(result);
      setLockConfirm(false);
      toast.success(`Computed ${result.subjects} subject(s).`);
    } catch (err) {
      toast.error(getApiError(err, "Computation failed. Please try again."));
    }
  }

  async function handleLock() {
    if (!classId || !resolvedTermId) return;
    try {
      const result = await lock.mutateAsync({
        class_id: classId,
        term_id: resolvedTermId,
      });
      setLockConfirm(false);
      toast.success(result.message);
    } catch (err) {
      toast.error(getApiError(err, "Could not lock results. Please try again."));
    }
  }

  if (yearsLoading || termsLoading) {
    return <LoadingSkeleton />;
  }

  if (!canAccess) {
    return (
      <PageShell>
        <BackLink />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Only headteachers and school admins can compute term results.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  const selectedClass = classes.find((c) => c.id === classId);
  const selectedTerm = terms.find((t) => t.id === resolvedTermId);

  return (
    <PageShell>
      <BackLink />
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Term Results
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Compute weighted CA scores and positions for a class at end of term.
        </p>
      </div>

      {/* Compute panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          1. Select class and term
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setLastResult(null);
                setLockConfirm(false);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">— Select class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Term
            </label>
            <select
              value={resolvedTermId}
              onChange={(e) => {
                setTermId(e.target.value);
                setLastResult(null);
                setLockConfirm(false);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">— Select term —</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Re-running overwrites previous computed results (unless locked).
          </p>
          <Button
            onClick={handleCompute}
            loading={compute.isPending}
            disabled={!classId || !resolvedTermId}
          >
            <RefreshCw className="h-4 w-4" />
            Compute results
          </Button>
        </div>
      </div>

      {/* Result summary */}
      {lastResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                Computation complete
              </p>
              <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-300">
                {lastResult.message}
              </p>
              <div className="mt-3 flex gap-6 text-sm">
                <div>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {lastResult.subjects}
                  </span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    subject{lastResult.subjects !== 1 ? "s" : ""}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {lastResult.computed}
                  </span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    student-subject record{lastResult.computed !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock panel */}
      {lastResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
            2. Lock results (optional)
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Locking prevents further score edits and makes results visible to
            students in the portal. This cannot be undone from here — contact
            your admin if results need to be corrected after locking.
          </p>

          {!lockConfirm ? (
            <Button
              variant="secondary"
              onClick={() => setLockConfirm(true)}
              disabled={lock.isPending}
            >
              <Lock className="h-4 w-4" />
              Lock results for {selectedClass?.name ?? "this class"} —{" "}
              {selectedTerm?.name ?? "this term"}
            </Button>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="mb-3 text-sm font-medium text-amber-900 dark:text-amber-200">
                Lock{" "}
                <strong>
                  {selectedClass?.name} — {selectedTerm?.name}
                </strong>
                ? Students will see their results immediately.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleLock}
                  loading={lock.isPending}
                  className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                >
                  Yes, lock results
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setLockConfirm(false)}
                  disabled={lock.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

function BackLink() {
  return (
    <Link
      href="/assessments"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Assessments
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-8 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}
