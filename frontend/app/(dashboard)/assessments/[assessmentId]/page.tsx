"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Send,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Pencil,
  Sparkles,
  History,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useClasses, useSubjects } from "@/lib/hooks/useAcademic";
import {
  useGradebook,
  useAssessmentCategories,
  useBulkScore,
  usePublishAssessment,
  useUnpublishAssessment,
  useEditScore,
  useScoreHistory,
} from "@/lib/hooks/useAssessments";
import { getApiError, getInitials, formatDate, cn } from "@/lib/utils";
import type { GradebookEntry } from "@/lib/api";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

const ADMIN_ROLES = new Set(["school_admin", "headteacher"]);

interface Mark {
  score: string;     // string so input is controlled
  is_absent: boolean;
}

export default function ScoreEntryPage() {
  const params = useParams<{ assessmentId: string }>();
  const assessmentId = params.assessmentId;
  const { user } = useAuthStore();
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);

  const { data: gradebook, isLoading } = useGradebook(assessmentId);
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: categories = [] } = useAssessmentCategories();

  const bulkScore = useBulkScore(assessmentId);
  const publish = usePublishAssessment(assessmentId);
  const unpublish = useUnpublishAssessment(assessmentId);

  // Local edits keyed by student_id (draft-only quick entry)
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const initRef = useRef(false);

  // Per-row edit modal (used for published edits + history view)
  const [editTarget, setEditTarget] = useState<GradebookEntry | null>(null);

  // Initialize local state from server data
  useEffect(() => {
    if (initRef.current) return;
    if (!gradebook) return;
    initRef.current = true;
    const init: Record<string, Mark> = {};
    for (const e of gradebook.entries) {
      init[e.student_id] = {
        score: e.score != null ? String(e.score) : "",
        is_absent: e.is_absent,
      };
    }
    setMarks(init);
  }, [gradebook]);

  // Sort entries by display name
  const entries = useMemo(() => {
    if (!gradebook) return [];
    return [...gradebook.entries].sort((a, b) => {
      const an = `${a.first_name} ${a.last_name}`.toLowerCase();
      const bn = `${b.first_name} ${b.last_name}`.toLowerCase();
      return an.localeCompare(bn);
    });
  }, [gradebook]);

  if (isLoading || !gradebook) {
    return <LoadingSkeleton />;
  }

  const { assessment } = gradebook;
  const class_ = classes.find((c) => c.id === assessment.class_id);
  const subject = subjects.find((s) => s.id === assessment.subject_id);
  const category = categories.find((c) => c.id === assessment.category_id);
  const maxScore = Number(assessment.max_score);
  const isPublished = assessment.is_published;

  const liveSaved = Object.values(marks).filter(
    (m) => m.is_absent || m.score.trim() !== "",
  ).length;

  function setScore(studentId: string, value: string) {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        score: value,
        is_absent: false, // typing implicitly turns off absent
      },
    }));
  }

  function toggleAbsent(studentId: string) {
    setMarks((prev) => {
      const cur = prev[studentId] ?? { score: "", is_absent: false };
      const nextAbsent = !cur.is_absent;
      return {
        ...prev,
        [studentId]: {
          score: nextAbsent ? "" : cur.score,
          is_absent: nextAbsent,
        },
      };
    });
  }

  async function handleSave() {
    if (isPublished) {
      toast.error(
        "This assessment is published — corrections need a reason. Editing on this screen is coming in the next update.",
      );
      return;
    }
    // Build records — only include rows where teacher has entered something
    const records = entries
      .map((e) => {
        const m = marks[e.student_id];
        if (!m) return null;
        const hasInput = m.is_absent || m.score.trim() !== "";
        if (!hasInput) return null;
        if (m.is_absent) {
          return {
            student_id: e.student_id,
            score: null,
            is_absent: true,
            remarks: null,
          };
        }
        const num = Number(m.score);
        if (Number.isNaN(num)) return null;
        if (num < 0 || num > maxScore) {
          return { __err: `${e.first_name} ${e.last_name}: score must be between 0 and ${maxScore}` };
        }
        return {
          student_id: e.student_id,
          score: num,
          is_absent: false,
          remarks: null,
        };
      })
      .filter(Boolean) as Array<
        | { student_id: string; score: number | null; is_absent: boolean; remarks: null }
        | { __err: string }
      >;

    const errs = records.filter((r): r is { __err: string } => "__err" in r);
    if (errs.length > 0) {
      toast.error(errs[0].__err);
      return;
    }

    const valid = records.filter(
      (r): r is { student_id: string; score: number | null; is_absent: boolean; remarks: null } =>
        !("__err" in r),
    );

    if (valid.length === 0) {
      toast.error("Enter at least one score before saving.");
      return;
    }

    try {
      await bulkScore.mutateAsync({ records: valid });
      toast.success(`${valid.length} score${valid.length === 1 ? "" : "s"} saved`);
      // Reset init flag so refetched data re-initializes local state
      initRef.current = false;
    } catch (err) {
      toast.error(getApiError(err, "Could not save scores. Please try again."));
    }
  }

  async function handlePublish() {
    try {
      await publish.mutateAsync();
      toast.success("Assessment published. Students will see their scores in the portal (when it lands).");
    } catch (err) {
      toast.error(getApiError(err, "Could not publish. Make sure at least one score is saved."));
    }
  }

  async function handleUnpublish() {
    try {
      await unpublish.mutateAsync();
      toast.success("Assessment is back to Draft.");
    } catch (err) {
      toast.error(getApiError(err, "Could not unpublish."));
    }
  }

  return (
    <div className="space-y-4 pb-28">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {assessment.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {class_?.name ?? "—"}
              {subject ? ` · ${subject.name}` : ""}
              {category ? ` · ${category.name}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {assessment.date_administered
                  ? formatDate(assessment.date_administered)
                  : "Date not set"}
              </span>
              <span>Out of {maxScore}</span>
            </p>
          </div>
          {isPublished ? (
            <Badge variant="green" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Published
            </Badge>
          ) : (
            <Badge variant="gray">Draft</Badge>
          )}
        </div>

        {isPublished && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This assessment is published. Tap the pencil on a row to correct
              a score — a reason is required and the change is audited.
            </span>
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Roster — out of {maxScore}
          </p>
        </div>
        {entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No students enrolled in this class for the current year.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((e) => (
              <RosterRow
                key={e.student_id}
                entry={e}
                mark={marks[e.student_id] ?? { score: "", is_absent: false }}
                maxScore={maxScore}
                disabled={isPublished}
                isPublished={isPublished}
                onScore={(v) => setScore(e.student_id, v)}
                onToggleAbsent={() => toggleAbsent(e.student_id)}
                onEdit={() => setEditTarget(e)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Action bar */}
      <ActionBar
        liveSaved={liveSaved}
        total={gradebook.total_students}
        isPublished={isPublished}
        canPublish={!isPublished && (gradebook.scores_entered > 0 || liveSaved > 0)}
        isAdmin={isAdmin}
        saving={bulkScore.isPending}
        publishing={publish.isPending}
        unpublishing={unpublish.isPending}
        onSave={handleSave}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
      />

      {editTarget && (
        <EditScoreModal
          assessmentId={assessmentId}
          entry={editTarget}
          maxScore={maxScore}
          isPublished={isPublished}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ── Roster row ────────────────────────────────────────────────────────────

function RosterRow({
  entry,
  mark,
  maxScore,
  disabled,
  isPublished,
  onScore,
  onToggleAbsent,
  onEdit,
}: {
  entry: GradebookEntry;
  mark: Mark;
  maxScore: number;
  disabled: boolean;
  isPublished: boolean;
  onScore: (v: string) => void;
  onToggleAbsent: () => void;
  onEdit: () => void;
}) {
  const fullName = [entry.first_name, entry.middle_name, entry.last_name]
    .filter(Boolean)
    .join(" ");
  // Pencil for published assessments (the only way to edit) or for any
  // already-edited row (to surface history).
  const showPencil = isPublished || entry.is_edited;
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {getInitials(entry.first_name, entry.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {fullName}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {entry.student_number}
          </p>
        </div>

        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={maxScore}
          step="0.5"
          placeholder="—"
          disabled={disabled || mark.is_absent}
          value={mark.is_absent ? "" : mark.score}
          onChange={(e) => onScore(e.target.value)}
          aria-label={`Score for ${fullName} out of ${maxScore}`}
          className={cn(
            "w-20 shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
            (disabled || mark.is_absent) && "cursor-not-allowed opacity-50",
          )}
        />

        <label
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-1.5 text-xs",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand)]"
            checked={mark.is_absent}
            disabled={disabled}
            onChange={onToggleAbsent}
          />
          <span className="text-gray-600 dark:text-gray-300">Absent</span>
        </label>

        {showPencil && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${fullName}'s score`}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {entry.is_edited && (
        <div className="mt-1 pl-12 text-xs text-gray-400 dark:text-gray-500">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Edited
        </div>
      )}
    </li>
  );
}

// ── Sticky action bar ─────────────────────────────────────────────────────

function ActionBar({
  liveSaved,
  total,
  isPublished,
  canPublish,
  isAdmin,
  saving,
  publishing,
  unpublishing,
  onSave,
  onPublish,
  onUnpublish,
}: {
  liveSaved: number;
  total: number;
  isPublished: boolean;
  canPublish: boolean;
  isAdmin: boolean;
  saving: boolean;
  publishing: boolean;
  unpublishing: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 border-t border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {liveSaved}
          </span>{" "}
          of {total} marked
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!isPublished && (
            <>
              <Button onClick={onSave} loading={saving} size="lg">
                Save scores
              </Button>
              <Button
                variant="secondary"
                onClick={onPublish}
                loading={publishing}
                disabled={!canPublish}
                title={
                  canPublish
                    ? undefined
                    : "Save at least one score before publishing"
                }
                size="lg"
              >
                <Send className="h-4 w-4" />
                Publish
              </Button>
            </>
          )}
          {isPublished && isAdmin && (
            <Button
              variant="secondary"
              onClick={onUnpublish}
              loading={unpublishing}
              size="lg"
            >
              <RotateCcw className="h-4 w-4" />
              Unpublish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────

const editFormSchema = z
  .object({
    is_absent: z.boolean(),
    score: z.string().optional(),
    remarks: z.string().optional(),
    reason: z.string().optional(),
  });

type EditFormValues = z.infer<typeof editFormSchema>;

function EditScoreModal({
  assessmentId,
  entry,
  maxScore,
  isPublished,
  onClose,
}: {
  assessmentId: string;
  entry: GradebookEntry;
  maxScore: number;
  isPublished: boolean;
  onClose: () => void;
}) {
  const editScore = useEditScore(assessmentId);
  const [showHistory, setShowHistory] = useState(false);

  const fullName = [entry.first_name, entry.middle_name, entry.last_name]
    .filter(Boolean)
    .join(" ");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      is_absent: entry.is_absent,
      score: entry.score != null ? String(entry.score) : "",
      remarks: entry.remarks ?? "",
      reason: "",
    },
  });

  const isAbsent = watch("is_absent");

  async function onSubmit(values: EditFormValues) {
    // Manual checks Zod can't easily express because they depend on isPublished + isAbsent.
    if (isPublished && !values.reason?.trim()) {
      toast.error("Tell us why you're correcting this score.");
      return;
    }
    if (!values.is_absent) {
      const raw = values.score?.trim() ?? "";
      if (raw === "") {
        toast.error("Enter a score, or mark the student absent.");
        return;
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num < 0 || num > maxScore) {
        toast.error(`Score must be between 0 and ${maxScore}.`);
        return;
      }
    }

    try {
      await editScore.mutateAsync({
        studentId: entry.student_id,
        body: {
          score: values.is_absent ? null : Number(values.score),
          is_absent: values.is_absent,
          remarks: values.remarks?.trim() || null,
          reason: values.reason?.trim() || null,
        },
      });
      toast.success("Score updated");
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not save the change. Please try again."));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit score — ${fullName}`} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Current:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {entry.is_absent
              ? "Absent"
              : entry.score != null
                ? `${Number(entry.score)} / ${maxScore}`
                : "Not entered"}
          </span>
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--brand)]"
            {...register("is_absent")}
          />
          Mark as Absent
        </label>

        <Input
          id="edit_score"
          label={`New score (out of ${maxScore})`}
          type="number"
          min={0}
          max={maxScore}
          step="0.5"
          disabled={isAbsent}
          error={errors.score?.message}
          {...register("score")}
        />

        <Input
          id="edit_remarks"
          label="Note (optional)"
          placeholder="e.g. Late submission, sick on test day"
          error={errors.remarks?.message}
          {...register("remarks")}
        />

        <Textarea
          id="edit_reason"
          label={
            isPublished ? "Why are you changing this? *" : "Why are you changing this?"
          }
          rows={2}
          placeholder="e.g. Re-marked after parent query"
          error={errors.reason?.message}
          {...register("reason")}
        />

        <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Hide history" : "View edit history"}
          </button>
          {showHistory && (
            <ScoreHistoryList
              assessmentId={assessmentId}
              studentId={entry.student_id}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save change
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ScoreHistoryList({
  assessmentId,
  studentId,
}: {
  assessmentId: string;
  studentId: string;
}) {
  const { data: history = [], isLoading } = useScoreHistory(
    assessmentId,
    studentId,
  );

  if (isLoading) {
    return (
      <div className="mt-2 space-y-1">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        No edits yet.
      </p>
    );
  }

  const ordered = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );

  return (
    <ul className="mt-2 space-y-2 text-xs">
      {ordered.map((log) => {
        const oldText =
          log.old_score == null ? "—" : Number(log.old_score).toString();
        const newText =
          log.new_score == null ? "—" : Number(log.new_score).toString();
        const when = new Date(log.changed_at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <li
            key={log.id}
            className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
          >
            <div className="flex flex-wrap items-center gap-2 text-gray-700 dark:text-gray-200">
              <span className="font-mono">
                {oldText} → {newText}
              </span>
              {log.is_after_submission && (
                <Badge variant="yellow">After publish</Badge>
              )}
              {log.is_after_lock && <Badge variant="red">After lock</Badge>}
              <span className="ml-auto text-gray-400 dark:text-gray-500">
                {when}
              </span>
            </div>
            {log.reason && (
              <p className="mt-1 italic text-gray-500 dark:text-gray-400">
                &ldquo;{log.reason}&rdquo;
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
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
