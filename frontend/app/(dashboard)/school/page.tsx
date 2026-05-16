"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import { useAuthStore } from "@/lib/store";
import { getApiError } from "@/lib/utils";
import {
  useSchoolHouses,
  useCreateHouse, useUpdateHouse, useDeleteHouse,
  type SchoolHouse,
} from "@/lib/hooks/useAcademic";

const houseSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour e.g. #3b82f6").optional().or(z.literal("")),
});
type HouseValues = z.infer<typeof houseSchema>;

export default function SchoolPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "school_admin" || user?.role === "headteacher";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-gray-400" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">School</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">School-wide settings and configuration</p>
        </div>
      </div>

      <HousesSection isAdmin={isAdmin} />
    </div>
  );
}

function HousesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: houses = [], isLoading } = useSchoolHouses();
  const createHouse = useCreateHouse();
  const updateHouse = useUpdateHouse();
  const deleteHouse = useDeleteHouse();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<SchoolHouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolHouse | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            School houses used to group students — e.g. boarding houses or inter-house sports groups.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add House
          </Button>
        )}
      </div>

      {houses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No houses configured yet. Leave empty to let the house field accept free text.
          </p>
          {isAdmin && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={openAdd}>
              <Plus className="h-4 w-4" />Add House
            </Button>
          )}
        </div>
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

      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? "Edit House" : "Add House"} width="md">
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
              Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick a colour"
                className="h-10 w-16 cursor-pointer rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
                value={colorValue || "#6b7280"}
                onChange={(e) => setValue("color", e.target.value, { shouldValidate: true })}
              />
              {colorValue ? (
                <button
                  type="button"
                  onClick={() => setValue("color", "", { shouldValidate: true })}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear colour
                </button>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  Tap to choose
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editTarget ? "Save Changes" : "Add House"}</Button>
          </div>
        </form>
      </Drawer>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove House?"
        description={<>Remove <strong>{deleteTarget?.name}</strong>? Students already assigned this house keep the name; only future assignments are affected.</>}
        confirmLabel="Remove"
        loading={deleteHouse.isPending}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}
