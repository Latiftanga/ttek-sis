"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, MapPin, Pencil, Trash2,
  ShieldCheck, ShieldOff, KeyRound, UserPlus, AlertCircle,
  User, Calendar, Home, Building2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useStudent, useDeleteStudent, usePortalActions,
  type Student, type StudentContact,
} from "@/lib/hooks/useStudents";
import { useAuthStore } from "@/lib/store";
import { formatDate, getInitials, getApiError, capitalize } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge, { statusBadge } from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import StudentForm from "@/components/students/StudentForm";
import AddContactDrawer from "@/components/students/AddContactDrawer";

function AvatarCircle({ student }: { student: Student }) {
  const initials = getInitials(student.first_name, student.last_name);
  if (student.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={student.photo_url}
        alt={`${student.first_name} ${student.last_name}`}
        className="h-16 w-16 shrink-0 rounded-2xl object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-xl font-bold text-[var(--brand)]">
      {initials}
    </div>
  );
}

function ContactCard({ contact }: { contact: StudentContact }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {contact.first_name[0]}{contact.last_name?.[0] ?? ""}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {contact.first_name} {contact.last_name}
            </p>
            <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
              {contact.relation}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {contact.is_primary_contact && (
            <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
              Primary
            </span>
          )}
          {!contact.is_alive && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700">
              Deceased
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.phone}</span>
            {contact.phone2 && (
              <span className="text-gray-400">&bull; {contact.phone2}</span>
            )}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.email}</span>
          </div>
        )}
        {contact.occupation && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.occupation}</span>
          </div>
        )}
        {contact.home_address && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.home_address}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {contact.can_pickup && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" /> Can pick up
          </span>
        )}
        {contact.receives_sms && (
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            SMS alerts
          </span>
        )}
        {contact.notes && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Note: {contact.notes}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
        <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 dark:text-white">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();

  const { data: student, isLoading, isError } = useStudent(id);
  const deleteStudent = useDeleteStudent();
  const { enable, disable, resetPin } = usePortalActions(id);

  const [editOpen, setEditOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canManage =
    user?.role === "school_admin" || user?.role === "headteacher";
  const canDelete = user?.role === "school_admin";
  const canPortal =
    user?.role === "school_admin" || user?.role === "headteacher";

  async function handleDelete() {
    try {
      await deleteStudent.mutateAsync(id);
      toast.success("Student deleted");
      router.replace("/students");
    } catch {
      toast.error("Could not delete student");
    }
  }

  async function handleEnablePortal() {
    try {
      const data = await enable.mutateAsync();
      toast.success(
        `Portal enabled. Default PIN: ${(data as { default_pin: string }).default_pin}`,
        { duration: 8000 }
      );
    } catch (err) {
      toast.error(getApiError(err, "Could not enable portal. Please try again."));
    }
  }

  async function handleDisablePortal() {
    try {
      await disable.mutateAsync();
      toast.success("Portal access disabled");
    } catch (err) {
      toast.error(getApiError(err, "Could not disable portal. Please try again."));
    }
  }

  async function handleResetPin() {
    try {
      const data = await resetPin.mutateAsync();
      toast.success(
        `PIN reset. New PIN: ${(data as { default_pin: string }).default_pin}`,
        { duration: 8000 }
      );
    } catch (err) {
      toast.error(getApiError(err, "Could not reset PIN. Please try again."));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">
          Student not found
        </p>
        <Link href="/students" className="mt-4">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </Button>
        </Link>
      </div>
    );
  }

  const primaryContact = student.contacts.find((c) => c.is_primary_contact);
  const age = student.date_of_birth
    ? Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="space-y-6">
      {/* back + actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/students"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>
        <div className="flex gap-2">
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* hero card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-4">
          <AvatarCircle student={student} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {student.first_name} {student.middle_name ? `${student.middle_name} ` : ""}
              {student.last_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
                #{student.student_number}
              </span>
              <span className="text-gray-300 dark:text-gray-600">&bull;</span>
              <Badge variant={statusBadge(student.status)}>
                {capitalize(student.status)}
              </Badge>
              {student.gender && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {capitalize(student.gender)}
                  </span>
                </>
              )}
            </div>
            {student.admission_date && (
              <p className="mt-1 text-xs text-gray-400">
                Admitted {formatDate(student.admission_date)}
              </p>
            )}
          </div>
          {primaryContact?.phone && (
            <a
              href={`tel:${primaryContact.phone}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <Phone className="h-4 w-4" />
              {primaryContact.phone}
            </a>
          )}
        </div>
      </div>

      {/* two columns: personal info + contacts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* personal info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Personal Information
          </h2>
          <div className="space-y-4">
            <InfoField
              icon={Calendar}
              label="Date of Birth"
              value={student.date_of_birth ? `${formatDate(student.date_of_birth)}${age && age > 0 ? ` (age ${age})` : ""}` : null}
            />
            <InfoField icon={User} label="Gender" value={student.gender ? capitalize(student.gender) : null} />
            <InfoField icon={Home} label="Home Address" value={student.home_address} />
            <InfoField icon={Building2} label="House" value={student.house} />
            <InfoField icon={Building2} label="Programme" value={student.programme} />
            {student.notes && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="text-sm text-gray-900 dark:text-white">{student.notes}</p>
                </div>
              </div>
            )}
            <InfoField
              icon={Calendar}
              label="Record Created"
              value={formatDate(student.created_at)}
            />
          </div>
        </div>

        {/* contacts */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Guardian Contacts
            </h2>
            {canManage && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAddContactOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add
              </Button>
            )}
          </div>

          {student.contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
              <Phone className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No contacts yet
              </p>
              {canManage && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setAddContactOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Add Contact
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {student.contacts.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* portal access */}
      {canPortal && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
            Student Portal Access
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Allow the student to log in with their ID and PIN to view results
            and announcements.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleEnablePortal}
              loading={enable.isPending}
            >
              <ShieldCheck className="h-4 w-4" />
              Enable Portal
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleResetPin}
              loading={resetPin.isPending}
            >
              <KeyRound className="h-4 w-4" />
              Reset PIN
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDisablePortal}
              loading={disable.isPending}
            >
              <ShieldOff className="h-4 w-4" />
              Disable Portal
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Default PIN is the student&rsquo;s date of birth (DDMMYYYY) or
            student number if DOB is not set. The student should change it on
            first login.
          </p>
        </div>
      )}

      {/* edit drawer */}
      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Student"
      >
        <StudentForm
          student={student}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Drawer>

      {/* add contact modal */}
      <AddContactDrawer
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        studentId={id}
      />

      {/* delete confirmation */}
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Student?"
        description={<>This will permanently delete <strong>{student.first_name} {student.last_name}</strong> and all their records. This cannot be undone.</>}
        confirmLabel="Delete"
        loading={deleteStudent.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
