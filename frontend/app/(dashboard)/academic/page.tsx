"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  BookOpen, CalendarDays, School, ChevronDown, ChevronRight,
  Plus, Pencil, CheckCircle2, BookMarked, Trash2, ArrowRight,
  Layers, Shield,
} from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ClassForm from "@/components/academic/ClassForm";
import { formatDate, getApiError, capitalize } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears, useTerms, useClasses, useSubjects,
  useSchoolProgrammes, useSchoolHouses,
  useCreateYear, useUpdateYear, useSetCurrentYear,
  useCreateTerm, useUpdateTerm, useSetCurrentTerm,
  useCreateClass,
  useCreateSubject, useDeleteSubject,
  useCreateProgramme, useUpdateProgramme, useDeleteProgramme,
  useCreateHouse, useUpdateHouse, useDeleteHouse,
  type AcademicYear, type Term, type Class, type Subject,
  type SchoolProgramme, type SchoolHouse,
} from "@/lib/hooks/useAcademic";

// ── Tabs ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "calendar",   label: "Academic Calendar", icon: CalendarDays },
  { key: "classes",    label: "Classes",            icon: School },
  { key: "subjects",   label: "Subjects",           icon: BookMarked },
  { key: "programmes", label: "Programmes",         icon: Layers },
  { key: "houses",     label: "Houses",             icon: Shield },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// ── Level group display order + labels ────────────────────────────────────

const LEVEL_ORDER = ["preschool", "kg", "basic", "shs"];
const LEVEL_LABELS: Record<string, string> = {
  preschool: "Pre-School", kg: "KG", basic: "Basic", shs: "SHS",
};

// ── Year form schema ──────────────────────────────────────────────────────

const yearSchema = z
  .object({
    name:       z.string().regex(/^\d{4}\/\d{4}$/, "Format: YYYY/YYYY e.g. 2024/2025"),
    start_date: z.string().min(1, "Required"),
    end_date:   z.string().min(1, "Required"),
    is_current: z.boolean(),
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });
type YearValues = z.infer<typeof yearSchema>;

// ── Term form schema ──────────────────────────────────────────────────────

const termSchema = z
  .object({
    name:       z.enum(["Term 1", "Term 2", "Term 3"], { message: "Select a term" }),
    start_date: z.string().min(1, "Required"),
    end_date:   z.string().min(1, "Required"),
    is_current: z.boolean(),
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });
type TermValues = z.infer<typeof termSchema>;

// ── Programme form schema ─────────────────────────────────────────────────

const programmeSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  short_name:  z.string().min(1, "Short code is required").max(10, "Max 10 characters").toUpperCase(),
  description: z.string().optional(),
});
type ProgrammeValues = z.infer<typeof programmeSchema>;

// ── House form schema ─────────────────────────────────────────────────────

const houseSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour e.g. #3b82f6").optional().or(z.literal("")),
});
type HouseValues = z.infer<typeof houseSchema>;

// ── Subject form schema ───────────────────────────────────────────────────

const subjectSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  code:        z.string().optional(),
  category:    z.enum(["core", "elective", "vocational"]),
  level_group: z.enum(["all", "basic", "shs"]),
});
type SubjectValues = z.infer<typeof subjectSchema>;

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════

export default function AcademicPage() {
  const [tab, setTab] = useState<TabKey>("classes");
  const { user, school } = useAuthStore();
  const isAdmin = user?.role === "school_admin" || user?.role === "headteacher";
  const schoolType = school?.school_type ?? "basic";

  // Hide subjects tab for SHS-only schools (they use the same subjects structure
  // but subjects aren't school-type specific enough to warrant a separate tab)
  const visibleTabs = TABS.filter((t) => {
    // Subjects tab is visible to all school types
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Academic</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {visibleTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "calendar"   && <CalendarSection    isAdmin={isAdmin} />}
      {tab === "classes"    && <ClassesSection     isAdmin={isAdmin} schoolType={schoolType} />}
      {tab === "subjects"   && <SubjectsSection    isAdmin={isAdmin} schoolType={schoolType} />}
      {tab === "programmes" && <ProgrammesSection  isAdmin={isAdmin} />}
      {tab === "houses"     && <HousesSection      isAdmin={isAdmin} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// CALENDAR SECTION  (Academic Years + Terms)
// ═════════════════════════════════════════════════════════════════════════

function CalendarSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: years = [], isLoading } = useAcademicYears();
  const setCurrentYear = useSetCurrentYear();

  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [yearDrawer, setYearDrawer]   = useState(false);
  const [editYear, setEditYear]       = useState<AcademicYear | null>(null);
  const [termDrawer, setTermDrawer]   = useState<{ yearId: string; term?: Term } | null>(null);

  // Auto-expand the current year on first load
  useEffect(() => {
    const cur = years.find((y) => y.is_current);
    if (cur) setExpanded((prev) => new Set([...prev, cur.id]));
  }, [years]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSetCurrentYear(id: string) {
    try {
      await setCurrentYear.mutateAsync(id);
      toast.success("Current academic year updated");
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Academic Years</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditYear(null); setYearDrawer(true); }}>
            <Plus className="h-4 w-4" />Add Year
          </Button>
        )}
      </div>

      {years.length === 0 ? (
        <EmptyState
          message="No academic years yet."
          action={isAdmin ? { label: "Add Year", onClick: () => setYearDrawer(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {years.map((year) => (
            <YearCard
              key={year.id}
              year={year}
              isAdmin={isAdmin}
              expanded={expanded.has(year.id)}
              onToggle={() => toggleExpand(year.id)}
              onEdit={() => { setEditYear(year); setYearDrawer(true); }}
              onSetCurrent={() => handleSetCurrentYear(year.id)}
              onAddTerm={() => setTermDrawer({ yearId: year.id })}
              onEditTerm={(term) => setTermDrawer({ yearId: year.id, term })}
            />
          ))}
        </div>
      )}

      {/* Year drawer */}
      <Drawer
        open={yearDrawer}
        onClose={() => { setYearDrawer(false); setEditYear(null); }}
        title={editYear ? "Edit Academic Year" : "Add Academic Year"}
      >
        <YearForm
          year={editYear}
          onSuccess={() => { setYearDrawer(false); setEditYear(null); }}
          onCancel={() => { setYearDrawer(false); setEditYear(null); }}
        />
      </Drawer>

      {/* Term drawer */}
      <Drawer
        open={!!termDrawer}
        onClose={() => setTermDrawer(null)}
        title={termDrawer?.term ? "Edit Term" : "Add Term"}
      >
        {termDrawer && (
          <TermForm
            yearId={termDrawer.yearId}
            term={termDrawer.term}
            onSuccess={() => setTermDrawer(null)}
            onCancel={() => setTermDrawer(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

// ── Year card ─────────────────────────────────────────────────────────────

function YearCard({
  year, isAdmin, expanded, onToggle, onEdit, onSetCurrent, onAddTerm, onEditTerm,
}: {
  year: AcademicYear;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSetCurrent: () => void;
  onAddTerm: () => void;
  onEditTerm: (term: Term) => void;
}) {
  const { data: terms = [], isLoading: termsLoading } = useTerms(expanded ? year.id : null);
  const setCurrentTerm = useSetCurrentTerm(year.id);

  async function handleSetCurrentTerm(termId: string) {
    try {
      await setCurrentTerm.mutateAsync(termId);
      toast.success("Current term updated");
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Year header */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-2 text-left flex-1 min-w-0">
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
          <div className="min-w-0">
            <span className="font-semibold text-gray-900 dark:text-white">{year.name}</span>
            <span className="ml-3 text-sm text-gray-400 dark:text-gray-500">
              {formatDate(year.start_date)} – {formatDate(year.end_date)}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {year.is_current && <Badge variant="green">Current</Badge>}
          {isAdmin && !year.is_current && (
            <Button size="sm" variant="ghost" onClick={onSetCurrent}>
              <CheckCircle2 className="h-3.5 w-3.5" />Set Current
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
          )}
        </div>
      </div>

      {/* Terms */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {termsLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {terms.map((term) => (
                <div key={term.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {term.name}
                    </span>
                    <span className="ml-3 text-xs text-gray-400">
                      {formatDate(term.start_date)} – {formatDate(term.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {term.is_current && <Badge variant="blue">Current</Badge>}
                    {isAdmin && !term.is_current && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetCurrentTerm(term.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />Set Current
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => onEditTerm(term)}>
                        <Pencil className="h-3.5 w-3.5" />Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {terms.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">
                  No terms yet.
                </p>
              )}
            </div>
          )}
          {isAdmin && terms.length < 3 && (
            <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <Button size="sm" variant="ghost" onClick={onAddTerm}>
                <Plus className="h-4 w-4" />Add Term
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Year form ─────────────────────────────────────────────────────────────

function YearForm({
  year, onSuccess, onCancel,
}: {
  year?: AcademicYear | null;
  onSuccess: () => void;
  onCancel:  () => void;
}) {
  const createYear = useCreateYear();
  const updateYear = useUpdateYear(year?.id ?? "");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<YearValues>({
    resolver: zodResolver(yearSchema),
    defaultValues: {
      name:       year?.name ?? "",
      start_date: year?.start_date ?? "",
      end_date:   year?.end_date ?? "",
      is_current: year?.is_current ?? false,
    },
  });

  async function onSubmit(values: YearValues) {
    try {
      if (year) {
        await updateYear.mutateAsync(values);
        toast.success("Academic year updated");
      } else {
        await createYear.mutateAsync(values);
        toast.success(`Academic year ${values.name} created`);
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Input
        id="year_name"
        label="Year Name *"
        placeholder="2024/2025"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input id="year_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <Input id="year_end"   label="End Date *"   type="date" error={errors.end_date?.message}   {...register("end_date")} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="year_current" className="h-4 w-4 rounded accent-[var(--brand)]" {...register("is_current")} />
        <label htmlFor="year_current" className="text-sm text-gray-700 dark:text-gray-300">
          Set as current academic year
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{year ? "Save Changes" : "Create Year"}</Button>
      </div>
    </form>
  );
}

// ── Term form ─────────────────────────────────────────────────────────────

function TermForm({
  yearId, term, onSuccess, onCancel,
}: {
  yearId:    string;
  term?:     Term;
  onSuccess: () => void;
  onCancel:  () => void;
}) {
  const createTerm = useCreateTerm(yearId);
  const updateTerm = useUpdateTerm(yearId);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TermValues>({
    resolver: zodResolver(termSchema),
    defaultValues: {
      name:       (term?.name as TermValues["name"]) ?? "Term 1",
      start_date: term?.start_date ?? "",
      end_date:   term?.end_date ?? "",
      is_current: term?.is_current ?? false,
    },
  });

  async function onSubmit(values: TermValues) {
    try {
      if (term) {
        await updateTerm.mutateAsync({ termId: term.id, body: values });
        toast.success(`${values.name} updated`);
      } else {
        await createTerm.mutateAsync(values);
        toast.success(`${values.name} created`);
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Select
        id="term_name"
        label="Term *"
        error={errors.name?.message}
        {...register("name")}
        disabled={!!term}
      >
        <option value="Term 1">Term 1</option>
        <option value="Term 2">Term 2</option>
        <option value="Term 3">Term 3</option>
      </Select>
      <div className="grid grid-cols-2 gap-4">
        <Input id="term_start" label="Start Date *" type="date" error={errors.start_date?.message} {...register("start_date")} />
        <Input id="term_end"   label="End Date *"   type="date" error={errors.end_date?.message}   {...register("end_date")} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="term_current" className="h-4 w-4 rounded accent-[var(--brand)]" {...register("is_current")} />
        <label htmlFor="term_current" className="text-sm text-gray-700 dark:text-gray-300">
          Set as current term
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{term ? "Save Changes" : "Add Term"}</Button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// CLASSES SECTION
// ═════════════════════════════════════════════════════════════════════════

function ClassesSection({ isAdmin, schoolType }: { isAdmin: boolean; schoolType: string }) {
  const { data: allClasses = [], isLoading } = useClasses();
  const [showInactive, setShowInactive] = useState(false);
  const [classDrawer, setClassDrawer] = useState(false);
  const [editClass, setEditClass]     = useState<Class | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(LEVEL_ORDER));

  const classes = showInactive ? allClasses : allClasses.filter((c) => c.is_active);

  // Group by level_group, filtered by what's valid for this school type
  const SCHOOL_LEVEL_GROUPS: Record<string, string[]> = {
    basic: ["preschool", "kg", "basic"],
    shs:   ["shs"],
  };
  const validGroups = SCHOOL_LEVEL_GROUPS[schoolType] ?? ["basic"];
  const grouped = validGroups.reduce<Record<string, Class[]>>((acc, g) => {
    acc[g] = classes.filter((c) => c.level_group === g);
    return acc;
  }, {});

  function toggleGroup(g: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Classes</h2>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--brand)]"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditClass(null); setClassDrawer(true); }}>
            <Plus className="h-4 w-4" />Add Class
          </Button>
        )}
      </div>

      {/* Groups */}
      {validGroups.map((group) => {
        const groupClasses = grouped[group] ?? [];
        const isExpanded   = expandedGroups.has(group);

        return (
          <div key={group} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
            >
              {isExpanded
                ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
              <span className="font-semibold text-gray-900 dark:text-white">
                {LEVEL_LABELS[group]}
              </span>
              <span className="ml-1 text-sm text-gray-400">
                ({groupClasses.length} {groupClasses.length === 1 ? "class" : "classes"})
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                {groupClasses.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">
                    No {LEVEL_LABELS[group].toLowerCase()} classes yet.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {groupClasses.map((cls) => (
                      <div key={cls.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {cls.name}
                            </span>
                            {!cls.is_active && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                            {cls.class_teacher_name ?? "No class teacher"}
                            {" · "}Capacity {cls.capacity}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={`/academic/classes/${cls.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />Manage
                          </Link>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditClass(cls); setClassDrawer(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Class drawer */}
      <Drawer
        open={classDrawer}
        onClose={() => { setClassDrawer(false); setEditClass(null); }}
        title={editClass ? `Edit ${editClass.name}` : "Add Class"}
        width="md"
      >
        <ClassForm
          class_={editClass ?? undefined}
          onSuccess={() => { setClassDrawer(false); setEditClass(null); }}
          onCancel={() => { setClassDrawer(false); setEditClass(null); }}
        />
      </Drawer>

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SUBJECTS SECTION
// ═════════════════════════════════════════════════════════════════════════

function SubjectsSection({ isAdmin, schoolType }: { isAdmin: boolean; schoolType: string }) {
  const { data: subjects = [], isLoading } = useSubjects();
  const createSubject = useCreateSubject();
  const deleteSubject = useDeleteSubject();

  const [addOpen, setAddOpen]             = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<Subject | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<SubjectValues>({
      resolver: zodResolver(subjectSchema),
      defaultValues: { name: "", code: "", category: "core", level_group: "all" },
    });

  async function onAddSubject(values: SubjectValues) {
    try {
      await createSubject.mutateAsync({
        name:        values.name,
        code:        values.code || undefined,
        category:    values.category,
        level_group: values.level_group,
      });
      toast.success(`Subject "${values.name}" added`);
      reset();
      setAddOpen(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleDelete(subject: Subject) {
    try {
      await deleteSubject.mutateAsync(subject.id);
      toast.success(`"${subject.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  // For basic schools: show only "all" and "basic" level groups, hide "shs"
  // For SHS-only: show only "all" and "shs"
  // For combined: show all
  const LEVEL_GROUP_OPTIONS: Record<string, { value: string; label: string }[]> = {
    basic:    [{ value: "all", label: "All levels" }, { value: "basic", label: "Basic" }],
    shs:      [{ value: "all", label: "All levels" }, { value: "shs",   label: "SHS" }],
    combined: [{ value: "all", label: "All levels" }, { value: "basic", label: "Basic" }, { value: "shs", label: "SHS" }],
  };
  const levelGroupOptions = LEVEL_GROUP_OPTIONS[schoolType] ?? LEVEL_GROUP_OPTIONS.basic;

  // Group subjects by category
  const byCategory = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    const key = s.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const categoryOrder = ["core", "elective", "vocational"];
  const categoryLabels: Record<string, string> = {
    core: "Core", elective: "Elective", vocational: "Vocational",
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subjects</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />Add Subject
          </Button>
        )}
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          message="No subjects yet."
          action={isAdmin ? { label: "Add Subject", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {categoryOrder.map((cat) => {
            const catSubjects = byCategory[cat] ?? [];
            if (catSubjects.length === 0) return null;
            return (
              <div key={cat} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {categoryLabels[cat]} ({catSubjects.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {catSubjects.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {s.name}
                        </span>
                        {s.code && (
                          <span className="ml-2 font-mono text-xs text-gray-400">{s.code}</span>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        s.level_group === "all"   ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" :
                        s.level_group === "basic" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                        "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                      }`}>
                        {s.level_group === "all" ? "All" : capitalize(s.level_group)}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Remove ${s.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add subject modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Subject" size="sm">
        <form onSubmit={handleSubmit(onAddSubject)} className="space-y-4" noValidate>
          <Input
            id="subj_name"
            label="Subject Name *"
            placeholder="e.g. Mathematics"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            id="subj_code"
            label="Code (optional)"
            placeholder="e.g. MATH"
            error={errors.code?.message}
            {...register("code")}
          />
          <Select id="subj_category" label="Category" error={errors.category?.message} {...register("category")}>
            <option value="core">Core</option>
            <option value="elective">Elective</option>
            <option value="vocational">Vocational</option>
          </Select>
          <Select id="subj_level" label="Level Group" error={errors.level_group?.message} {...register("level_group")}>
            {levelGroupOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Add Subject</Button>
          </div>
        </form>
      </Modal>

      {/* Delete subject confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Subject?" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Remove <strong>{deleteTarget?.name}</strong>? This cannot be undone and may affect
          existing assessments linked to this subject.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteSubject.isPending}
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PROGRAMMES SECTION
// ═════════════════════════════════════════════════════════════════════════

function ProgrammesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: programmes = [], isLoading } = useSchoolProgrammes(true);
  const createProgramme = useCreateProgramme();
  const updateProgramme = useUpdateProgramme();
  const deleteProgramme = useDeleteProgramme();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<SchoolProgramme | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolProgramme | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ProgrammeValues>({ resolver: zodResolver(programmeSchema) });

  function openAdd() {
    reset({ name: "", short_name: "", description: "" });
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(p: SchoolProgramme) {
    reset({ name: p.name, short_name: p.short_name ?? "", description: p.description ?? "" });
    setEditTarget(p);
    setFormOpen(true);
  }

  async function onSubmit(values: ProgrammeValues) {
    try {
      if (editTarget) {
        await updateProgramme.mutateAsync({ id: editTarget.id, name: values.name, short_name: values.short_name, description: values.description });
        toast.success("Programme updated");
      } else {
        await createProgramme.mutateAsync({ name: values.name, short_name: values.short_name, description: values.description });
        toast.success(`"${values.name}" added`);
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleDelete(p: SchoolProgramme) {
    try {
      await deleteProgramme.mutateAsync(p.id);
      toast.success(`"${p.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Programmes</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Academic programmes offered by the school</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add Programme
          </Button>
        )}
      </div>

      {programmes.length === 0 ? (
        <EmptyState
          message="No programmes configured yet."
          action={isAdmin ? { label: "Add Programme", onClick: openAdd } : undefined}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:divide-gray-800">
          {programmes.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex flex-1 min-w-0 items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                {p.short_name && (
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {p.short_name}
                  </span>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? "Edit Programme" : "Add Programme"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="prog_name"
            label="Name *"
            placeholder="e.g. General Science"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            id="prog_short"
            label="Short Code *"
            placeholder="e.g. SC"
            error={errors.short_name?.message}
            {...register("short_name")}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            Used in class names — e.g. SC produces "1SC A", ART produces "2ART B"
          </p>
          <Textarea
            id="prog_desc"
            label="Description"
            placeholder="Optional description"
            error={errors.description?.message}
            {...register("description")}
          />
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editTarget ? "Save Changes" : "Add Programme"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Programme?" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Remove <strong>{deleteTarget?.name}</strong>? Students already assigned this programme keep the name; only future assignments are affected.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteProgramme.isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// HOUSES SECTION
// ═════════════════════════════════════════════════════════════════════════

function HousesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: houses = [], isLoading } = useSchoolHouses();
  const createHouse = useCreateHouse();
  const updateHouse = useUpdateHouse();
  const deleteHouse = useDeleteHouse();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<SchoolHouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolHouse | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<HouseValues>({ resolver: zodResolver(houseSchema) });

  const colorValue = watch("color");

  function openAdd() {
    reset({ name: "", color: "" });
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(h: SchoolHouse) {
    reset({ name: h.name, color: h.color ?? "" });
    setEditTarget(h);
    setFormOpen(true);
  }

  async function onSubmit(values: HouseValues) {
    const color = values.color || undefined;
    try {
      if (editTarget) {
        await updateHouse.mutateAsync({ id: editTarget.id, name: values.name, color });
        toast.success("House updated");
      } else {
        await createHouse.mutateAsync({ name: values.name, color });
        toast.success(`"${values.name}" added`);
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleDelete(h: SchoolHouse) {
    try {
      await deleteHouse.mutateAsync(h.id);
      toast.success(`"${h.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Houses</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">School houses for student grouping</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add House
          </Button>
        )}
      </div>

      {houses.length === 0 ? (
        <EmptyState
          message="No houses configured. Leave empty to let the house field accept free text."
          action={isAdmin ? { label: "Add House", onClick: openAdd } : undefined}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:divide-gray-800">
          {houses.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-200 dark:border-gray-700"
                style={{ backgroundColor: h.color ?? "#e5e7eb" }}
              />
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{h.name}</span>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(h)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label={`Edit ${h.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(h)}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Remove ${h.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? "Edit House" : "Add House"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="house_name"
            label="Name *"
            placeholder="e.g. Unity House"
            error={errors.name?.message}
            {...register("name")}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Colour <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900"
                value={colorValue || "#6b7280"}
                onChange={(e) => {
                  const el = document.getElementById("house_color") as HTMLInputElement | null;
                  if (el) el.value = e.target.value;
                }}
              />
              <Input
                id="house_color"
                placeholder="#6b7280"
                error={errors.color?.message}
                {...register("color")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editTarget ? "Save Changes" : "Add House"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove House?" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Remove <strong>{deleteTarget?.name}</strong>? Students already assigned this house keep the name; only future assignments are affected.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteHouse.isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Shared empty state ────────────────────────────────────────────────────

function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
      <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
      {action && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={action.onClick}>
          <Plus className="h-4 w-4" />{action.label}
        </Button>
      )}
    </div>
  );
}
