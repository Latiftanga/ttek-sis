"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, Calendar, Pencil,
  KeyRound, UserCheck, ShieldCheck, ShieldOff, Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useStaffMember, useToggleStaffAccount, type Staff,
} from "@/lib/hooks/useStaff";
import { useAuthStore } from "@/lib/store";
import { formatDate, getInitials, getApiError } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import StaffForm from "@/components/staff/StaffForm";
import InviteModal from "@/components/staff/InviteModal";
import QualificationsCard from "@/components/staff/QualificationsCard";
import PromotionsCard from "@/components/staff/PromotionsCard";

const STATUS_COLORS: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  on_leave:    "bg-amber-100  text-amber-700  dark:bg-amber-900/50  dark:text-amber-300",
  transferred: "bg-blue-100   text-blue-700   dark:bg-blue-900/50   dark:text-blue-300",
  retired:     "bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_leave: "On Leave", transferred: "Transferred", retired: "Retired",
};

function AvatarCircle({ member }: { member: Staff }) {
  const initials = getInitials(member.first_name, member.last_name);
  if (member.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.photo_url}
        alt={`${member.first_name} ${member.last_name}`}
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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const { data: member, isLoading } = useStaffMember(id);
  const toggleAccount = useToggleStaffAccount(id);

  const [editOpen,   setEditOpen]   = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin  = currentUser?.role === "school_admin" || currentUser?.role === "headteacher";
  // A teacher can edit their own record; admins can edit anyone
  const canEdit  = isAdmin || (!!currentUser && member?.user?.id === currentUser?.id);

  async function handleToggleAccount() {
    try {
      await toggleAccount.mutateAsync();
      toast.success(member?.user?.is_active ? "Login account disabled" : "Login account enabled");
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Staff member not found.</p>
        <Link href="/staff">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Staff</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />Back
          </button>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />Edit
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">

        {/* Profile card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-start gap-4">
            <AvatarCircle member={member} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {member.title && <span className="mr-1">{member.title}</span>}
                {member.first_name}
                {member.middle_name && ` ${member.middle_name}`}
                {` ${member.last_name}`}
              </h1>
              {member.current_rank && (
                <p className="mt-0.5 text-sm font-medium text-[var(--brand)]">{member.current_rank}</p>
              )}
              {member.specialization && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{member.specialization}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status] ?? ""}`}>
                  {STATUS_LABELS[member.status] ?? member.status}
                </span>
                {member.staff_number && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">#{member.staff_number}</span>
                )}
                {member.user && (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    member.user.is_active
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                  }`}>
                    {member.user.role.replace(/_/g, " ")}
                    {!member.user.is_active && " (disabled)"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {member.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" /><span>{member.phone}</span>
              </div>
            )}
            {member.user?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" /><span>{member.user.email}</span>
              </div>
            )}
            {member.date_joined && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Joined {formatDate(member.date_joined)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Employment details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Briefcase className="h-4 w-4" />Employment Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoRow label="Gender"        value={member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : null} />
            <InfoRow label="Date of Birth" value={member.date_of_birth ? formatDate(member.date_of_birth) : null} />
            <InfoRow label="Date Joined"   value={member.date_joined ? formatDate(member.date_joined) : null} />
            <InfoRow label="Licence No."   value={member.license_number} />
            <InfoRow label="Specialization" value={member.specialization} />
          </dl>
        </div>

        {/* Qualifications */}
        <QualificationsCard
          staffId={member.id}
          qualifications={member.qualifications ?? []}
          canEdit={canEdit}
        />

        {/* Promotions */}
        <PromotionsCard
          staffId={member.id}
          promotions={member.promotions ?? []}
          currentRank={member.current_rank}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />

        {/* Login account — admin only */}
        {isAdmin && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <ShieldCheck className="h-4 w-4" />Login Account
            </h2>
            {member.user ? (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Account: <strong className="text-gray-900 dark:text-white">{member.user.email}</strong>
                  {member.user.last_login && (
                    <span className="ml-2 text-gray-400">· Last login {formatDate(member.user.last_login)}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
                    <KeyRound className="h-4 w-4" />Reset Password
                  </Button>
                  <Button size="sm" variant="secondary" loading={toggleAccount.isPending} onClick={handleToggleAccount}>
                    {member.user.is_active
                      ? <><ShieldOff className="h-4 w-4" />Disable Login</>
                      : <><ShieldCheck className="h-4 w-4" />Enable Login</>}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  No login account — create one to allow this staff member to access the system.
                </p>
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserCheck className="h-4 w-4" />Create Login Account
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit drawer */}
      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title="Edit Staff Member" width="lg">
        <StaffForm
          staff={member}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Drawer>

      {inviteOpen && (
        <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} staff={member} />
      )}
    </div>
  );
}
