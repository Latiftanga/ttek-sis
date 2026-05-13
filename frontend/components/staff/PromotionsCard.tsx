"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Trash2, TrendingUp, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  useAddPromotion, useRemovePromotion, useGESRanks,
  type StaffPromotion,
} from "@/lib/hooks/useStaff";
import { formatDate, getApiError } from "@/lib/utils";

const schema = z.object({
  from_rank:      z.string().optional(),
  to_rank:        z.string().min(1, "New rank is required"),
  effective_date: z.string().min(1, "Effective date is required"),
  promotion_type: z.enum(["substantive", "acting"]),
  reference_no:   z.string().optional(),
  notes:          z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  staffId:      string;
  promotions:   StaffPromotion[];
  currentRank?: string | null;
  canEdit:      boolean;
  isAdmin:      boolean;   // only admins can delete promotion records
}

export default function PromotionsCard({ staffId, promotions, currentRank, canEdit, isAdmin }: Props) {
  const addPromo    = useAddPromotion(staffId);
  const removePromo = useRemovePromotion(staffId);
  const { data: gesRanks = [] } = useGESRanks();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from_rank:      currentRank ?? "",
      promotion_type: "substantive",
      effective_date: new Date().toISOString().slice(0, 10),
    },
  });

  const formatCategory = (cat: string) =>
    cat.charAt(0).toUpperCase() + cat.slice(1);

  // Group ranks by category for grouped <select>
  const ranksByCategory = gesRanks.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r.name);
    return acc;
  }, {});

  const rankGroups = Object.entries(ranksByCategory).map(([cat, names]) => (
    <optgroup key={cat} label={formatCategory(cat)}>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}
    </optgroup>
  ));

  async function onSubmit(values: FormValues) {
    try {
      await addPromo.mutateAsync({
        from_rank:      values.from_rank      || undefined,
        to_rank:        values.to_rank,
        effective_date: values.effective_date,
        promotion_type: values.promotion_type,
        reference_no:   values.reference_no   || undefined,
        notes:          values.notes          || undefined,
      });
      toast.success("Promotion recorded");
      reset();
      setAdding(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await removePromo.mutateAsync(id);
      toast.success("Promotion record removed");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <TrendingUp className="h-4 w-4" />
            Promotion History
          </h2>
          {currentRank && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Current rank: <span className="font-medium text-gray-800 dark:text-gray-200">{currentRank}</span>
            </p>
          )}
        </div>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Record promotion
          </button>
        )}
      </div>

      {promotions.length === 0 && !adding && (
        <p className="text-sm text-gray-400 dark:text-gray-500">No promotions recorded yet.</p>
      )}

      <div className="space-y-2">
        {promotions.map((p, idx) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                {p.from_rank && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">{p.from_rank}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </>
                )}
                <span className={`font-medium ${idx === 0 ? "text-[var(--brand)]" : "text-gray-800 dark:text-gray-200"}`}>
                  {p.to_rank}
                </span>
                {idx === 0 && (
                  <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(p.effective_date)}</span>
                <span className="capitalize">{p.promotion_type}</span>
                {p.reference_no && <span>Ref: {p.reference_no}</span>}
              </div>
              {p.notes && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{p.notes}</p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => handleRemove(p.id)}
                disabled={removing === p.id}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label="Remove promotion"
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
          <div className="grid grid-cols-2 gap-3">
            {/* From rank */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Previous Rank
              </label>
              <select
                {...register("from_rank")}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <option value="">— None / First entry —</option>
                {rankGroups}
              </select>
            </div>

            {/* To rank */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Promoted To *
              </label>
              <select
                {...register("to_rank")}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <option value="">— Select rank —</option>
                {rankGroups}
              </select>
              {errors.to_rank && (
                <p className="mt-1 text-xs text-red-500">{errors.to_rank.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="effective_date"
              label="Effective Date *"
              type="date"
              error={errors.effective_date?.message}
              {...register("effective_date")}
            />
            <Select id="promotion_type" label="Type" {...register("promotion_type")}>
              <option value="substantive">Substantive</option>
              <option value="acting">Acting</option>
            </Select>
          </div>

          <Input
            id="reference_no"
            label="Reference No."
            placeholder="GES/RD/XXX/2024"
            {...register("reference_no")}
          />
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
