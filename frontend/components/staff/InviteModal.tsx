"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useInviteStaff, type Staff } from "@/lib/hooks/useStaff";
import { getApiError } from "@/lib/utils";

const schema = z.object({
  email:    z.string().email("Invalid email"),
  role:     z.enum(["school_admin", "headteacher", "teacher", "accountant"]),
  password: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const ROLES = [
  { value: "teacher",      label: "Teacher" },
  { value: "headteacher",  label: "Head Teacher" },
  { value: "school_admin", label: "School Admin" },
  { value: "accountant",   label: "Accountant" },
];

interface Props {
  open:    boolean;
  onClose: () => void;
  staff:   Staff;
}

export default function InviteModal({ open, onClose, staff }: Props) {
  const invite = useInviteStaff(staff.id);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: staff.user?.email ?? "",
      role:  (staff.user?.role as FormValues["role"]) ?? "teacher",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const result = await invite.mutateAsync(values);
      if (result.temp_password) {
        setTempPassword(result.temp_password);
      } else {
        toast.success("Login account updated");
        onClose();
      }
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  function handleCopy() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleClose() {
    setTempPassword(null);
    onClose();
  }

  const title = staff.user ? "Reset Login Credentials" : "Create Login Account";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      {tempPassword ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/40">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Account created successfully!
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Share this temporary password with{" "}
              <strong>{staff.first_name} {staff.last_name}</strong>. It won&rsquo;t be shown again.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Temporary Password
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-base font-semibold text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white">
                {tempPassword}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                aria-label="Copy password"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {staff.user
              ? `Update login credentials for ${staff.first_name} ${staff.last_name}.`
              : `Create a portal login for ${staff.first_name} ${staff.last_name}.`}
          </p>

          <Input
            id="email"
            label="Email *"
            type="email"
            placeholder="staff@school.edu.gh"
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
            Leave blank to auto-generate a secure password that you can share with the staff member.
          </p>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {staff.user ? "Update Credentials" : "Create Account"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
