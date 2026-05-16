"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Settings, Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { uploadApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import {
  useSchoolProfile,
  useUpdateSchoolProfile,
} from "@/lib/hooks/useSchool";
import {
  useSchoolHouses, useCreateHouse, useUpdateHouse, useDeleteHouse,
  useSchoolProgrammes, useCreateProgramme, useUpdateProgramme, useDeleteProgramme,
  type SchoolHouse, type SchoolProgramme,
} from "@/lib/hooks/useAcademic";
import {
  useSchoolPeriods, useCreatePeriod, useUpdatePeriod, useDeletePeriod,
} from "@/lib/hooks/useAttendance";
import type { SchoolPeriod } from "@/lib/api";

// ── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:     z.string().min(1, "School name is required"),
  region:   z.string().optional(),
  district: z.string().optional(),
  address:  z.string().optional(),
  phone:    z.string().optional(),
  email:    z.string().email("Invalid email").optional().or(z.literal("")),
});
type ProfileValues = z.infer<typeof profileSchema>;

const programmeSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  short_name:  z.string().min(1, "Abbreviation is required").max(10, "Max 10 characters").toUpperCase(),
  description: z.string().optional(),
});
type ProgrammeValues = z.infer<typeof programmeSchema>;

const houseSchema = z.object({
  name:  z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour e.g. #3b82f6").optional().or(z.literal("")),
});
type HouseValues = z.infer<typeof houseSchema>;

const periodSchema = z.object({
  name:       z.string().min(1, "Name is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time:   z.string().min(1, "End time is required"),
  is_break:   z.boolean(),
}).refine((v) => v.end_time > v.start_time, {
  message: "End time must be after start time",
  path: ["end_time"],
});
type PeriodValues = z.infer<typeof periodSchema>;

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, school } = useAuthStore();
  const isAdmin = user?.role === "school_admin" || user?.role === "headteacher";
  const isSHS   = school?.school_type === "shs";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-gray-400" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">School-wide configuration</p>
        </div>
      </div>

      <SchoolProfileSection isAdmin={isAdmin} />
      {isSHS && <ProgrammesSection isAdmin={isAdmin} />}
      <HousesSection isAdmin={isAdmin} />
      <PeriodsSection isAdmin={isAdmin} />
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
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

// ── School Profile ─────────────────────────────────────────────────────────

function SchoolProfileSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: profile, isLoading } = useSchoolProfile();
  const update = useUpdateSchoolProfile();

  const [logo, setLogo]           = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [accentColor, setAccentColor] = useState("#059669");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } =
    useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (profile) {
      reset({
        name:     profile.name,
        region:   profile.region   ?? "",
        district: profile.district ?? "",
        address:  profile.address  ?? "",
        phone:    profile.phone    ?? "",
        email:    profile.email    ?? "",
      });
      setLogo(profile.logo_url ?? null);
      setAccentColor(profile.accent_color ?? "#059669");
    }
  }, [profile, reset]);

  async function handleLogoFile(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadApi.photo(file);
      setLogo(url);
    } catch {
      toast.error("Logo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: ProfileValues) {
    try {
      await update.mutateAsync({
        name:         values.name,
        region:       values.region   || undefined,
        district:     values.district || undefined,
        address:      values.address  || undefined,
        phone:        values.phone    || undefined,
        email:        values.email    || undefined,
        logo_url:     logo            ?? undefined,
        accent_color: accentColor,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <Section title="School Profile" subtitle="Basic information and branding for your school.">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Logo */}
          <div className="flex items-start gap-5">
            <AvatarUpload
              value={logo}
              initials={(profile?.name?.[0] ?? "S").toUpperCase()}
              onChange={setLogo}
              onFile={handleLogoFile}
              size="md"
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">School Logo</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Shown in the sidebar and on reports.</p>
              {uploading && <p className="text-xs text-[var(--brand)]">Uploading…</p>}
            </div>
          </div>

          <Input
            id="school_name"
            label="School Name *"
            placeholder="Achimota Senior High School"
            error={errors.name?.message}
            {...register("name")}
          />

          {/* Accent colour */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick theme colour"
                className="h-10 w-16 cursor-pointer rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
              <span
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                Preview
              </span>
              <span className="font-mono text-xs text-gray-400">{accentColor}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Used for buttons, links, and highlights throughout the system.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="region"   label="Region"   placeholder="Greater Accra" {...register("region")} />
            <Input id="district" label="District" placeholder="Accra Metro"   {...register("district")} />
          </div>

          <Textarea id="address" label="Address" placeholder="P.O. Box 123, Accra" {...register("address")} />

          <div className="grid grid-cols-2 gap-4">
            <Input id="phone" label="Phone" type="tel" placeholder="+233 30 000 0000" {...register("phone")} />
            <Input id="email" label="Email" type="email" placeholder="info@school.edu.gh" error={errors.email?.message} {...register("email")} />
          </div>

          {isAdmin && (
            <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button type="submit" loading={isSubmitting || update.isPending} disabled={uploading}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>
    </Section>
  );
}

// ── Programmes (SHS only) ──────────────────────────────────────────────────

function ProgrammesSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: programmes = [], isLoading } = useSchoolProgrammes(true);
  const createProgramme = useCreateProgramme();
  const updateProgramme = useUpdateProgramme();
  const deleteProgramme = useDeleteProgramme();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<SchoolProgramme | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolProgramme | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<ProgrammeValues>({ resolver: zodResolver(programmeSchema) });

  const shortPreview = (watch("short_name") || "").toUpperCase().trim();

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

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <Section title="Programmes" subtitle="Academic programmes offered by the school (SHS only).">
      <div className="flex justify-end">
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add Programme
          </Button>
        )}
      </div>

      {programmes.length === 0 ? (
        <EmptyCard
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
                  <button onClick={() => openEdit(p)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300" aria-label={`Edit ${p.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" aria-label={`Remove ${p.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? "Edit Programme" : "Add Programme"} width="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input id="prog_name" label="Name *" placeholder="e.g. General Science" error={errors.name?.message} {...register("name")} />
          <Input id="prog_short" label="Abbreviation *" placeholder="e.g. SC" error={errors.short_name?.message} {...register("short_name")} />
          <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">
            Shown in class names.{" "}
            {shortPreview
              ? <>Preview: <span className="font-mono text-gray-600 dark:text-gray-300">1{shortPreview} A</span></>
              : <>e.g. SC → 1SC A, ART → 2ART B</>
            }
          </p>
          <Textarea id="prog_desc" label="Description" placeholder="Optional description" error={errors.description?.message} {...register("description")} />
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editTarget ? "Save Changes" : "Add Programme"}</Button>
          </div>
        </form>
      </Drawer>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Programme?"
        description={<>Remove <strong>{deleteTarget?.name}</strong>? Students already assigned this programme keep the name; only future assignments are affected.</>}
        confirmLabel="Remove"
        loading={deleteProgramme.isPending}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </Section>
  );
}

// ── Houses ─────────────────────────────────────────────────────────────────

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

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <Section title="Houses" subtitle="School houses used to group students — e.g. boarding houses or inter-house sports groups.">
      <div className="flex justify-end">
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add House
          </Button>
        )}
      </div>

      {houses.length === 0 ? (
        <EmptyCard
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
                  <button onClick={() => openEdit(h)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300" aria-label={`Edit ${h.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(h)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" aria-label={`Remove ${h.name}`}>
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
          <Input id="house_name" label="Name *" placeholder="e.g. Unity House" error={errors.name?.message} {...register("name")} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick a colour"
                className="h-10 w-16 cursor-pointer rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
                value={colorValue || "#6b7280"}
                onChange={(e) => setValue("color", e.target.value, { shouldValidate: true })}
              />
              {colorValue ? (
                <button type="button" onClick={() => setValue("color", "", { shouldValidate: true })} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  Clear colour
                </button>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">Tap to choose</span>
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
    </Section>
  );
}

// ── School Periods ─────────────────────────────────────────────────────────

function PeriodsSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: periods = [], isLoading } = useSchoolPeriods();
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<SchoolPeriod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolPeriod | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PeriodValues>({ resolver: zodResolver(periodSchema) });

  function openAdd() {
    reset({ name: "", start_time: "", end_time: "", is_break: false });
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(p: SchoolPeriod) {
    reset({ name: p.name, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break });
    setEditTarget(p);
    setFormOpen(true);
  }

  async function onSubmit(values: PeriodValues) {
    try {
      if (editTarget) {
        await updatePeriod.mutateAsync({ id: editTarget.id, ...values });
        toast.success("Period updated");
      } else {
        await createPeriod.mutateAsync({ ...values, order: periods.length + 1 });
        toast.success(`"${values.name}" added`);
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  async function handleDelete(p: SchoolPeriod) {
    try {
      await deletePeriod.mutateAsync(p.id);
      toast.success(`"${p.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <Section
      title="School Periods"
      subtitle="Time slots used for per-lesson attendance. Add one period per lesson block and mark break times separately."
    >
      <div className="flex justify-end">
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />Add Period
          </Button>
        )}
      </div>

      {periods.length === 0 ? (
        <EmptyCard
          message="No periods configured. Add periods to enable per-lesson attendance tracking."
          action={isAdmin ? { label: "Add Period", onClick: openAdd } : undefined}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:divide-gray-800">
          {periods.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex flex-1 min-w-0 items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                  {p.start_time} – {p.end_time}
                </span>
                {p.is_break && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Break
                  </span>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300" aria-label={`Edit ${p.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" aria-label={`Remove ${p.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? "Edit Period" : "Add Period"} width="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="period_name"
            label="Name *"
            placeholder="e.g. Period 1, Assembly, Break"
            hint="Use a name teachers will recognise — e.g. 'Period 1' or 'Morning Break'."
            error={errors.name?.message}
            {...register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input id="start_time" label="Start Time *" type="time" error={errors.start_time?.message} {...register("start_time")} />
            <Input id="end_time"   label="End Time *"   type="time" error={errors.end_time?.message}   {...register("end_time")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded accent-[var(--brand)]" {...register("is_break")} />
            This is a break / non-teaching period
          </label>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editTarget ? "Save Changes" : "Add Period"}</Button>
          </div>
        </form>
      </Drawer>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Period?"
        description={<>Remove <strong>{deleteTarget?.name}</strong>? This will not affect existing attendance records.</>}
        confirmLabel="Remove"
        loading={deletePeriod.isPending}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </Section>
  );
}
