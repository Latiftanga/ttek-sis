"use client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { useCreateStudent, useUpdateStudent, type Student } from "@/lib/hooks/useStudents";
import { useClasses, useAcademicYears } from "@/lib/hooks/useAcademic";
import { academicApi } from "@/lib/api";
import { getInitials, getApiError } from "@/lib/utils";

const schema = z.object({
  student_number: z.string().min(1, "Student number is required"),
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female", ""]).optional(),
  date_of_birth: z.string().optional(),
  admission_date: z.string().optional(),
  house: z.string().optional(),
  programme: z.string().optional(),
  home_address: z.string().optional(),
  notes: z.string().optional(),
  // enrollment fields (create-only)
  enroll: z.boolean().optional(),
  class_id: z.string().optional(),
  academic_year_id: z.string().optional(),
  start_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface StudentFormProps {
  student?: Student;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StudentForm({ student, onSuccess, onCancel }: StudentFormProps) {
  const isEdit = !!student;
  const create = useCreateStudent();
  const update = useUpdateStudent(student?.id ?? "");

  const { data: classes = [] } = useClasses();
  const { data: years = [] } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current) ?? years[0];

  const [photo, setPhoto] = useState<string | null>(student?.photo_url ?? null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      student_number: student?.student_number ?? "",
      first_name: student?.first_name ?? "",
      middle_name: student?.middle_name ?? "",
      last_name: student?.last_name ?? "",
      gender: (student?.gender as FormValues["gender"]) ?? "",
      date_of_birth: student?.date_of_birth ?? "",
      admission_date: student?.admission_date ?? "",
      house: student?.house ?? "",
      programme: student?.programme ?? "",
      home_address: student?.home_address ?? "",
      notes: student?.notes ?? "",
      enroll: false,
      academic_year_id: currentYear?.id ?? "",
      start_date: new Date().toISOString().slice(0, 10),
    },
  });

  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const wantsEnroll = watch("enroll");

  const initials = useMemo(
    () => (firstName && lastName ? getInitials(firstName, lastName) : "?"),
    [firstName, lastName]
  );

  async function onSubmit(values: FormValues) {
    const clean = {
      student_number: values.student_number,
      first_name: values.first_name,
      last_name: values.last_name,
      photo_url: photo ?? undefined,
      gender: values.gender || undefined,
      middle_name: values.middle_name || undefined,
      date_of_birth: values.date_of_birth || undefined,
      admission_date: values.admission_date || undefined,
      house: values.house || undefined,
      programme: values.programme || undefined,
      home_address: values.home_address || undefined,
      notes: values.notes || undefined,
    };

    try {
      if (isEdit) {
        const { student_number: _sn, ...updatePayload } = clean;
        void _sn;
        await update.mutateAsync(updatePayload);
        toast.success("Student updated");
      } else {
        const newStudent = await create.mutateAsync(clean);
        if (values.enroll && values.class_id && values.academic_year_id && values.start_date) {
          try {
            await academicApi.enroll({
              student_id: (newStudent as Student).id,
              class_id: values.class_id,
              academic_year_id: values.academic_year_id,
              start_date: values.start_date,
              status: "active",
            });
          } catch {
            toast.error("Student added, but enrollment failed — try again from student profile");
            onSuccess();
            return;
          }
        }
        toast.success("Student added");
        reset();
        setPhoto(null);
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <AvatarUpload value={photo} initials={initials} onChange={setPhoto} size="md" />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <Input
            id="student_number"
            label="Student Number *"
            placeholder="e.g. SHS001"
            disabled={isEdit}
            error={errors.student_number?.message}
            {...register("student_number")}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Select id="gender" label="Gender" error={errors.gender?.message} {...register("gender")}>
            <option value="">— Select —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="first_name" label="First Name *" placeholder="Kofi" error={errors.first_name?.message} {...register("first_name")} />
        <Input id="middle_name" label="Middle Name" placeholder="Adu" error={errors.middle_name?.message} {...register("middle_name")} />
      </div>

      <Input id="last_name" label="Last Name *" placeholder="Mensah" error={errors.last_name?.message} {...register("last_name")} />

      <div className="grid grid-cols-2 gap-4">
        <Input id="date_of_birth" label="Date of Birth" type="date" error={errors.date_of_birth?.message} {...register("date_of_birth")} />
        <Input id="admission_date" label="Admission Date" type="date" error={errors.admission_date?.message} {...register("admission_date")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="house" label="House" placeholder="e.g. Unity" error={errors.house?.message} {...register("house")} />
        <Input id="programme" label="Programme" placeholder="e.g. General Science" error={errors.programme?.message} {...register("programme")} />
      </div>

      <Textarea id="home_address" label="Home Address" placeholder="P.O. Box 123, Accra" error={errors.home_address?.message} {...register("home_address")} />

      <Textarea id="notes" label="Notes" placeholder="e.g. Scholarship student, transferred from Accra Academy" error={errors.notes?.message} {...register("notes")} />

      {/* class enrollment (create only) */}
      {!isEdit && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setEnrollOpen((p) => !p)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enroll"
                className="h-4 w-4 rounded accent-[var(--brand)]"
                onClick={(e) => e.stopPropagation()}
                {...register("enroll")}
              />
              <label htmlFor="enroll" className="cursor-pointer">
                Enroll in a class
              </label>
            </span>
            {enrollOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {(wantsEnroll || enrollOpen) && (
            <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
              <Select
                id="academic_year_id"
                label="Academic Year"
                error={errors.academic_year_id?.message}
                {...register("academic_year_id")}
              >
                <option value="">— Select year —</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.is_current ? "(current)" : ""}
                  </option>
                ))}
              </Select>

              <Select
                id="class_id"
                label="Class"
                error={errors.class_id?.message}
                {...register("class_id")}
              >
                <option value="">— Select class —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              <Input
                id="start_date"
                label="Start Date"
                type="date"
                error={errors.start_date?.message}
                {...register("start_date")}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? "Save Changes" : "Add Student"}
        </Button>
      </div>
    </form>
  );
}
