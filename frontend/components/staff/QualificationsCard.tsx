"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Trash2, GraduationCap } from "lucide-react";
import toast from "react-hot-toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useAddQualification, useRemoveQualification, type StaffQualification } from "@/lib/hooks/useStaff";
import { getApiError } from "@/lib/utils";

const CERT_TYPES = [
  { value: "degree",       label: "Degree" },
  { value: "diploma",      label: "Diploma" },
  { value: "professional", label: "Professional Certificate" },
  { value: "short_course", label: "Short Course" },
];

const schema = z.object({
  title:         z.string().min(1, "Title is required"),
  institution:   z.string().optional(),
  year_obtained: z.string().optional(),
  cert_type:     z.enum(["degree", "diploma", "professional", "short_course", ""]).optional(),
  notes:         z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  staffId:        string;
  qualifications: StaffQualification[];
  canEdit:        boolean;   // true for own record or admin
}

export default function QualificationsCard({ staffId, qualifications, canEdit }: Props) {
  const addQual   = useAddQualification(staffId);
  const removeQual = useRemoveQualification(staffId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    try {
      await addQual.mutateAsync({
        title:         values.title,
        institution:   values.institution   || undefined,
        year_obtained: values.year_obtained ? parseInt(values.year_obtained) : undefined,
        cert_type:     values.cert_type     || undefined,
        notes:         values.notes         || undefined,
      });
      toast.success("Qualification added");
      reset();
      setAdding(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await removeQual.mutateAsync(id);
      toast.success("Qualification removed");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <GraduationCap className="h-4 w-4" />
          Qualifications & Certificates
        </h2>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {qualifications.length === 0 && !adding && (
        <p className="text-sm text-gray-400 dark:text-gray-500">No qualifications recorded yet.</p>
      )}

      <div className="space-y-3">
        {qualifications.map((q) => (
          <div
            key={q.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{q.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                {q.institution && <span>{q.institution}</span>}
                {q.year_obtained && <span>{q.year_obtained}</span>}
                {q.cert_type && (
                  <span className="capitalize">{q.cert_type.replace("_", " ")}</span>
                )}
              </div>
              {q.notes && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{q.notes}</p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => handleRemove(q.id)}
                disabled={removing === q.id}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label="Remove qualification"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 space-y-3 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-4"
          noValidate
        >
          <Input
            id="title"
            label="Certificate / Qualification *"
            placeholder="B.Ed Mathematics"
            error={errors.title?.message}
            {...register("title")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input id="institution" label="Institution" placeholder="University of Ghana" {...register("institution")} />
            <Input id="year_obtained" label="Year" type="number" placeholder="2018" {...register("year_obtained")} />
          </div>
          <Select id="cert_type" label="Type" {...register("cert_type")}>
            <option value="">— Select type —</option>
            {CERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input id="notes" label="Notes" placeholder="Optional notes" {...register("notes")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setAdding(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>Save</Button>
          </div>
        </form>
      )}
    </div>
  );
}
