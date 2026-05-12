"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, UserPlus, Users, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Pencil, Trash2, Phone,
} from "lucide-react";
import toast from "react-hot-toast";
import { useStaff, useDeleteStaff, type Staff } from "@/lib/hooks/useStaff";
import { formatDate, getInitials, getApiError } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import StaffForm from "@/components/staff/StaffForm";

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
  on_leave:    "bg-amber-100  text-amber-700  dark:bg-amber-900/50  dark:text-amber-300",
  transferred: "bg-blue-100   text-blue-700   dark:bg-blue-900/50   dark:text-blue-300",
  retired:     "bg-gray-100   text-gray-600   dark:bg-gray-800      dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_leave: "On Leave", transferred: "Transferred", retired: "Retired",
};

function StaffAvatar({ member }: { member: Staff }) {
  const initials = getInitials(member.first_name, member.last_name);
  const colors = [
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "bg-blue-100    text-blue-700    dark:bg-blue-900    dark:text-blue-300",
    "bg-violet-100  text-violet-700  dark:bg-violet-900  dark:text-violet-300",
    "bg-amber-100   text-amber-700   dark:bg-amber-900   dark:text-amber-300",
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
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
        </td>
      ))}
    </tr>
  );
}

export default function StaffPage() {
  const [search,    setSearch]    = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editMember,  setEditMember]  = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos,  setMenuPos]  = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(id);
  }

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // close dropdown on outside click or scroll
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", () => setMenuOpen(null), true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", () => setMenuOpen(null), true);
    };
  }, []);

  const { data, isLoading } = useStaff({
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
  const openEdit = useCallback((m: Staff) => { setEditMember(m); setDrawerOpen(true); setMenuOpen(null); }, []);

  async function confirmDelete(member: Staff) {
    try {
      await deleteStaff.mutateAsync(member.id);
      toast.success(`${member.first_name} ${member.last_name} deactivated`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Staff</h1>
          </div>
          <Button onClick={openAdd} size="sm">
            <UserPlus className="h-4 w-4" />
            Add Staff
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Status tabs */}
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setStatusTab(t.key); setPage(0); }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusTab === t.key
                  ? "bg-[var(--brand)] text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-white text-left dark:border-gray-800 dark:bg-gray-900">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Staff No.</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Rank / Specialization</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Joined</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : members.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 dark:text-gray-600">
                    No staff found
                  </td>
                </tr>
              )
              : members.map((member) => (
                <tr
                  key={member.id}
                  className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50"
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
                          <p className="flex items-center gap-1 truncate text-xs text-gray-400 dark:text-gray-500 sm:hidden">
                            <Phone className="h-3 w-3" />{member.phone}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {member.staff_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell max-w-[180px] truncate">
                    {member.current_rank ?? member.specialization ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {member.user ? (
                      <span className="capitalize text-gray-700 dark:text-gray-300">
                        {member.user.role.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-gray-400">No account</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status] ?? ""}`}>
                      {STATUS_LABELS[member.status] ?? member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {member.date_joined ? formatDate(member.date_joined) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => openMenu(e, menuOpen === member.id ? "" : member.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Actions dropdown — fixed so it escapes overflow-x:auto on the table */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          className="z-50 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {members.filter((m) => m.id === menuOpen).map((member) => (
            <div key={member.id}>
              <Link
                href={`/staff/${member.id}`}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setMenuOpen(null)}
              >
                <Eye className="h-3.5 w-3.5" />View
              </Link>
              <button
                onClick={() => openEdit(member)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
              <button
                onClick={() => { setDeleteTarget(member); setMenuOpen(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />Deactivate
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
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

      {/* Deactivate confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Deactivate staff member?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> will be marked as retired
              and their login (if any) will be disabled.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleteStaff.isPending}
                onClick={() => confirmDelete(deleteTarget)}
              >
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
