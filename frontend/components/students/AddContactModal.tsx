"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { useAddContact } from "@/lib/hooks/useStudents";
import { getApiError } from "@/lib/utils";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  relation: z.string().min(1, "Relation is required"),
  phone: z.string().optional(),
  phone2: z.string().optional(),
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

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
}

export default function AddContactModal({
  open,
  onClose,
  studentId,
}: AddContactModalProps) {
  const addContact = useAddContact(studentId);

  const {
    register,
    handleSubmit,
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

  function handleClose() {
    reset();
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
      toast.error(getApiError(err) || "Failed to add contact");
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Guardian / Contact" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        <Select
          id="c-relation"
          label="Relation *"
          error={errors.relation?.message}
          {...register("relation")}
        >
          <option value="">— Select —</option>
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="c-phone"
            label="Phone"
            type="tel"
            placeholder="0244123456"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Input
            id="c-phone2"
            label="Phone 2"
            type="tel"
            placeholder="0201234567"
            error={errors.phone2?.message}
            {...register("phone2")}
          />
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

        <Textarea
          id="c-home_address"
          label="Home Address"
          placeholder="P.O. Box 123, Accra"
          rows={2}
          error={errors.home_address?.message}
          {...register("home_address")}
        />

        <fieldset className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <legend className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            Permissions
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { name: "is_parent", label: "Biological parent" },
                { name: "is_primary_contact", label: "Primary contact" },
                { name: "can_pickup", label: "Authorised to pick up" },
                { name: "receives_sms", label: "Receives SMS alerts" },
              ] as const
            ).map(({ name, label }) => (
              <label key={name} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)]"
                  {...register(name)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
    </Modal>
  );
}
