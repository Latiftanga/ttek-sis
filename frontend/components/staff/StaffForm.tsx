"use client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { useCreateStaff, useUpdateStaff, type Staff } from "@/lib/hooks/useStaff";
import { uploadApi } from "@/lib/api";
import { getInitials, getApiError } from "@/lib/utils";

const schema = z.object({
  staff_number:   z.string().optional(),
  title:          z.string().optional(),
  first_name:     z.string().min(1, "First name is required"),
  middle_name:    z.string().optional(),
  last_name:      z.string().min(1, "Last name is required"),
  gender:         z.enum(["male", "female", ""]).optional(),
  date_of_birth:  z.string().optional(),
  phone:          z.string().optional(),
  license_number: z.string().optional(),
  specialization: z.string().optional(),
  date_joined:    z.string().optional(),
  status:         z.enum(["active", "on_leave", "transferred", "retired"]).optional(),
  // account fields (create-only, optional)
  email:          z.string().email("Invalid email").optional().or(z.literal("")),
  password:       z.string().optional(),
  role:           z.enum(["school_admin", "headteacher", "teacher", "accountant"]).optional(),
});

type FormValues = z.infer<typeof schema>;

interface StaffFormProps {
  staff?: Staff;
  onSuccess: () => void;
  onCancel: () => void;
}

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof", "Rev"];
const ROLES  = [
  { value: "teacher",     label: "Teacher" },
  { value: "headteacher", label: "Head Teacher" },
  { value: "school_admin",label: "School Admin" },
  { value: "accountant",  label: "Accountant" },
];

export default function StaffForm({ staff, onSuccess, onCancel }: StaffFormProps) {
  const isEdit = !!staff;
  const create = useCreateStaff();
  const update = useUpdateStaff(staff?.id ?? "");

  const [photo, setPhoto] = useState<string | null>(staff?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handlePhotoFile(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadApi.photo(file);
      setPhoto(url);
    } catch {
      toast.error("Photo upload failed — photo will not be saved");
    } finally {
      setUploading(false);
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      staff_number:   staff?.staff_number ?? "",
      title:          staff?.title ?? "",
      first_name:     staff?.first_name ?? "",
      middle_name:    staff?.middle_name ?? "",
      last_name:      staff?.last_name ?? "",
      gender:         (staff?.gender as FormValues["gender"]) ?? "",
      date_of_birth:  staff?.date_of_birth ?? "",
      phone:          staff?.phone ?? "",
      license_number: staff?.license_number ?? "",
      specialization: staff?.specialization ?? "",
      date_joined:    staff?.date_joined ?? "",
      status:         (staff?.status ?? "active") as FormValues["status"],
      role:           "teacher",
    },
  });

  const firstName = watch("first_name");
  const lastName  = watch("last_name");
  const initials  = useMemo(
    () => (firstName && lastName ? getInitials(firstName, lastName) : "?"),
    [firstName, lastName]
  );

  async function onSubmit(values: FormValues) {
    const clean = {
      staff_number:   values.staff_number   || undefined,
      title:          values.title           || undefined,
      first_name:     values.first_name,
      middle_name:    values.middle_name     || undefined,
      last_name:      values.last_name,
      gender:         values.gender          || undefined,
      date_of_birth:  values.date_of_birth   || undefined,
      phone:          values.phone           || undefined,
      photo_url:      photo                  ?? undefined,
      license_number: values.license_number  || undefined,
      specialization: values.specialization  || undefined,
      date_joined:    values.date_joined     || undefined,
      status:         values.status          || "active",
    };

    try {
      if (isEdit) {
        await update.mutateAsync(clean);
        toast.success("Staff member updated");
        onSuccess();
      } else {
        const payload: Record<string, unknown> = { ...clean };
        if (showAccount && values.email) {
          payload.email    = values.email;
          payload.role     = values.role ?? "teacher";
          if (values.password) payload.password = values.password;
        }
        const result = await create.mutateAsync(payload);
        toast.success("Staff member added");
        if (result.temp_password) {
          setGeneratedPassword(result.temp_password);
        } else {
          onSuccess();
        }
      }
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-5" noValidate>
      <AvatarUpload
        value={photo}
        initials={initials}
        onChange={setPhoto}
        onFile={handlePhotoFile}
        size="md"
      />
      {uploading && (
        <p className="text-xs text-[var(--brand)]">Uploading photo…</p>
      )}

      {/* Identity row */}
      <div className="grid grid-cols-2 gap-4">
        <Select id="title" label="Title" {...register("title")}>
          <option value="">— None —</option>
          {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select id="gender" label="Gender" error={errors.gender?.message} {...register("gender")}>
          <option value="">— Select —</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="first_name"  label="First Name *"  placeholder="Kwame"  error={errors.first_name?.message}  {...register("first_name")} />
        <Input id="middle_name" label="Middle Name"   placeholder="Asante" error={errors.middle_name?.message} {...register("middle_name")} />
      </div>
      <Input id="last_name" label="Last Name *" placeholder="Mensah" error={errors.last_name?.message} {...register("last_name")} />

      {/* Employment */}
      <div className="grid grid-cols-2 gap-4">
        <Input id="staff_number" label="Staff Number" placeholder="TCH001" {...register("staff_number")} />
        <Input id="phone" label="Phone" type="tel" placeholder="+233 24 000 0000" {...register("phone")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="date_of_birth" label="Date of Birth" type="date" {...register("date_of_birth")} />
        <Input id="date_joined"   label="Date Joined"   type="date" {...register("date_joined")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="license_number" label="Licence Number" placeholder="TCH-00000" {...register("license_number")} />
        <Input id="specialization" label="Specialization" placeholder="Mathematics, Physics" {...register("specialization")} />
      </div>

      {isEdit && (
        <Select id="status" label="Status" {...register("status")}>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="transferred">Transferred</option>
          <option value="retired">Retired</option>
        </Select>
      )}

      {/* Optional login account (create-only) */}
      {!isEdit && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowAccount((p) => !p)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <input
              type="checkbox"
              checked={showAccount}
              onChange={(e) => setShowAccount(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded accent-[var(--brand)]"
            />
            Create a login account for this staff member
          </button>

          {showAccount && (
            <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
              <Input
                id="email"
                label="Email *"
                type="email"
                placeholder="kwame.mensah@school.edu.gh"
                error={errors.email?.message}
                {...register("email")}
              />
              <Select id="role" label="Role" {...register("role")}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="Leave blank to auto-generate"
                {...register("password")}
              />
              <p className="text-xs text-gray-400">
                If you leave the password blank, one will be generated and shown after saving.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting} disabled={uploading}>
          {isEdit ? "Save Changes" : "Add Staff"}
        </Button>
      </div>

      {/* Generated password overlay */}
      {generatedPassword && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/95 p-6 dark:bg-gray-900/95">
          <div className="w-full max-w-sm space-y-4 text-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Login account created</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Save this temporary password — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3">
              <span className="flex-1 select-all font-mono text-sm font-medium tracking-wider text-gray-900 dark:text-white">
                {generatedPassword}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 rounded p-1 text-gray-400 hover:text-[var(--brand)]"
                aria-label="Copy password"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={() => { setGeneratedPassword(null); onSuccess(); }}>Done</Button>
          </div>
        </div>
      )}
    </form>
  );
}
