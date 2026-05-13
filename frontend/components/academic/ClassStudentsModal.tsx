"use client";
import { Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useClassStudents, type Class } from "@/lib/hooks/useAcademic";
import { capitalize } from "@/lib/utils";

interface ClassStudentsModalProps {
  class_: Class | null;
  onClose: () => void;
}

export default function ClassStudentsModal({ class_, onClose }: ClassStudentsModalProps) {
  const { data: students = [], isLoading } = useClassStudents(class_?.id ?? null);

  return (
    <Modal
      open={!!class_}
      onClose={onClose}
      title={class_ ? `${class_.name} — Students` : "Students"}
      size="md"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No students enrolled in this class for the current academic year.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {students.length} student{students.length !== 1 ? "s" : ""} · current academic year
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {students.map((s, idx) => (
              <div key={s.enrollment_id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-right text-xs text-gray-400">{idx + 1}</span>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-semibold text-[var(--brand)]">
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {s.first_name}
                    {s.middle_name ? ` ${s.middle_name}` : ""}
                    {` ${s.last_name}`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    #{s.student_number}
                    {s.gender ? ` · ${capitalize(s.gender)}` : ""}
                  </p>
                </div>
                {s.is_boarding && (
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    Boarding
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
