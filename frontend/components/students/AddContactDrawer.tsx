"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Phone, ShieldCheck, MessageSquare, Heart, AlertTriangle } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { useAddContact } from "@/lib/hooks/useStudents";
import { getApiError, cn } from "@/lib/utils";

const phoneSchema = z
  .string()
  .optional()
  .refine(
    (v) => !v || /^[\+\d][\d\s\-]{6,14}$/.test(v.trim()),
    "Enter a valid phone number"
  );

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  relation: z.string().min(1, "Relation is required"),
  phone: phoneSchema,
  phone2: phoneSchema,
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  occupation: z.string().optional(),
  home_address: z.string().optional(),
  is_parent: z.boolean(),
  is_primary_contact: z.boolean(),
  can_pickup: z.boolean(),
  receives_sms: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const RELATIONS = [
  "Father", "Mother", "Grandfather", "Grandmother",
  "Uncle", "Aunt", "Brother", "Sister", "Guardian", "Other",
];

const PARENT_RELATIONS = new Set(["Father", "Mother", "Grandfather", "Grandmother"]);

const PERMISSIONS: {
  name: keyof Pick<FormValues, "is_parent" | "is_primary_contact" | "can_pickup" | "receives_sms">;
  label: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  {
    name: "is_parent",
    label: "Biological parent",
    description: "Direct biological parent",
    Icon: Heart,
  },
  {
    name: "is_primary_contact",
    label: "Primary contact",
    description: "First person to call",
    Icon: Phone,
  },
  {
    name: "can_pickup",
    label: "Can pick up",
    description: "Authorised to collect student",
    Icon: ShieldCheck,
  },
  {
    name: "receives_sms",
    label: "Receives SMS",
    description: "Gets school notifications",
    Icon: MessageSquare,
  },
];

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
}

export default function AddContactModal({ open, onClose, studentId }: AddContactModalProps) {
  const addContact = useAddContact(studentId);
  const [showPhone2, setShowPhone2] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_parent: true,
      is_primary_contact: false,
      can_pickup: true,
      receives_sms: true,
    },
  });

  const relation = watch("relation");
  const phone = watch("phone");
  const email = watch("email");
  const permissionValues = watch(["is_parent", "is_primary_contact", "can_pickup", "receives_sms"]);

  // Auto-set is_parent when relation changes
  useEffect(() => {
    if (relation) {
      setValue("is_parent", PARENT_RELATIONS.has(relation), { shouldDirty: true });
    }
  }, [relation, setValue]);

  function handleClose() {
    reset();
    setShowPhone2(false);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      relation: values.relation.toLowerCase(),
      last_name: values.last_name || undefined,
      phone: values.phone || undefined,
      phone2: values.phone2 || undefined,
      email: values.email || undefined,
      occupation: values.occupation || undefined,
      home_address: values.home_address || undefined,
      notes: values.notes || undefined,
      is_alive: true,
    };
    try {
      await addContact.mutateAsync(payload);
      toast.success("Contact added");
      handleClose();
    } catch (err) {
      toast.error(getApiError(err, "Couldn't add contact. Please try again."));
    }
  }

  const noContactMethod = !phone && !email;

  return (
    <Drawer open={open} onClose={handleClose} title="Add Guardian / Contact" width="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

        {/* Identity */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="c-first_name"
              label="First Name *"
              placeholder="Emmanuel"
              error={errors.first_name?.message}
              {...register("first_name")}
            />
            <Input
              id="c-last_name"
              label="Last Name"
              placeholder="Mensah"
              error={errors.last_name?.message}
              {...register("last_name")}
            />
          </div>

          <Select id="c-relation" label="Relation *" error={errors.relation?.message} {...register("relation")}>
            <option value="">— Select relation —</option>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Contact details */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Contact Details
          </p>

          <div className="space-y-3">
            <Input
              id="c-phone"
              label="Phone"
              type="tel"
              placeholder="0244 123 456"
              error={errors.phone?.message}
              {...register("phone")}
            />

            {showPhone2 ? (
              <Input
                id="c-phone2"
                label="Phone 2"
                type="tel"
                placeholder="0201 234 567"
                error={errors.phone2?.message}
                {...register("phone2")}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowPhone2(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add second number
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="c-email"
              label="Email"
              type="email"
              placeholder="name@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              id="c-occupation"
              label="Occupation"
              placeholder="Teacher"
              error={errors.occupation?.message}
              {...register("occupation")}
            />
          </div>

          {noContactMethod && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              A phone number or email is recommended for this contact.
            </div>
          )}

          <Textarea
            id="c-home_address"
            label="Home Address"
            placeholder="P.O. Box 123, Accra"
            rows={2}
            error={errors.home_address?.message}
            {...register("home_address")}
          />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Permissions */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Permissions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PERMISSIONS.map(({ name, label, description, Icon }, i) => {
              const checked = permissionValues[i];
              return (
                <label
                  key={name}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    checked
                      ? "border-[var(--brand)]/40 bg-[var(--brand)]/5 dark:bg-[var(--brand)]/10"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[var(--brand)]"
                    {...register(name)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", checked ? "text-[var(--brand)]" : "text-gray-400")} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <Textarea
          id="c-notes"
          label="Notes"
          placeholder="e.g. Call only after 5pm"
          rows={2}
          {...register("notes")}
        />

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Add Contact
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
