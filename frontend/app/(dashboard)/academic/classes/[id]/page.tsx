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
  TrendingUp, TrendingDown, RotateCcw, ArrowRightFromLine, GraduationCap,
  UserPlus, UserMinus, ExternalLink, Trash2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import Badge from "@/components/ui/Badge";
import ClassForm from "@/components/academic/ClassForm";
import EnrollStudentDrawer from "@/components/academic/EnrollStudentDrawer";
import { useAuthStore } from "@/lib/store";
import { capitalize, getApiError } from "@/lib/utils";
import {
  useClassDetail, useClassStudents, useAcademicYears, useClasses, useSubjects,
  usePromoteStudent, useDemoteStudent, useRepeatStudent, useTransferStudent,
  useGraduateStudent, useUnenrollStudent, useBulkPromote,
  useClassSubjects, useAddClassSubject, useUpdateClassSubject, useRemoveClassSubject,
  useStudentSubjects, useSetStudentSubjects,
  useSubjectEnrollments, useSetSubjectEnrollments,
  type AcademicYear, type Class, type ClassStudent, type ClassSubjectRow,
} from "@/lib/hooks/useAcademic";
import { useStaff } from "@/lib/hooks/useStaff";

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
    <Drawer open onClose={onClose} title="Promote Student" width="md">
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
        <Input id="promo_notes" label="Notes" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Promote</Button>
        </div>
      </form>
    </Drawer>
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
    <Drawer open onClose={onClose} title="Repeat Year" width="md">
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
        <Input id="rep_notes" label="Notes" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Confirm Repeat</Button>
        </div>
      </form>
    </Drawer>
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
    <Drawer open onClose={onClose} title="Mark as Transferred" width="md">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        This will mark <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> as transferred out of the school.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input id="tf_end" label="End Date" type="date" {...register("end_date")} />
        <Input id="tf_notes" label="Notes" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>Mark Transferred</Button>
        </div>
      </form>
    </Drawer>
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
    <Drawer open onClose={onClose} title="Graduate Student" width="md">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <strong className="text-gray-900 dark:text-white">
          {student.first_name} {student.last_name}
        </strong> will be marked as graduated.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input id="grad_end" label="Graduation Date" type="date" {...register("end_date")} />
        <Input id="grad_notes" label="Notes" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Graduate</Button>
        </div>
      </form>
    </Drawer>
  );
}

// ── Demote modal ──────────────────────────────────────────────────────────

function DemoteModal({
  student, years, currentClassId, onClose,
}: {
  student: ClassStudent;
  years: AcademicYear[];
  currentClassId: string;
  onClose: () => void;
}) {
  const { data: classes = [] } = useClasses(true);
  const demote = useDemoteStudent();
  const currentYear = years.find((y) => y.is_current) ?? years[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<z.infer<typeof promoteSchema>>({
      resolver: zodResolver(promoteSchema),
      defaultValues: {
        to_class_id:      "",
        academic_year_id: currentYear?.id ?? "",
        start_date:       "",
        notes:            "",
      },
    });

  const targetClasses = classes.filter((c) => c.id !== currentClassId);

  async function onSubmit(values: z.infer<typeof promoteSchema>) {
    try {
      await demote.mutateAsync({ enrollmentId: student.enrollment_id, body: values });
      toast.success(`${student.first_name} ${student.last_name} demoted`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Drawer open onClose={onClose} title="Demote Student" width="md">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Move <strong className="text-gray-900 dark:text-white">{student.first_name} {student.last_name}</strong> down to a lower class.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Select id="dem_class" label="Target Class *" error={errors.to_class_id?.message} {...register("to_class_id")}>
          <option value="">Select class</option>
          {targetClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select id="dem_year" label="Academic Year *" error={errors.academic_year_id?.message} {...register("academic_year_id")}>
          <option value="">Select year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
          ))}
        </Select>
        <Input id="dem_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <Input id="dem_notes" label="Reason / notes" {...register("notes")} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Demote</Button>
        </div>
      </form>
    </Drawer>
  );
}

// ── Unenroll modal ────────────────────────────────────────────────────────

function UnenrollConfirm({ student, onClose }: { student: ClassStudent; onClose: () => void }) {
  const unenroll = useUnenrollStudent();

  async function handleConfirm() {
    try {
      await unenroll.mutateAsync(student.enrollment_id);
      toast.success(`${student.first_name} ${student.last_name} unenrolled`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title="Unenroll Student?"
      description={
        <>
          <p>
            Hard-delete the enrollment for{" "}
            <strong className="text-gray-900 dark:text-white">
              {student.first_name} {student.last_name}
            </strong>. Use this only for placement mistakes — for proper exits use Transfer or Graduate.
          </p>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Will fail if the student already has attendance or scores in this class.
          </p>
        </>
      }
      confirmLabel="Unenroll"
      loading={unenroll.isPending}
      onConfirm={handleConfirm}
    />
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
    <Drawer open onClose={onClose} title="Bulk Promote Class" width="md">
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
    </Drawer>
  );
}

// ── Students tab ──────────────────────────────────────────────────────────

type ActionType = "promote" | "demote" | "repeat" | "transfer" | "graduate" | "unenroll";

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
  const isSHS = class_.level_group === "shs";
  const { data: years = [] }         = useAcademicYears();
  const currentYear                  = years.find((y) => y.is_current);
  const [yearId, setYearId]          = useState<string>("");
  const [menuOpen, setMenuOpen]      = useState<string | null>(null);
  const [menuPos, setMenuPos]        = useState({ top: 0, right: 0 });
  const menuRef                      = useRef<HTMLDivElement>(null);
  const [electivesStudent, setElectivesStudent] = useState<ClassStudent | null>(null);

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
      {(() => {
        const activeStudent = menuOpen ? students.find((x) => x.enrollment_id === menuOpen) : null;
        if (!activeStudent) return null;
        return (
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 50 }}
            className="min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {!isFinalYear && (
              <button
                onClick={() => { onAction(activeStudent, "promote"); setMenuOpen(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <TrendingUp className="h-4 w-4 text-emerald-500" />Promote
              </button>
            )}
            <button
              onClick={() => { onAction(activeStudent, "demote"); setMenuOpen(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <TrendingDown className="h-4 w-4 text-orange-500" />Demote
            </button>
            <button
              onClick={() => { onAction(activeStudent, "repeat"); setMenuOpen(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RotateCcw className="h-4 w-4 text-amber-500" />Repeat Year
            </button>
            <button
              onClick={() => { onAction(activeStudent, "transfer"); setMenuOpen(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowRightFromLine className="h-4 w-4 text-blue-500" />Transfer Out
            </button>
            {isFinalYear && (
              <button
                onClick={() => { onAction(activeStudent, "graduate"); setMenuOpen(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <GraduationCap className="h-4 w-4 text-purple-500" />Graduate
              </button>
            )}
            {isSHS && (
              <button
                onClick={() => { setElectivesStudent(activeStudent); setMenuOpen(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <BookMarked className="h-4 w-4 text-indigo-500" />Electives
              </button>
            )}
            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            <button
              onClick={() => { onAction(activeStudent, "unenroll"); setMenuOpen(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <UserMinus className="h-4 w-4" />Unenroll
            </button>
          </div>
        );
      })()}

      {/* Electives drawer */}
      {electivesStudent && (
        <ElectivesDrawer
          student={electivesStudent}
          enrollmentId={electivesStudent.enrollment_id}
          classId={class_.id}
          onClose={() => setElectivesStudent(null)}
        />
      )}
    </div>
  );
}

// ── Add subjects modal (multi-select) ────────────────────────────────────

interface AvailableSubject {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
}

function AddSubjectsModal({
  open, className, available, onClose, onAdd,
}: {
  open: boolean;
  className: string;
  available: AvailableSubject[];
  onClose: () => void;
  onAdd: (subjectIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === available.length ? new Set() : new Set(available.map((s) => s.id)),
    );
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await onAdd(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = available.length > 0 && selected.size === available.length;

  return (
    <Drawer open={open} onClose={onClose} title="Add Subjects to Class" width="md">
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Pick one or more subjects to add to {className}. Teachers can be assigned after.
      </p>
      {available.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          All available subjects have already been added.
        </p>
      ) : (
        <>
          <label className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-[var(--brand)]"
            />
            {allSelected ? "Deselect all" : `Select all (${available.length})`}
          </label>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {available.map((s) => {
              const checked = selected.has(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 rounded accent-[var(--brand)]"
                     />
                    <span className="text-gray-900 dark:text-white">{s.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    {s.code && <span className="font-mono">{s.code}</span>}
                    {s.category && (
                      <Badge variant={s.category === "core" ? "green" : "blue"}>
                        {capitalize(s.category)}
                      </Badge>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          type="button"
          loading={submitting}
          disabled={selected.size === 0}
          onClick={handleAdd}
        >
          Add {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
      </div>
    </Drawer>
  );
}


// ── Electives drawer — per-student elective subject selection ────────────

function ElectivesDrawer({
  student,
  enrollmentId,
  classId,
  onClose,
}: {
  student: ClassStudent;
  enrollmentId: string;
  classId: string;
  onClose: () => void;
}) {
  const { data: classSubjects = [] } = useClassSubjects(classId);
  const { data: current, isLoading } = useStudentSubjects(enrollmentId);
  const setSubjects = useSetStudentSubjects(enrollmentId);

  const electives = classSubjects.filter((cs) => cs.subject_category === "elective");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasInit = useRef(false);

  useEffect(() => {
    if (current && !hasInit.current) {
      setSelected(new Set(current.map((r) => r.subject_id)));
      hasInit.current = true;
    }
  }, [current]);

  function toggle(subjectId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      return next;
    });
  }

  async function handleSave() {
    try {
      await setSubjects.mutateAsync(Array.from(selected));
      toast.success("Elective subjects updated");
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Electives — ${student.first_name} ${student.last_name}`}
      width="md"
    >
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Select the elective subjects this student is taking. Core subjects apply automatically.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : electives.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No elective subjects have been added to this class yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {electives.map((cs) => {
            const checked = selected.has(cs.subject_id);
            return (
              <label
                key={cs.subject_id}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  checked
                    ? "border-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(cs.subject_id)}
                    className="h-4 w-4 rounded accent-[var(--brand)]"
                   />
                  <span className="font-medium text-gray-900 dark:text-white">{cs.subject_name}</span>
                </span>
                {cs.subject_code && (
                  <span className="font-mono text-xs text-gray-400">{cs.subject_code}</span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          type="button"
          loading={setSubjects.isPending}
          disabled={electives.length === 0}
          onClick={handleSave}
        >
          Save ({selected.size} selected)
        </Button>
      </div>
    </Drawer>
  );
}

// ── Subject electives drawer — manage who takes an elective subject ───────

function SubjectElectivesDrawer({
  cs,
  classId,
  onClose,
}: {
  cs: ClassSubjectRow;
  classId: string;
  onClose: () => void;
}) {
  const { data: students = [], isLoading } = useSubjectEnrollments(classId, cs.subject_id);
  const setEnrollments = useSetSubjectEnrollments(classId, cs.subject_id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasInit = useRef(false);

  useEffect(() => {
    if (students.length > 0 && !hasInit.current) {
      setSelected(new Set(students.filter((s) => s.is_enrolled).map((s) => s.enrollment_id)));
      hasInit.current = true;
    }
  }, [students]);

  function toggle(enrollmentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.enrollment_id)));
    }
  }

  async function handleSave() {
    try {
      await setEnrollments.mutateAsync(Array.from(selected));
      toast.success(`${cs.subject_name} enrolment updated`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  const allSelected = students.length > 0 && selected.size === students.length;

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${cs.subject_name} — Student Enrolment`}
      width="md"
    >
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Select the students who take this elective. Changes replace the current enrolment list.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No students enrolled in this class.</p>
      ) : (
        <>
          <label className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-[var(--brand)]"
             />
            {allSelected ? "Deselect all" : `Select all (${students.length})`}
          </label>
          <div className="space-y-1.5">
            {students.map((s) => {
              const checked = selected.has(s.enrollment_id);
              return (
                <label
                  key={s.enrollment_id}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    checked
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s.enrollment_id)}
                    className="h-4 w-4 rounded accent-[var(--brand)]"
                   />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)]">
                    {s.first_name[0]}{s.last_name[0]}
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-gray-900 dark:text-white">
                      {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ""} {s.last_name}
                    </span>
                    <span className="text-xs text-gray-400">#{s.student_number}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          type="button"
          loading={setEnrollments.isPending}
          disabled={students.length === 0}
          onClick={handleSave}
        >
          Save ({selected.size} of {students.length})
        </Button>
      </div>
    </Drawer>
  );
}

// ── Subjects tab — class curriculum + per-subject teacher assignment ─────

function SubjectsTab({ class_, isAdmin }: { class_: Class; isAdmin: boolean }) {
  const { data: classSubjects = [], isLoading } = useClassSubjects(class_.id);
  const { data: allSubjects = [] } = useSubjects();
  const { data: staffList = [] } = useStaff({ status: "active", limit: 500 });
  const addCs = useAddClassSubject(class_.id);
  const updateCs = useUpdateClassSubject(class_.id);
  const removeCs = useRemoveClassSubject(class_.id);

  const [addOpen, setAddOpen] = useState(false);
  const [editingCsId, setEditingCsId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClassSubjectRow | null>(null);
  const [electiveTarget, setElectiveTarget] = useState<ClassSubjectRow | null>(null);

  const isSHS = class_.level_group === "shs";

  // School is single-level, so just exclude already-added.
  const assignedIds = new Set(classSubjects.map((cs) => cs.subject_id));
  const availableSubjects = allSubjects.filter((s) => !assignedIds.has(s.id));

  async function handleAssignTeacher(csId: string, teacherId: string | null) {
    try {
      await updateCs.mutateAsync({ csId, body: { teacher_id: teacherId } });
      toast.success("Teacher updated");
      setEditingCsId(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await removeCs.mutateAsync(removeTarget.id);
      toast.success(`${removeTarget.subject_name} removed`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {classSubjects.length} subject{classSubjects.length !== 1 ? "s" : ""} in {class_.name}
        </p>
        {isAdmin && availableSubjects.length > 0 && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <BookMarked className="h-4 w-4" />Add Subject
          </Button>
        )}
      </div>

      {classSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
          <BookMarked className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">No subjects assigned yet.</p>
          {isAdmin && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setAddOpen(true)}>
              Add Subject
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {classSubjects.map((cs) => (
              <div key={cs.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {cs.subject_name}
                    </span>
                    {cs.subject_code && (
                      <span className="font-mono text-xs text-gray-400">{cs.subject_code}</span>
                    )}
                    {cs.subject_category && (
                      <Badge variant={cs.subject_category === "core" ? "green" : "blue"}>
                        {capitalize(cs.subject_category)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {editingCsId === cs.id ? (
                      <select
                        autoFocus
                        defaultValue={cs.teacher_id ?? ""}
                        onChange={(e) => handleAssignTeacher(cs.id, e.target.value || null)}
                        onBlur={() => setEditingCsId(null)}
                        className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">— Unassigned —</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => isAdmin && setEditingCsId(cs.id)}
                        disabled={!isAdmin}
                        className={isAdmin
                          ? "hover:text-[var(--brand)]"
                          : "cursor-default"}
                      >
                        {cs.teacher_name ?? <span className="italic text-gray-400">No teacher assigned</span>}
                      </button>
                    )}
                  </div>
                </div>
                {isSHS && cs.subject_category === "elective" && (
                  <button
                    onClick={() => setElectiveTarget(cs)}
                    className="shrink-0 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:border-[var(--brand)] hover:text-[var(--brand)] dark:border-gray-700 dark:text-gray-400"
                    title="Manage student enrolment for this elective"
                  >
                    {cs.enrolled_count ?? 0} student{cs.enrolled_count !== 1 ? "s" : ""}
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setRemoveTarget(cs)}
                    className="shrink-0 rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Remove ${cs.subject_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add subject modal */}
      <AddSubjectsModal
        open={addOpen}
        className={class_.name}
        available={availableSubjects}
        onClose={() => setAddOpen(false)}
        onAdd={async (subjectIds) => {
          const results = await Promise.allSettled(
            subjectIds.map((id) => addCs.mutateAsync({ subject_id: id }))
          );
          const added = results.filter((r) => r.status === "fulfilled").length;
          const failures = results
            .map((r, i) =>
              r.status === "rejected"
                ? `${availableSubjects.find((s) => s.id === subjectIds[i])?.name ?? subjectIds[i]}: ${getApiError(r.reason)}`
                : null
            )
            .filter(Boolean) as string[];
          if (added > 0) toast.success(`${added} subject${added !== 1 ? "s" : ""} added`);
          failures.forEach((f) => toast.error(f));
          if (failures.length === 0) setAddOpen(false);
        }}
      />

      {/* Remove confirmation */}
      <ConfirmSheet
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove Subject?"
        description={
          <>Remove <strong>{removeTarget?.subject_name}</strong> from {class_.name}? The subject remains in the school catalogue and can be re-added.</>
        }
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />

      {/* Subject-centric elective enrolment drawer */}
      {electiveTarget && (
        <SubjectElectivesDrawer
          cs={electiveTarget}
          classId={class_.id}
          onClose={() => setElectiveTarget(null)}
         />
      )}
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
      {tab === "subjects" && <SubjectsTab class_={class_} isAdmin={isAdmin} />}

      {/* Edit class drawer */}
      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${class_.name}`} width="md">
        <ClassForm class_={class_} onSuccess={() => setEditOpen(false)} onCancel={() => setEditOpen(false)} />
      </Drawer>

      {/* Enroll student modal */}
      <EnrollStudentDrawer open={enrollOpen} classId={classId} onClose={() => setEnrollOpen(false)} />

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
      {action?.action === "demote" && (
        <DemoteModal
          student={action.student}
          years={years}
          currentClassId={classId}
          onClose={() => setAction(null)}
         />
      )}
      {action?.action === "unenroll" && (
        <UnenrollConfirm student={action.student} onClose={() => setAction(null)} />
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
