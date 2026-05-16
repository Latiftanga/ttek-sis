"use client";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  AlertTriangle,
  Pencil,
  Sparkles,
  Clock,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useClasses,
  useClassStudents,
  type ClassStudent,
} from "@/lib/hooks/useAcademic";
import {
  useSessions,
  useSessionRecords,
  usePatchRecord,
} from "@/lib/hooks/useAttendance";
import { getApiError, getInitials, formatDate, cn } from "@/lib/utils";
import type { AttendanceStatus, AttendanceRecord } from "@/lib/api";
import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

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

const FLAG_LABEL: Record<string, string> = {
  outside_time_window: "Marked outside class hours",
  outside_school_hours: "Marked outside school hours",
  large_sync_gap: "Synced more than 12 hours after marking",
  submitted_too_fast: "Submitted very quickly — please review",
  future_timestamp: "Device clock was in the future",
};

const EDIT_ROLES = new Set(["school_admin", "headteacher", "teacher"]);

const editSchema = z.object({
  status: z.enum(["present", "absent", "late", "excused"]),
  reason: z.string().optional(),
  edit_reason: z.string().trim().min(1, "Tell us why you're changing this"),
});
type EditValues = z.infer<typeof editSchema>;

export default function SessionDetailPage() {
  const params = useParams<{ classId: string; sessionId: string }>();
  const classId = params.classId;
  const sessionId = params.sessionId;
  const { user } = useAuthStore();
  const canEdit = !!user?.role && EDIT_ROLES.has(user.role);

  // Class + students for name lookup
  const { data: years = [] } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: classes = [] } = useClasses();
  const class_ = classes.find((c) => c.id === classId);
  const { data: students = [] } = useClassStudents(classId, currentYear?.id);

  // Sessions for this class (we look up the one matching sessionId for meta)
  const { data: sessions = [] } = useSessions({ class_id: classId });
  const session = sessions.find((s) => s.id === sessionId);

  // Records
  const { data: records = [], isLoading: recordsLoading } =
    useSessionRecords(sessionId);

  // Edit state
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);

  // Merge records with student details and sort by name
  type Row = AttendanceRecord & {
    student: ClassStudent | null;
    displayName: string;
  };
  const rows: Row[] = useMemo(() => {
    return [...records]
      .map((r) => {
        const s = students.find((st) => st.student_id === r.student_id) ?? null;
        const name = s
          ? [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ")
          : "Unknown student";
        return { ...r, student: s, displayName: name };
      })
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        }),
      );
  }, [records, students]);

  return (
    <div className="space-y-4">
      <Link
        href={`/attendance/class/${classId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {class_?.name ?? "class"}
      </Link>

      <Header session={session} className_={class_?.name ?? "Class"} />

      {session?.is_flagged && (
        <FlagBanner reason={session.flag_reason} />
      )}

      {recordsLoading ? (
        <RecordsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <RecordRow
                key={row.id}
                row={row}
                canEdit={canEdit}
                onEdit={() => setEditTarget(row)}
              />
            ))}
          </ul>
        </div>
      )}

      {editTarget && (
        <EditRecordModal
          record={editTarget}
          studentName={
            rows.find((r) => r.id === editTarget.id)?.displayName ?? ""
          }
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ── Header & banners ──────────────────────────────────────────────────────

function Header({
  session,
  className_,
}: {
  session: { date: string; submitted_at: string | null; status: string } | undefined;
  className_: string;
}) {
  const dateLabel = session ? formatDate(session.date) : "—";
  const submittedLabel = session?.submitted_at
    ? new Date(session.submitted_at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        {className_}
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
        <span>{dateLabel}</span>
        {submittedLabel && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Submitted {submittedLabel}
          </span>
        )}
        {session?.status === "open" && (
          <Badge variant="blue">In progress</Badge>
        )}
      </div>
    </div>
  );
}

function FlagBanner({ reason }: { reason: string | null }) {
  const message =
    (reason && FLAG_LABEL[reason]) ||
    "This session was flagged for admin review.";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

function RecordRow({
  row,
  canEdit,
  onEdit,
}: {
  row: {
    id: string;
    status: AttendanceStatus;
    reason: string | null;
    is_edited: boolean;
    original_status: AttendanceStatus | null;
    edit_reason: string | null;
    student: ClassStudent | null;
    displayName: string;
  };
  canEdit: boolean;
  onEdit: () => void;
}) {
  const initials = row.student
    ? getInitials(row.student.first_name, row.student.last_name)
    : "?";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.displayName}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {row.student?.student_number ?? "—"}
            {row.reason ? ` · ${row.reason}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "min-w-[88px] shrink-0 rounded-full px-3 py-1.5 text-center text-xs font-semibold ring-1 ring-inset",
            STATUS_PILL_CLASSES[row.status],
          )}
        >
          {STATUS_LABEL[row.status]}
        </span>

        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${row.displayName}'s attendance`}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {row.is_edited && (
        <div className="mt-1.5 pl-12 text-xs text-gray-400 dark:text-gray-500">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Edited
          {row.original_status
            ? ` from ${STATUS_LABEL[row.original_status]}`
            : ""}
          {row.edit_reason ? ` · "${row.edit_reason}"` : ""}
        </div>
      )}
    </li>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────

function EditRecordModal({
  record,
  studentName,
  onClose,
}: {
  record: AttendanceRecord;
  studentName: string;
  onClose: () => void;
}) {
  const patch = usePatchRecord();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      status: record.status,
      reason: record.reason ?? "",
      edit_reason: "",
    },
  });

  async function onSubmit(values: EditValues) {
    try {
      await patch.mutateAsync({
        recordId: record.id,
        body: {
          status: values.status,
          reason: values.reason?.trim() || null,
          edit_reason: values.edit_reason.trim(),
        },
      });
      toast.success("Attendance updated");
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not save the change. Please try again."));
    }
  }

  return (
    <Drawer open onClose={onClose} title={`Edit attendance — ${studentName}`} width="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Current status:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {STATUS_LABEL[record.status]}
          </span>
        </p>

        <Select
          id="edit_status"
          label="Change to *"
          error={errors.status?.message}
          {...register("status")}
        >
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="excused">Excused</option>
        </Select>

        <Input
          id="edit_reason_note"
          label="Note for this student"
          placeholder="e.g. Sick, family emergency"
          error={errors.reason?.message}
          {...register("reason")}
        />

        <Textarea
          id="edit_reason"
          label="Why are you changing this? *"
          rows={2}
          placeholder="e.g. Marked absent by mistake — parent confirmed she was at school"
          error={errors.edit_reason?.message}
          {...register("edit_reason")}
        />

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save change
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// ── Empty & loading ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      No records for this session yet.
    </div>
  );
}

function RecordsSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded bg-gray-50 dark:bg-gray-800"
        />
      ))}
    </div>
  );
}
