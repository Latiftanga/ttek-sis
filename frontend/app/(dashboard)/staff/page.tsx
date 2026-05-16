"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, UserPlus, Users, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2, Phone, Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import { useStaff, useDeleteStaff, type Staff } from "@/lib/hooks/useStaff";
import { formatDate, getInitials, getApiError } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import ActionMenu from "@/components/ui/ActionMenu";
import StaffForm from "@/components/staff/StaffForm";
import StaffBulkUploadDrawer from "@/components/staff/BulkUploadDrawer";

const STATUS_TABS = [
  { key: "",            label: "All" },
  { key: "active",      label: "Active" },
  { key: "on_leave",    label: "On Leave" },
  { key: "transferred", label: "Transferred" },
  { key: "retired",     label: "Retired" },
];

const ROLE_FILTERS = [
  { key: "",             label: "All Roles" },
  { key: "teacher",      label: "Teacher" },
  { key: "headteacher",  label: "Head Teacher" },
  { key: "school_admin", label: "Admin" },
  { key: "accountant",   label: "Accountant" },
];

const PAGE_SIZE = 30;

const STATUS_COLORS: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  on_leave:    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  transferred: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  retired:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_leave: "On Leave", transferred: "Transferred", retired: "Retired",
};

function StaffAvatar({ member }: { member: Staff }) {
  const initials = getInitials(member.first_name, member.last_name);
  const colors = [
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  ];
  const color = colors[(member.first_name.charCodeAt(0) ?? 0) % colors.length];
  if (member.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.photo_url} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}>
      {initials}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
        </td>
      ))}
    </tr>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab]         = useState("");
  const [roleFilter, setRoleFilter]       = useState("");
  const [page, setPage]                   = useState(0);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [editMember, setEditMember]       = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<Staff | null>(null);
  const [bulkOpen, setBulkOpen]           = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useStaff({
    search: debouncedSearch || undefined,
    status: statusTab || undefined,
    role:   roleFilter || undefined,
    skip:   page * PAGE_SIZE,
    limit:  PAGE_SIZE + 1,
  });

  const deleteStaff = useDeleteStaff();
  const members  = data?.slice(0, PAGE_SIZE) ?? [];
  const hasNext  = (data?.length ?? 0) > PAGE_SIZE;
  const hasPrev  = page > 0;

  const openAdd  = useCallback(() => { setEditMember(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((m: Staff) => { setEditMember(m); setDrawerOpen(true); }, []);

  async function handleDeactivate() {
    if (!deleteTarget) return;
    try {
      await deleteStaff.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name} deactivated`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Staff</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Manage staff records for your school
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" />Bulk Upload
          </Button>
          <Button size="sm" onClick={openAdd}>
            <UserPlus className="h-4 w-4" />Add Staff
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            aria-label="Search staff"
            placeholder="Search by name or staff number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setStatusTab(key); setPage(0); }}
              aria-pressed={statusTab === key}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusTab === key
                  ? "bg-[var(--brand)] text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                {["Name", "Staff No.", "Rank / Specialization", "Role", "Status", "Joined"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
                <th scope="col" className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700" aria-busy={isFetching}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div role="status" aria-live="polite" aria-atomic="true">
                      <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                      <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        {search || statusTab || roleFilter ? "No staff match your filters" : "No staff yet"}
                      </p>
                      {!search && !statusTab && !roleFilter && (
                        <p className="mt-1 text-xs text-gray-400">
                          Add a staff member or use bulk upload to get started
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => router.push(`/staff/${member.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isFetching ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/staff/${member.id}`} className="flex items-center gap-3 group">
                        <StaffAvatar member={member} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 group-hover:text-[var(--brand)] dark:text-white">
                            {member.title && <span className="mr-1">{member.title}</span>}
                            {member.first_name} {member.last_name}
                          </p>
                          {member.phone && (
                            <p className="flex items-center gap-1 truncate text-xs text-gray-400 dark:text-gray-500">
                              <Phone className="h-3 w-3" />{member.phone}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {member.staff_number ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {member.current_rank ?? member.specialization ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {member.user ? (
                        <span className="capitalize text-sm text-gray-700 dark:text-gray-300">
                          {member.user.role.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No account</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status] ?? ""}`}>
                        {STATUS_LABELS[member.status] ?? member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {member.date_joined ? formatDate(member.date_joined) : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={[
                        { label: "View", icon: <Eye className="h-4 w-4" />, href: `/staff/${member.id}` },
                        { label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(member) },
                        { label: "Deactivate", icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeleteTarget(member), variant: "danger" },
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 p-4" aria-hidden="true">
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))
            : members.length === 0
            ? (
              <div className="py-16 text-center" role="status" aria-live="polite">
                <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {search || statusTab || roleFilter ? "No staff match your filters" : "No staff yet"}
                </p>
              </div>
            )
            : members.map((member) => (
              <Link
                key={member.id}
                href={`/staff/${member.id}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <StaffAvatar member={member} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-white">
                    {member.title && <span className="mr-1">{member.title}</span>}
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {member.user?.role.replace(/_/g, " ") ?? "No account"}
                    {member.staff_number && ` · ${member.staff_number}`}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status] ?? ""}`}>
                  {STATUS_LABELS[member.status] ?? member.status}
                </span>
              </Link>
            ))}
        </div>

        {/* Pagination */}
        {!isLoading && members.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + members.length}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editMember ? "Edit Staff Member" : "Add Staff Member"}
        width="lg"
      >
        <StaffForm
          staff={editMember ?? undefined}
          onSuccess={() => setDrawerOpen(false)}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* Bulk upload */}
      <StaffBulkUploadDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} />

      {/* Deactivate confirm */}
      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deactivate Staff Member?"
        description={
          deleteTarget
            ? <><strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> will be marked as retired and their login (if any) will be disabled.</>
            : ""
        }
        confirmLabel="Deactivate"
        loading={deleteStaff.isPending}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
