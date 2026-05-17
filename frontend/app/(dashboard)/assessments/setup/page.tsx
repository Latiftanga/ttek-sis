"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Layers,
  ListChecks,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAssessmentCategories,
  useGradingScales,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateScale,
  useUpdateScale,
  useDeleteScale,
  useAddGrade,
  useUpdateGrade,
  useDeleteGrade,
} from "@/lib/hooks/useAssessments";
import { getApiError, cn } from "@/lib/utils";
import type { AssessmentCategory, Grade, GradingScale } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import Badge from "@/components/ui/Badge";
import Textarea from "@/components/ui/Textarea";

const ADMIN_ROLES = new Set(["school_admin", "headteacher"]);
const TABS = ["modes", "scales"] as const;
type Tab = (typeof TABS)[number];

export default function AssessmentSetupPage() {
  const { user } = useAuthStore();
  const isAdmin = !!user?.role && ADMIN_ROLES.has(user.role);
  const [tab, setTab] = useState<Tab>("modes");

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-5">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Assessment setup
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure the modes and grading scales used across all assessments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <TabButton active={tab === "modes"} onClick={() => setTab("modes")}>
          <ListChecks className="h-3.5 w-3.5" />
          Modes
        </TabButton>
        <TabButton active={tab === "scales"} onClick={() => setTab("scales")}>
          <Layers className="h-3.5 w-3.5" />
          Grading scales
        </TabButton>
      </div>

      {tab === "modes" && <ModesTab />}
      {tab === "scales" && <ScalesTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] text-[var(--brand)]"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
      )}
    >
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MODES TAB
// ═════════════════════════════════════════════════════════════════════════

const modeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  weight: z.coerce
    .number({ message: "Must be a number" })
    .gt(0, "Weight must be greater than 0")
    .lte(100, "Weight cannot exceed 100"),
  max_score: z.coerce
    .number({ message: "Must be a number" })
    .gt(0, "Max score must be greater than 0"),
  is_ca: z.boolean(),
  allows_multiple: z.boolean(),
  order: z.coerce.number().int().min(0),
});
type ModeValues = z.infer<typeof modeSchema>;

function ModesTab() {
  const { data: categories = [], isLoading } = useAssessmentCategories();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AssessmentCategory | null>(null);
  const [deleting, setDeleting] = useState<AssessmentCategory | null>(null);

  const totalWeight = categories.reduce(
    (sum, c) => sum + Number(c.weight),
    0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Assessment modes
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            e.g. Class Test, Exercise, End of Term Exam. Weights must add up to
            100% for term results to compute correctly.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add mode
        </Button>
      </div>

      <WeightBanner total={totalWeight} />

      {isLoading ? (
        <ModesSkeleton />
      ) : categories.length === 0 ? (
        <Empty message="No assessment modes yet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400 dark:bg-gray-800/40 dark:text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Weight</th>
                <th className="px-4 py-2.5 text-right font-medium">Max</th>
                <th className="px-4 py-2.5 text-left font-medium">Flags</th>
                <th className="px-4 py-2.5 text-right font-medium">Order</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">
                    {Number(c.weight)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">
                    {Number(c.max_score)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.is_ca && <Badge variant="blue">CA</Badge>}
                      {c.allows_multiple && (
                        <Badge variant="gray">Multiple allowed</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                    {c.order}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        aria-label={`Edit ${c.name}`}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        aria-label={`Remove ${c.name}`}
                        className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <ModeFormModal
          mode={null}
          totalWeight={totalWeight}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <ModeFormModal
          mode={editing}
          totalWeight={totalWeight}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteModeModal
          mode={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function WeightBanner({ total }: { total: number }) {
  const remaining = 100 - total;
  const ok = total === 100;
  const over = total > 100;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
          : over
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        Total weight: <strong>{total}%</strong>
        {ok
          ? " — ready for term-result computation."
          : over
            ? ` — over by ${total - 100}%. Reduce some weights.`
            : ` — ${remaining}% remaining.`}
      </span>
    </div>
  );
}

function ModeFormModal({
  mode,
  totalWeight,
  onClose,
}: {
  mode: AssessmentCategory | null;
  totalWeight: number;
  onClose: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isEdit = !!mode;

  const otherWeight = isEdit ? totalWeight - Number(mode!.weight) : totalWeight;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ModeValues>({
    resolver: zodResolver(modeSchema),
    defaultValues: {
      name: mode?.name ?? "",
      weight: mode ? Number(mode.weight) : 0,
      max_score: mode ? Number(mode.max_score) : 100,
      is_ca: mode?.is_ca ?? true,
      allows_multiple: mode?.allows_multiple ?? true,
      order: mode?.order ?? 1,
    },
  });

  async function onSubmit(values: ModeValues) {
    if (otherWeight + values.weight > 100) {
      toast.error(
        `Total weight would be ${otherWeight + values.weight}%. ${100 - otherWeight}% available.`,
      );
      return;
    }
    try {
      if (mode) {
        await update.mutateAsync({ id: mode.id, body: values });
        toast.success(`"${values.name}" updated`);
      } else {
        await create.mutateAsync(values);
        toast.success(`"${values.name}" added`);
      }
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not save."));
    }
  }

  return (
    <Drawer open onClose={onClose} title={isEdit ? `Edit ${mode!.name}` : "Add assessment mode"} width="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          id="m_name"
          label="Name *"
          placeholder="e.g. Class Test"
          error={errors.name?.message}
          {...register("name")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="m_weight"
            label="Weight (%) *"
            type="number"
            min={1}
            max={100}
            step="1"
            error={errors.weight?.message}
            {...register("weight")}
          />
          <Input
            id="m_max"
            label="Default max score *"
            type="number"
            min={1}
            step="0.5"
            error={errors.max_score?.message}
            {...register("max_score")}
          />
        </div>
        <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">
          Available weight: {100 - otherWeight}%. Default max score pre-fills
          new assessments — teachers can override per assessment.
        </p>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              {...register("is_ca")}
            />
            <div>
              <span className="font-medium">Counts toward Continuous Assessment (CA)</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tick for tests, exercises, projects. Untick only for one-off
                things that don't feed CA (e.g. mock exams).
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              {...register("allows_multiple")}
            />
            <div>
              <span className="font-medium">Multiple per term allowed</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tick for things like Class Test (you give several per term).
                Untick for one-off like End of Term Exam.
              </p>
            </div>
          </label>
        </div>

        <Input
          id="m_order"
          label="Display order"
          type="number"
          min={0}
          step="1"
          error={errors.order?.message}
          {...register("order")}
        />

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add mode"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function DeleteModeModal({
  mode,
  onClose,
}: {
  mode: AssessmentCategory;
  onClose: () => void;
}) {
  const del = useDeleteCategory();
  async function handleDelete() {
    try {
      await del.mutateAsync(mode.id);
      toast.success(`"${mode.name}" removed`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not remove. It may be in use."));
    }
  }
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title="Remove assessment mode?"
      description={
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Remove <strong className="text-gray-900 dark:text-gray-100">{mode.name}</strong>?
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-gray-400">
            <li>If any assessments use this mode, removal will be blocked.</li>
            <li>Otherwise the mode is deactivated (kept for historical records).</li>
          </ul>
        </>
      }
      confirmLabel="Remove"
      variant="danger"
      loading={del.isPending}
      onConfirm={handleDelete}
    />
  );
}

function ModesSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded bg-gray-50 dark:bg-gray-800"
        />
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCALES TAB
// ═════════════════════════════════════════════════════════════════════════

const scaleSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
});
type ScaleValues = z.infer<typeof scaleSchema>;

const gradeSchema = z
  .object({
    min_score: z.coerce.number().min(0).max(100),
    max_score: z.coerce.number().min(0).max(100),
    label: z.string().trim().min(1, "Label required"),
    remark: z.string().optional(),
    order: z.coerce.number().int().min(0),
  })
  .refine((v) => v.min_score < v.max_score, {
    message: "Min must be less than max",
    path: ["min_score"],
  });
type GradeValues = z.infer<typeof gradeSchema>;

function ScalesTab() {
  const { data: scales = [], isLoading } = useGradingScales();
  const [addingScale, setAddingScale] = useState(false);
  const [editingScale, setEditingScale] = useState<GradingScale | null>(null);
  const [deletingScale, setDeletingScale] = useState<GradingScale | null>(null);
  const [addingGradeTo, setAddingGradeTo] = useState<GradingScale | null>(null);
  const [editingGrade, setEditingGrade] = useState<
    { scale: GradingScale; grade: Grade } | null
  >(null);
  const [deletingGrade, setDeletingGrade] = useState<
    { scale: GradingScale; grade: Grade } | null
  >(null);

  const systemScales = scales.filter((s) => s.school_id === null);
  const customScales = scales.filter((s) => s.school_id !== null);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Grading scales
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Define how percentages map to letter grades (e.g. A1, B2, …).
          </p>
        </div>
        <Button size="sm" onClick={() => setAddingScale(true)}>
          <Plus className="h-4 w-4" />
          Add scale
        </Button>
      </div>

      {isLoading ? (
        <ModesSkeleton />
      ) : (
        <div className="space-y-4">
          {systemScales.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                System defaults
              </p>
              {systemScales.map((s) => (
                <ScaleCard
                  key={s.id}
                  scale={s}
                  systemOwned
                  onAddGrade={() => setAddingGradeTo(s)}
                  onEditScale={() => setEditingScale(s)}
                  onDeleteScale={() => setDeletingScale(s)}
                  onEditGrade={(g) => setEditingGrade({ scale: s, grade: g })}
                  onDeleteGrade={(g) => setDeletingGrade({ scale: s, grade: g })}
                />
              ))}
            </div>
          )}
          {customScales.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Your school's scales
              </p>
              {customScales.map((s) => (
                <ScaleCard
                  key={s.id}
                  scale={s}
                  systemOwned={false}
                  onAddGrade={() => setAddingGradeTo(s)}
                  onEditScale={() => setEditingScale(s)}
                  onDeleteScale={() => setDeletingScale(s)}
                  onEditGrade={(g) => setEditingGrade({ scale: s, grade: g })}
                  onDeleteGrade={(g) => setDeletingGrade({ scale: s, grade: g })}
                />
              ))}
            </div>
          )}
          {scales.length === 0 && <Empty message="No grading scales yet." />}
        </div>
      )}

      {addingScale && (
        <ScaleFormModal scale={null} onClose={() => setAddingScale(false)} />
      )}
      {editingScale && (
        <ScaleFormModal
          scale={editingScale}
          onClose={() => setEditingScale(null)}
        />
      )}
      {deletingScale && (
        <DeleteScaleConfirm
          scale={deletingScale}
          onClose={() => setDeletingScale(null)}
        />
      )}
      {addingGradeTo && (
        <GradeFormModal
          scale={addingGradeTo}
          grade={null}
          onClose={() => setAddingGradeTo(null)}
        />
      )}
      {editingGrade && (
        <GradeFormModal
          scale={editingGrade.scale}
          grade={editingGrade.grade}
          onClose={() => setEditingGrade(null)}
        />
      )}
      {deletingGrade && (
        <DeleteGradeConfirm
          scale={deletingGrade.scale}
          grade={deletingGrade.grade}
          onClose={() => setDeletingGrade(null)}
        />
      )}
    </section>
  );
}

function ScaleCard({
  scale,
  systemOwned,
  onAddGrade,
  onEditScale,
  onDeleteScale,
  onEditGrade,
  onDeleteGrade,
}: {
  scale: GradingScale;
  systemOwned: boolean;
  onAddGrade: () => void;
  onEditScale: () => void;
  onDeleteScale: () => void;
  onEditGrade: (grade: Grade) => void;
  onDeleteGrade: (grade: Grade) => void;
}) {
  const grades = [...(scale.grades ?? [])].sort((a, b) => a.order - b.order);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white">
              {scale.name}
            </p>
            {systemOwned ? (
              <Badge variant="gray">System</Badge>
            ) : (
              <Badge variant="blue">Custom</Badge>
            )}
          </div>
          {scale.description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {scale.description}
            </p>
          )}
        </div>
        {!systemOwned && (
          <div className="inline-flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onAddGrade}>
              <Plus className="h-3.5 w-3.5" />
              Add grade
            </Button>
            <button
              type="button"
              onClick={onEditScale}
              aria-label={`Edit ${scale.name}`}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDeleteScale}
              aria-label={`Delete ${scale.name}`}
              className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {grades.length === 0 ? (
        <p className="text-xs italic text-gray-400 dark:text-gray-500">
          No grades yet. Add grades so this scale can be applied.
        </p>
      ) : (
        <table className="min-w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            <tr>
              <th className="py-1 text-left font-medium">Range</th>
              <th className="py-1 text-left font-medium">Grade</th>
              <th className="py-1 text-left font-medium">Remark</th>
              {!systemOwned && <th className="py-1 text-right font-medium"></th>}
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-200">
            {grades.map((g) => (
              <tr key={g.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5 font-mono">
                  {Number(g.min_score)} – {Number(g.max_score)}
                </td>
                <td className="py-1.5 font-semibold">{g.label}</td>
                <td className="py-1.5 text-gray-500 dark:text-gray-400">
                  {g.remark ?? "—"}
                </td>
                {!systemOwned && (
                  <td className="py-1.5 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => onEditGrade(g)}
                        aria-label={`Edit grade ${g.label}`}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGrade(g)}
                        aria-label={`Delete grade ${g.label}`}
                        className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ScaleFormModal({
  scale,
  onClose,
}: {
  scale: GradingScale | null;
  onClose: () => void;
}) {
  const isEdit = scale !== null;
  const create = useCreateScale();
  const update = useUpdateScale();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScaleValues>({
    resolver: zodResolver(scaleSchema),
    defaultValues: {
      name: scale?.name ?? "",
      description: scale?.description ?? "",
    },
  });

  async function onSubmit(values: ScaleValues) {
    const body = {
      name: values.name,
      description: values.description?.trim() || null,
    };
    try {
      if (isEdit && scale) {
        await update.mutateAsync({ id: scale.id, body });
        toast.success(`"${values.name}" updated`);
      } else {
        await create.mutateAsync({
          name: values.name,
          description: body.description ?? undefined,
        });
        toast.success(`"${values.name}" added — now add some grades.`);
      }
      onClose();
    } catch (err) {
      toast.error(
        getApiError(err, isEdit ? "Could not update the scale." : "Could not create the scale."),
      );
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isEdit ? `Edit scale — ${scale!.name}` : "Add grading scale"}
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          id="s_name"
          label="Name *"
          placeholder="e.g. JHS Internal"
          error={errors.name?.message}
          {...register("name")}
        />
        <Textarea
          id="s_desc"
          label="Description"
          rows={2}
          placeholder="Optional — what this scale is for"
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add scale"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function DeleteScaleConfirm({
  scale,
  onClose,
}: {
  scale: GradingScale;
  onClose: () => void;
}) {
  const del = useDeleteScale();
  async function handle() {
    try {
      await del.mutateAsync(scale.id);
      toast.success(`"${scale.name}" deleted`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not delete the scale."));
    }
  }
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title="Delete this grading scale?"
      description={
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Remove <strong className="text-gray-900 dark:text-gray-100">{scale.name}</strong>?
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            All grades in this scale will be removed too. Any computed term
            results that referenced it will keep their stored grade letters,
            but future computations for classes using this scale will fall
            back to the system default of the same name.
          </p>
        </>
      }
      confirmLabel="Delete"
      variant="danger"
      loading={del.isPending}
      onConfirm={handle}
    />
  );
}

function GradeFormModal({
  scale,
  grade,
  onClose,
}: {
  scale: GradingScale;
  grade: Grade | null;
  onClose: () => void;
}) {
  const isEdit = grade !== null;
  const addGrade = useAddGrade();
  const updateGrade = useUpdateGrade();
  const nextOrder = (scale.grades?.length ?? 0) + 1;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: grade
      ? {
          min_score: Number(grade.min_score),
          max_score: Number(grade.max_score),
          label: grade.label,
          remark: grade.remark ?? "",
          order: grade.order,
        }
      : {
          min_score: 0,
          max_score: 100,
          label: "",
          remark: "",
          order: nextOrder,
        },
  });

  async function onSubmit(values: GradeValues) {
    try {
      if (isEdit && grade) {
        await updateGrade.mutateAsync({
          scaleId: scale.id,
          gradeId: grade.id,
          body: {
            min_score: values.min_score,
            max_score: values.max_score,
            label: values.label,
            remark: values.remark?.trim() || null,
            order: values.order,
          },
        });
        toast.success(`Grade ${values.label} updated`);
      } else {
        await addGrade.mutateAsync({
          scaleId: scale.id,
          body: {
            min_score: values.min_score,
            max_score: values.max_score,
            label: values.label,
            remark: values.remark?.trim() || undefined,
            order: values.order,
          },
        });
        toast.success(`Grade ${values.label} added`);
      }
      onClose();
    } catch (err) {
      toast.error(
        getApiError(err, isEdit ? "Could not update the grade." : "Could not add the grade."),
      );
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isEdit ? `Edit grade — ${grade!.label}` : `Add grade — ${scale.name}`}
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="g_min"
            label="Min % *"
            type="number"
            min={0}
            max={100}
            step="1"
            error={errors.min_score?.message}
            {...register("min_score")}
          />
          <Input
            id="g_max"
            label="Max % *"
            type="number"
            min={0}
            max={100}
            step="1"
            error={errors.max_score?.message}
            {...register("max_score")}
          />
        </div>
        <Input
          id="g_label"
          label="Grade *"
          placeholder="e.g. A1, B+, Excellent"
          error={errors.label?.message}
          {...register("label")}
        />
        <Input
          id="g_remark"
          label="Remark"
          placeholder="e.g. Excellent, Credit, Pass"
          error={errors.remark?.message}
          {...register("remark")}
        />
        <Input
          id="g_order"
          label="Display order"
          type="number"
          min={1}
          step="1"
          error={errors.order?.message}
          {...register("order")}
        />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add grade"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function DeleteGradeConfirm({
  scale,
  grade,
  onClose,
}: {
  scale: GradingScale;
  grade: Grade;
  onClose: () => void;
}) {
  const del = useDeleteGrade();
  async function handle() {
    try {
      await del.mutateAsync({ scaleId: scale.id, gradeId: grade.id });
      toast.success(`Grade ${grade.label} deleted`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not delete the grade."));
    }
  }
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      title="Delete this grade?"
      description={
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Remove <strong className="text-gray-900 dark:text-gray-100">{grade.label}</strong>{" "}
            ({Number(grade.min_score)}–{Number(grade.max_score)}) from{" "}
            <strong>{scale.name}</strong>?
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Scores that fall in this range will no longer be assigned a grade
            until you add a replacement band.
          </p>
        </>
      }
      confirmLabel="Delete"
      variant="danger"
      loading={del.isPending}
      onConfirm={handle}
    />
  );
}

// ── Empty / access denied ─────────────────────────────────────────────────

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="space-y-4">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assessments
      </Link>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              Assessment setup is for admins only
            </h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Modes and grading scales are configured once for the whole school.
              Ask a head teacher or school admin if changes are needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
