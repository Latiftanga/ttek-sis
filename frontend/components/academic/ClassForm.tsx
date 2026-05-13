"use client";
import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useCreateClass, useUpdateClass, useSchoolProgrammes, type Class } from "@/lib/hooks/useAcademic";
import { useStaff } from "@/lib/hooks/useStaff";
import { useAuthStore } from "@/lib/store";
import { getApiError } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────

const LEVEL_GROUP_LABELS: Record<string, string> = {
  creche: "Creche", nursery: "Nursery", kg: "KG", basic: "Basic", shs: "SHS",
};

const SCHOOL_TYPE_GROUPS: Record<string, string[]> = {
  basic:    ["creche", "nursery", "kg", "basic"],
  shs:      ["shs"],
  combined: ["creche", "nursery", "kg", "basic", "shs"],
};

const LEVEL_NUMBERS: Record<string, number[]> = {
  creche: [], nursery: [1, 2], kg: [1, 2],
  basic: [1, 2, 3, 4, 5, 6, 7, 8, 9], shs: [1, 2, 3],
};


// ── Name preview (mirrors backend Class.generate_name) ────────────────────

function previewName(
  levelGroup: string,
  levelNumber: number | null,
  stream: string | null,
  programme: string | null,
): string {
  const label = LEVEL_GROUP_LABELS[levelGroup] ?? levelGroup.toUpperCase();
  if (levelGroup === "creche") return stream ? `${label} ${stream}` : label;
  if (!levelNumber) return label;

  // SHS: "{level_number}{short_name} {stream}" e.g. "1SC A"
  if (levelGroup === "shs") {
    let name = `${levelNumber}`;
    if (programme) name = `${name}${programme}`;
    if (stream) name = `${name} ${stream}`;
    return name;
  }

  let name = `${label} ${levelNumber}`;
  if (stream) name = `${name}${stream}`;
  return name;
}

// ── Schemas ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  level_group:      z.string().min(1, "Select a level group"),
  level_number:     z.number().nullable(),
  stream:           z.string().nullable(),
  programme:        z.string().nullable(),
  class_teacher_id: z.string().nullable(),
  capacity:         z.number().min(1).max(500),
}).superRefine((v, ctx) => {
  if (v.level_group !== "creche" && !v.level_number) {
    ctx.addIssue({ code: "custom", path: ["level_number"], message: "Level number is required" });
  }
  if (v.level_group === "shs" && !v.programme) {
    ctx.addIssue({ code: "custom", path: ["programme"], message: "Programme is required for SHS" });
  }
});

const editSchema = z.object({
  class_teacher_id: z.string().nullable(),
  capacity:         z.number().min(1).max(500),
  is_active:        z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues   = z.infer<typeof editSchema>;

// ── Props ─────────────────────────────────────────────────────────────────

interface ClassFormProps {
  class_?:   Class;
  onSuccess: () => void;
  onCancel:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ClassForm({ class_, onSuccess, onCancel }: ClassFormProps) {
  const isEdit = !!class_;
  const { school } = useAuthStore();
  const schoolType = school?.school_type ?? "basic";

  const availableGroups = SCHOOL_TYPE_GROUPS[schoolType] ?? ["basic"];
  const isSHSOnly = schoolType === "shs";

  const createClass = useCreateClass();
  const updateClass = useUpdateClass(class_?.id ?? "");

  // Programmes — only needed when school can have SHS classes
  const canHaveSHS = availableGroups.includes("shs");
  const { data: programmes = [] } = useSchoolProgrammes();

  // Active staff for class teacher dropdown
  const { data: staffList = [] } = useStaff({ status: "active", limit: 200 });

  // ── Create form ──────────────────────────────────────────────────────────

  const {
    register: regCreate,
    handleSubmit: handleCreate,
    watch: watchCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors, isSubmitting: createSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      level_group:      isSHSOnly ? "shs" : availableGroups[availableGroups.length - 1],
      level_number:     null,
      stream:           null,
      programme:        null,
      class_teacher_id: null,
      capacity:         45,
    },
  });

  const levelGroup  = watchCreate("level_group");
  const levelNumber = watchCreate("level_number");
  const stream      = watchCreate("stream");
  const programme   = watchCreate("programme");

  // Reset level_number + programme when level_group changes
  useEffect(() => {
    setCreateValue("level_number", null);
    setCreateValue("programme", null);
    setCreateValue("stream", null);
  }, [levelGroup, setCreateValue]);

  const availableLevels = LEVEL_NUMBERS[levelGroup] ?? [];
  const isSHS           = levelGroup === "shs";
  const isCreche        = levelGroup === "creche";
  const preview         = previewName(levelGroup, levelNumber, stream, programme);

  // ── Edit form ────────────────────────────────────────────────────────────

  const {
    register: regEdit,
    handleSubmit: handleEdit,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      class_teacher_id: class_?.class_teacher_id ?? null,
      capacity:         class_?.capacity ?? 45,
      is_active:        class_?.is_active ?? true,
    },
  });

  // ── Submit handlers ───────────────────────────────────────────────────────

  async function onCreateSubmit(values: CreateValues) {
    const body = {
      level_group:      values.level_group,
      level_number:     isCreche ? undefined : values.level_number,
      stream:           values.stream || undefined,
      programme:        isSHS ? values.programme : undefined,
      class_teacher_id: values.class_teacher_id || undefined,
      capacity:         values.capacity,
    };
    try {
      await createClass.mutateAsync(body);
      toast.success(`Class "${preview}" created`);
      onSuccess();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function onEditSubmit(values: EditValues) {
    const body = {
      class_teacher_id: values.class_teacher_id || null,
      capacity:         values.capacity,
      is_active:        values.is_active,
    };
    try {
      await updateClass.mutateAsync(body);
      toast.success("Class updated");
      onSuccess();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  // ── Render: edit mode ────────────────────────────────────────────────────

  if (isEdit) {
    return (
      <form onSubmit={handleEdit(onEditSubmit)} className="space-y-5" noValidate>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">Class</p>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{class_.name}</p>
        </div>

        <Select
          id="edit_teacher"
          label="Class Teacher"
          error={editErrors.class_teacher_id?.message}
          {...regEdit("class_teacher_id")}
        >
          <option value="">— None —</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name}
              {s.current_rank ? ` (${s.current_rank})` : ""}
            </option>
          ))}
        </Select>

        <Input
          id="edit_capacity"
          label="Capacity"
          type="number"
          min={1}
          max={500}
          error={editErrors.capacity?.message}
          {...regEdit("capacity", { valueAsNumber: true })}
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            className="h-4 w-4 rounded accent-[var(--brand)]"
            {...regEdit("is_active")}
          />
          <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
            Class is active
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={editSubmitting}>Save Changes</Button>
        </div>
      </form>
    );
  }

  // ── Render: create mode ──────────────────────────────────────────────────

  return (
    <form onSubmit={handleCreate(onCreateSubmit)} className="space-y-5" noValidate>

      {/* Level group — hidden for SHS-only schools since there's only one choice */}
      {!isSHSOnly && (
        <Select
          id="level_group"
          label="Level Group"
          error={createErrors.level_group?.message}
          {...regCreate("level_group")}
        >
          {availableGroups.map((g) => (
            <option key={g} value={g}>{LEVEL_GROUP_LABELS[g]}</option>
          ))}
        </Select>
      )}

      {/* Level number */}
      {!isCreche && (
        <Select
          id="level_number"
          label={`${LEVEL_GROUP_LABELS[levelGroup] ?? "Level"} Level *`}
          error={createErrors.level_number?.message}
          {...regCreate("level_number", { setValueAs: (v) => v ? Number(v) : null })}
        >
          <option value="">— Select level —</option>
          {availableLevels.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
      )}

      {/* Programme — SHS only, hidden for basic schools entirely */}
      {canHaveSHS && isSHS && (
        <Select
          id="programme"
          label="Programme *"
          error={createErrors.programme?.message}
          {...regCreate("programme")}
        >
          <option value="">— Select programme —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.short_name ?? p.name}>
              {p.name}{p.short_name ? ` (${p.short_name})` : ""}
            </option>
          ))}
        </Select>
      )}

      {/* Stream */}
      <Input
        id="stream"
        label="Stream (optional)"
        placeholder="e.g. A, Red, Green"
        error={createErrors.stream?.message}
        {...regCreate("stream")}
      />

      {/* Class teacher */}
      <Select
        id="class_teacher_id"
        label="Class Teacher (optional)"
        error={createErrors.class_teacher_id?.message}
        {...regCreate("class_teacher_id")}
      >
        <option value="">— None —</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.first_name} {s.last_name}
            {s.current_rank ? ` (${s.current_rank})` : ""}
          </option>
        ))}
      </Select>

      {/* Capacity */}
      <Input
        id="capacity"
        label="Capacity"
        type="number"
        min={1}
        max={500}
        error={createErrors.capacity?.message}
        {...regCreate("capacity", { valueAsNumber: true })}
      />

      {/* Live name preview */}
      {preview && (
        <div className="rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Class name preview</p>
          <p className="mt-0.5 text-base font-semibold text-[var(--brand)]">{preview}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={createSubmitting}>Create Class</Button>
      </div>
    </form>
  );
}
