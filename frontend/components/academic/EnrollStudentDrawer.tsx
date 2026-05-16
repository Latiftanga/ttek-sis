"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useAcademicYears, useEnrollStudent } from "@/lib/hooks/useAcademic";
import { useStudents, type Student } from "@/lib/hooks/useStudents";
import { getApiError } from "@/lib/utils";

const schema = z.object({
  academic_year_id: z.string().min(1, "Select an academic year"),
  start_date:       z.string().min(1, "Required"),
  is_boarding:      z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open:    boolean;
  classId: string;
  onClose: () => void;
}

export default function EnrollStudentDrawer({ open, classId, onClose }: Props) {
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected]               = useState<Student | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: students = [] } = useStudents({
    search: debouncedSearch || undefined,
    status: "active",
    limit:  10,
  });
  const { data: years = [] } = useAcademicYears();
  const enroll = useEnrollStudent();

  const currentYear = years.find((y) => y.is_current);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { academic_year_id: "", start_date: "", is_boarding: false },
    });

  useEffect(() => {
    if (currentYear) setValue("academic_year_id", currentYear.id);
  }, [currentYear?.id, setValue]);

  function handleClose() {
    setSearch("");
    setDebouncedSearch("");
    setSelected(null);
    reset({ academic_year_id: currentYear?.id ?? "", start_date: "", is_boarding: false });
    onClose();
  }

  async function onSubmit(values: FormValues) {
    if (!selected) return;
    try {
      await enroll.mutateAsync({
        student_id:       selected.id,
        class_id:         classId,
        academic_year_id: values.academic_year_id,
        start_date:       values.start_date,
        is_boarding:      values.is_boarding,
      });
      toast.success(`${selected.first_name} ${selected.last_name} enrolled`);
      handleClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Enroll Student" width="md">
      {!selected ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or student number…"
              autoFocus
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {debouncedSearch && students.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No active students found</p>
          ) : students.length > 0 ? (
            <div className="max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)]">
                    {s.first_name[0]}{s.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ""} {s.last_name}
                    </p>
                    <p className="text-xs text-gray-400">#{s.student_number}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">Type to search students</p>
          )}

          <div className="flex justify-end pt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Selected student chip */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)]">
              {selected.first_name[0]}{selected.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {selected.first_name}{selected.middle_name ? ` ${selected.middle_name}` : ""} {selected.last_name}
              </p>
              <p className="text-xs text-gray-400">#{selected.student_number}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs text-[var(--brand)] hover:underline"
            >
              Change
            </button>
          </div>

          <Select
            id="enroll_year"
            label="Academic Year *"
            error={errors.academic_year_id?.message}
            {...register("academic_year_id")}
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
            ))}
          </Select>

          <Input
            id="enroll_start"
            label="Start Date *"
            type="date"
            error={errors.start_date?.message}
            {...register("start_date")}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enroll_boarding"
              className="h-4 w-4 rounded accent-[var(--brand)]"
              {...register("is_boarding")}
            />
            <label htmlFor="enroll_boarding" className="text-sm text-gray-700 dark:text-gray-300">
              Boarding student
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Enroll Student</Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
