"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Users, BookMarked, Pencil, MoreVertical,
  TrendingUp, RotateCcw, ArrowRightFromLine, GraduationCap,
  UserPlus, ExternalLink,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import Badge from "@/components/ui/Badge";
import ClassForm from "@/components/academic/ClassForm";
import EnrollStudentModal from "@/components/academic/EnrollStudentModal";
import { useAuthStore } from "@/lib/store";
import { capitalize, getApiError } from "@/lib/utils";
import {
  useClassDetail, useClassStudents, useAcademicYears, useClasses, useSubjects,
  usePromoteStudent, useRepeatStudent, useTransferStudent, useGraduateStudent,
  useBulkPromote,
  type AcademicYear, type Class, type ClassStudent,
} from "@/lib/hooks/useAcademic";

// ── Action schemas ────────────────────────────────────────────────────────

const promoteSchema = z.object({
  to_class_id:      z.string().min(1, "Select a target class"),
  academic_year_id: z.string().min(1, "Select an academic year"),
  start_date:       z.string().min(1, "Required"),
  notes:            z.string().optional(),
});

const repeatSchema = z.object({
  academic_year_id: z.string().min(1, "Select an academic year"),
  start_date:       z.string().min(1, "Required"),
  notes:            z.string().optional(),
});

const endActionSchema = z.object({
  end_date: z.string().optional(),
  notes:    z.string().optional(),
});

const bulkSchema = z.object({
  to_class_id:      z.string().min(1, "Select a target class"),
  academic_year_id: z.string().min(1, "Select an academic year"),
  start_date:       z.string().min(1, "Required"),
});

// ── Promote modal ─────────────────────────────────────────────────────────

function PromoteModal({
  student, years, currentClassId, onClose,
}: {
  student: ClassStudent;
  years: AcademicYear[];
  currentClassId: string;
  onClose: () => void;
}) {
  const { data: classes = [] } = useClasses(true);
  const promote = usePromoteStudent();
  const nextYear = years.find((y) => !y.is_current) ?? years[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<z.infer<typeof promoteSchema>>({
      resolver: zodResolver(promoteSchema),
      defaultValues: {
        to_class_id:      "",
        academic_year_id: nextYear?.id ?? "",
        start_date:       "",
        notes:            "",
      },
    });

  const targetClasses = classes.filter((c) => c.id !== currentClassId);

  async function onSubmit(values: z.infer<typeof promoteSchema>) {
    try {
      await promote.mutateAsync({ enrollmentId: student.enrollment_id, body: values });
      toast.success(`${student.first_name} ${student.last_name} promoted`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Promote Student" size="sm">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Promoting <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> to a new class and academic year.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Select id="promo_class" label="Target Class *" error={errors.to_class_id?.message} {...register("to_class_id")}>
          <option value="">Select class</option>
          {targetClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select id="promo_year" label="Academic Year *" error={errors.academic_year_id?.message} {...register("academic_year_id")}>
          <option value="">Select year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
          ))}
        </Select>
        <Input id="promo_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <Input id="promo_notes" label="Notes (optional)" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Promote</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Repeat modal ──────────────────────────────────────────────────────────

function RepeatModal({
  student, years, onClose,
}: {
  student: ClassStudent;
  years: AcademicYear[];
  onClose: () => void;
}) {
  const repeat = useRepeatStudent();
  const nextYear = years.find((y) => !y.is_current) ?? years[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<z.infer<typeof repeatSchema>>({
      resolver: zodResolver(repeatSchema),
      defaultValues: { academic_year_id: nextYear?.id ?? "", start_date: "", notes: "" },
    });

  async function onSubmit(values: z.infer<typeof repeatSchema>) {
    try {
      await repeat.mutateAsync({ enrollmentId: student.enrollment_id, body: values });
      toast.success(`${student.first_name} ${student.last_name} set to repeat`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Repeat Year" size="sm">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> will stay in the same class for the selected academic year.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Select id="rep_year" label="Academic Year *" error={errors.academic_year_id?.message} {...register("academic_year_id")}>
          <option value="">Select year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
          ))}
        </Select>
        <Input id="rep_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <Input id="rep_notes" label="Notes (optional)" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Confirm Repeat</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer modal ────────────────────────────────────────────────────────

function TransferModal({ student, onClose }: { student: ClassStudent; onClose: () => void }) {
  const transfer = useTransferStudent();

  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<z.infer<typeof endActionSchema>>({
      resolver: zodResolver(endActionSchema),
      defaultValues: { end_date: "", notes: "" },
    });

  async function onSubmit(values: z.infer<typeof endActionSchema>) {
    try {
      await transfer.mutateAsync({ enrollmentId: student.enrollment_id, body: values });
      toast.success(`${student.first_name} ${student.last_name} marked as transferred`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Mark as Transferred" size="sm">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        This will mark <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> as transferred out of the school.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input id="tf_end" label="End Date (optional)" type="date" {...register("end_date")} />
        <Input id="tf_notes" label="Notes (optional)" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>Mark Transferred</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Graduate modal ────────────────────────────────────────────────────────

function GraduateModal({ student, onClose }: { student: ClassStudent; onClose: () => void }) {
  const graduate = useGraduateStudent();

  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<z.infer<typeof endActionSchema>>({
      resolver: zodResolver(endActionSchema),
      defaultValues: { end_date: "", notes: "" },
    });

  async function onSubmit(values: z.infer<typeof endActionSchema>) {
    try {
      await graduate.mutateAsync({ enrollmentId: student.enrollment_id, body: values });
      toast.success(`${student.first_name} ${student.last_name} graduated`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Graduate Student" size="sm">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> will be marked as graduated.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input id="grad_end" label="Graduation Date (optional)" type="date" {...register("end_date")} />
        <Input id="grad_notes" label="Notes (optional)" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Graduate</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Bulk promote modal ────────────────────────────────────────────────────

function BulkPromoteModal({
  fromClassId, fromClassName, years, onClose,
}: {
  fromClassId:   string;
  fromClassName: string;
  years:         AcademicYear[];
  onClose:       () => void;
}) {
  const { data: classes = [] } = useClasses(true);
  const bulkPromote = useBulkPromote();
  const nextYear = years.find((y) => !y.is_current) ?? years[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<z.infer<typeof bulkSchema>>({
      resolver: zodResolver(bulkSchema),
      defaultValues: {
        to_class_id:      "",
        academic_year_id: nextYear?.id ?? "",
        start_date:       "",
      },
    });

  const targetClasses = classes.filter((c) => c.id !== fromClassId);

  async function onSubmit(values: z.infer<typeof bulkSchema>) {
    try {
      const result = await bulkPromote.mutateAsync({
        from_class_id:    fromClassId,
        to_class_id:      values.to_class_id,
        academic_year_id: values.academic_year_id,
        start_date:       values.start_date,
      });
      const r = result as { promoted: number; skipped: number };
      toast.success(`${r.promoted} student${r.promoted !== 1 ? "s" : ""} promoted${r.skipped ? `, ${r.skipped} skipped` : ""}`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Bulk Promote Class" size="sm">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Promote all active students from <strong className="text-gray-900 dark:text-white">{fromClassName}</strong> to
        a new class and academic year.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Select id="bulk_class" label="Target Class *" error={errors.to_class_id?.message} {...register("to_class_id")}>
          <option value="">Select class</option>
          {targetClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select id="bulk_year" label="Academic Year *" error={errors.academic_year_id?.message} {...register("academic_year_id")}>
          <option value="">Select year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
          ))}
        </Select>
        <Input id="bulk_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Promote All</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Students tab ──────────────────────────────────────────────────────────

type ActionType = "promote" | "repeat" | "transfer" | "graduate";

function StudentsTab({
  class_,
  isAdmin,
  isFinalYear,
  onAction,
  onEnroll,
  onBulkPromote,
}: {
  class_:        Class;
  isAdmin:       boolean;
  isFinalYear:   boolean;
  onAction:      (student: ClassStudent, action: ActionType) => void;
  onEnroll:      () => void;
  onBulkPromote: () => void;
}) {
  const { data: years = [] }         = useAcademicYears();
  const currentYear                  = years.find((y) => y.is_current);
  const [yearId, setYearId]          = useState<string>("");
  const [menuOpen, setMenuOpen]      = useState<string | null>(null);
  const [menuPos, setMenuPos]        = useState({ top: 0, right: 0 });
  const menuRef                      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentYear && !yearId) setYearId(currentYear.id);
  }, [currentYear?.id, yearId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null);
    }
    function scrollHandler() { setMenuOpen(null); }
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", scrollHandler, true);
    };
  }, []);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, studentId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(studentId);
  }

  const { data: students = [], isLoading } = useClassStudents(class_.id, yearId || undefined);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? "…" : `${students.length} student${students.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={onEnroll}>
            <UserPlus className="h-4 w-4" />Enroll Student
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
          <Users className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">No students enrolled.</p>
          {isAdmin && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={onEnroll}>
              <UserPlus className="h-4 w-4" />Enroll Student
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {students.map((s, idx) => (
              <div key={s.enrollment_id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 shrink-0 text-right text-xs text-gray-400">{idx + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)]">
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ""} {s.last_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    #{s.student_number}
                    {s.gender ? ` · ${capitalize(s.gender)}` : ""}
                    {s.is_boarding ? " · Boarding" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/students/${s.student_id}`}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    title="View profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={(e) => openMenu(e, s.enrollment_id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      aria-label="More actions"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bulk promote footer */}
          {isAdmin && students.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <Button size="sm" variant="secondary" onClick={onBulkPromote}>
                <TrendingUp className="h-4 w-4" />Bulk Promote Class
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 50 }}
          className="min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {(() => {
            const s = students.find((x) => x.enrollment_id === menuOpen)!;
            if (!s) return null;
            return (
              <>
                {!isFinalYear && (
                  <button
                    onClick={() => { onAction(s, "promote"); setMenuOpen(null); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <TrendingUp className="h-4 w-4 text-emerald-500" />Promote
                  </button>
                )}
                <button
                  onClick={() => { onAction(s, "repeat"); setMenuOpen(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-4 w-4 text-amber-500" />Repeat Year
                </button>
                <button
                  onClick={() => { onAction(s, "transfer"); setMenuOpen(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ArrowRightFromLine className="h-4 w-4 text-blue-500" />Transfer Out
                </button>
                {isFinalYear && (
                  <button
                    onClick={() => { onAction(s, "graduate"); setMenuOpen(null); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <GraduationCap className="h-4 w-4 text-purple-500" />Graduate
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Subjects tab ──────────────────────────────────────────────────────────

function SubjectsTab({ class_ }: { class_: Class }) {
  const { data: allSubjects = [], isLoading } = useSubjects();

  const subjects = allSubjects.filter(
    (s) => s.level_group === "all" || s.level_group === class_.level_group,
  );

  const byCategory = subjects.reduce<Record<string, typeof subjects>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const categoryOrder  = ["core", "elective", "vocational"];
  const categoryLabels: Record<string, string> = { core: "Core", elective: "Elective", vocational: "Vocational" };

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
        <BookMarked className="h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
          No subjects configured for {capitalize(class_.level_group)} level yet.
        </p>
        <Link href="/academic?tab=subjects" className="mt-2 text-xs text-[var(--brand)] hover:underline">
          Manage subjects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing subjects for <strong>{capitalize(class_.level_group)}</strong> level (includes &quot;all levels&quot; subjects).
      </p>
      {categoryOrder.map((cat) => {
        const catSubjects = byCategory[cat] ?? [];
        if (catSubjects.length === 0) return null;
        return (
          <div key={cat} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                {categoryLabels[cat]} ({catSubjects.length})
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {catSubjects.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                    {s.code && <span className="ml-2 font-mono text-xs text-gray-400">{s.code}</span>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    s.level_group === "all"
                      ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      : s.level_group === "basic"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                  }`}>
                    {s.level_group === "all" ? "All" : capitalize(s.level_group)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════

type ActionState = { student: ClassStudent; action: ActionType } | null;

export default function ClassDetailPage() {
  const params  = useParams();
  const classId = params.id as string;
  const { user } = useAuthStore();
  const isAdmin = user?.role === "school_admin" || user?.role === "headteacher";

  const { data: class_, isLoading } = useClassDetail(classId);
  const { data: years = [] }        = useAcademicYears();

  const [tab, setTab]             = useState<"students" | "subjects">("students");
  const [editOpen, setEditOpen]   = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [action, setAction]       = useState<ActionState>(null);

  const handleAction = useCallback((student: ClassStudent, act: ActionType) => {
    setAction({ student, action: act });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (!class_) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Class not found.</p>
        <Link href="/academic" className="mt-3 text-sm text-[var(--brand)] hover:underline">
          ← Back to Academic
        </Link>
      </div>
    );
  }

  const isFinalYear =
    (class_.level_group === "basic" && class_.level_number === 9) ||
    (class_.level_group === "shs"   && class_.level_number === 3);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/academic"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />Back to Academic
      </Link>

      {/* Class header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{class_.name}</h1>
              {class_.is_bece_level  && <Badge variant="yellow">BECE</Badge>}
              {class_.is_wassce_level && <Badge variant="blue">WASSCE</Badge>}
              {!class_.is_active     && <Badge variant="gray">Inactive</Badge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{class_.class_teacher_name ?? "No class teacher assigned"}</span>
              <span>Capacity: {class_.capacity}</span>
              {class_.programme && <span>Programme: {class_.programme}</span>}
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />Edit Class
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[
          { key: "students" as const, label: "Students", icon: Users },
          { key: "subjects" as const, label: "Subjects", icon: BookMarked },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "students" && (
        <StudentsTab
          class_={class_}
          isAdmin={isAdmin}
          isFinalYear={isFinalYear}
          onAction={handleAction}
          onEnroll={() => setEnrollOpen(true)}
          onBulkPromote={() => setBulkOpen(true)}
        />
      )}
      {tab === "subjects" && <SubjectsTab class_={class_} />}

      {/* Edit class drawer */}
      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${class_.name}`} width="md">
        <ClassForm class_={class_} onSuccess={() => setEditOpen(false)} onCancel={() => setEditOpen(false)} />
      </Drawer>

      {/* Enroll student modal */}
      <EnrollStudentModal open={enrollOpen} classId={classId} onClose={() => setEnrollOpen(false)} />

      {/* Individual action modals */}
      {action?.action === "promote" && (
        <PromoteModal
          student={action.student}
          years={years}
          currentClassId={classId}
          onClose={() => setAction(null)}
        />
      )}
      {action?.action === "repeat" && (
        <RepeatModal student={action.student} years={years} onClose={() => setAction(null)} />
      )}
      {action?.action === "transfer" && (
        <TransferModal student={action.student} onClose={() => setAction(null)} />
      )}
      {action?.action === "graduate" && (
        <GraduateModal student={action.student} onClose={() => setAction(null)} />
      )}

      {/* Bulk promote modal */}
      {bulkOpen && (
        <BulkPromoteModal
          fromClassId={classId}
          fromClassName={class_.name}
          years={years}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  );
}
