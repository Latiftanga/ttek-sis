"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search, UserPlus, Upload, Users, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Pencil, Trash2, Phone, Download, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useStudents, useDeleteStudent, type Student } from "@/lib/hooks/useStudents";
import { useAuthStore } from "@/lib/store";
import { formatDate, getInitials, getApiError } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge, { statusBadge } from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import StudentForm from "@/components/students/StudentForm";
import BulkUploadModal from "@/components/students/BulkUploadModal";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "graduated", label: "Graduated" },
  { key: "transferred", label: "Transferred" },
  { key: "withdrawn", label: "Withdrawn" },
];

const BULK_STATUSES = [
  { value: "active", label: "Active" },
  { value: "graduated", label: "Graduated" },
  { value: "transferred", label: "Transferred" },
  { value: "withdrawn", label: "Withdrawn" },
];

const PAGE_SIZE = 30;

const GENDER_COLORS: Record<string, string> = {
  male: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  female: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
};

function StudentAvatar({ student }: { student: Student }) {
  const initials = getInitials(student.first_name, student.last_name);
  const colors = [
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  ];
  const color = colors[student.student_number.charCodeAt(0) % colors.length];

  if (student.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={student.photo_url}
        alt=""
        aria-hidden="true"
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}
    >
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

function ActionMenu({
  student,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  student: Student;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((p) => !p);
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed z-20 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ top: pos.top, right: pos.right }}
          >
            <Link
              href={`/students/${student.id}`}
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setOpen(false)}
            >
              <Eye className="h-4 w-4" /> View Profile
            </Link>
            {canEdit && (
              <button
                role="menuitem"
                onClick={() => { setOpen(false); onEdit(student); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {canDelete && (
              <button
                role="menuitem"
                onClick={() => { setOpen(false); onDelete(student); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function exportToCsv(students: Student[], filename: string) {
  const headers = [
    "student_number", "first_name", "middle_name", "last_name",
    "gender", "date_of_birth", "admission_date", "status",
    "house", "programme", "home_address", "notes",
    "primary_contact", "primary_phone",
  ];

  const rows = students.map((s) => {
    const primary = s.contacts.find((c) => c.is_primary_contact) ?? s.contacts[0];
    return [
      s.student_number,
      s.first_name,
      s.middle_name ?? "",
      s.last_name,
      s.gender ?? "",
      s.date_of_birth ?? "",
      s.admission_date ?? "",
      s.status,
      s.house ?? "",
      s.programme ?? "",
      s.home_address ?? "",
      s.notes ?? "",
      primary ? `${primary.first_name} ${primary.last_name ?? ""}`.trim() : "",
      primary?.phone ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  // UTF-8 BOM ensures Excel opens Ghanaian names correctly
  const csv = "﻿" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const { user, school } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(() => searchParams.get("add") === "1");
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("graduated");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canManage = user?.role === "school_admin" || user?.role === "headteacher";
  const canDelete = user?.role === "school_admin";

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [status]);

  const { data, isLoading, isFetching } = useStudents({
    search: debouncedSearch || undefined,
    status: status || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });

  const hasMore = data && data.length > PAGE_SIZE;
  const students = useMemo(() => data?.slice(0, PAGE_SIZE) ?? [], [data]);

  const deleteStudent = useDeleteStudent();

  const handleEdit = useCallback((s: Student) => {
    setEditStudent(s);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = () => { setDrawerOpen(false); setEditStudent(null); };

  // ── selection helpers ─────────────────────────────────────────────────
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        students.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        students.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── bulk status change ────────────────────────────────────────────────
  async function applyBulkStatus() {
    if (selectedIds.size === 0) return;
    setApplyingBulk(true);
    try {
      const { studentsApi } = await import("@/lib/api");
      const results = await Promise.allSettled(
        [...selectedIds].map((id) => studentsApi.update(id, { status: bulkStatus }))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      if (succeeded > 0) {
        toast.success(`${succeeded} student${succeeded !== 1 ? "s" : ""} marked as ${bulkStatus}`);
        queryClient.invalidateQueries({ queryKey: [school?.slug, "students"] });
      }
      if (failed > 0) toast.error(`${failed} update${failed !== 1 ? "s" : ""} failed`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Bulk update failed");
    } finally {
      setApplyingBulk(false);
    }
  }

  // ── export ────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const { studentsApi } = await import("@/lib/api");
      const all: Student[] = await studentsApi.list({
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status ? { status } : {}),
        skip: 0,
        limit: 5000,
      });
      const label = status || "all";
      exportToCsv(all, `${school?.slug ?? "students"}_${label}_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${all.length} student${all.length !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteStudent.mutateAsync(confirmDelete.id);
      toast.success(`${confirmDelete.first_name} ${confirmDelete.last_name} deleted`);
    } catch (err) {
      toast.error(getApiError(err));
    }
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-5">
      {/* page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Manage student records for your school
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={exporting} onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          {canManage && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Button size="sm" onClick={() => { setEditStudent(null); setDrawerOpen(true); }}>
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </>
          )}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            aria-label="Search students"
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              aria-pressed={status === key}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                status === key
                  ? "bg-[var(--brand)] text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-2.5 dark:border-[var(--brand)]/20 dark:bg-[var(--brand)]/10">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Change status to</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {BULK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Button size="sm" loading={applyingBulk} onClick={applyBulkStatus}>
              Apply
            </Button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                {canManage && (
                  <th scope="col" className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all students on this page"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)]"
                    />
                  </th>
                )}
                {[
                  "Student", "ID", "Gender", "Contacts", "Admitted", "Status",
                ].map((h) => (
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
            <tbody
              className="divide-y divide-gray-100 dark:divide-gray-700"
              aria-busy={isFetching}
            >
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-16 text-center">
                    <div role="status" aria-live="polite" aria-atomic="true">
                      <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                      <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        {search || status ? "No students match your filters" : "No students yet"}
                      </p>
                      {canManage && !search && !status && (
                        <p className="mt-1 text-xs text-gray-400">
                          Add a student or use bulk upload to get started
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                      selectedIds.has(s.id) ? "bg-[var(--brand)]/5 dark:bg-[var(--brand)]/10" : ""
                    } ${isFetching ? "opacity-60" : ""}`}
                  >
                    {canManage && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.first_name} ${s.last_name}`}
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)]"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${s.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <StudentAvatar student={s} />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {s.first_name} {s.last_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {s.student_number}
                    </td>
                    <td className="px-4 py-3">
                      {s.gender ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${GENDER_COLORS[s.gender] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.gender.charAt(0).toUpperCase() + s.gender.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.contacts.length > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <Phone className="h-3.5 w-3.5" />
                          {s.contacts[0].first_name}
                          {s.contacts.length > 1 && (
                            <span className="text-gray-400">+{s.contacts.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(s.admission_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge(s.status)}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        student={s}
                        canEdit={canManage}
                        canDelete={canDelete}
                        onEdit={handleEdit}
                        onDelete={setConfirmDelete}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* mobile card list */}
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
            : students.length === 0
            ? (
              <div className="py-16 text-center" role="status" aria-live="polite">
                <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {search || status ? "No students match your filters" : "No students yet"}
                </p>
              </div>
            )
            : students.map((s) => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <StudentAvatar student={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-white">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {s.student_number}
                  </p>
                </div>
                <Badge variant={statusBadge(s.status)}>
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </Badge>
              </Link>
            ))}
        </div>

        {/* pagination */}
        {!isLoading && students.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Page {page + 1} &middot; {students.length} student{students.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* add / edit drawer */}
      <Drawer open={drawerOpen} onClose={handleDrawerClose} title={editStudent ? "Edit Student" : "Add New Student"}>
        <StudentForm student={editStudent ?? undefined} onSuccess={handleDrawerClose} onCancel={handleDrawerClose} />
      </Drawer>

      {/* bulk upload */}
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} />

      {/* delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Student?</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will permanently delete{" "}
              <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong>{" "}
              ({confirmDelete.student_number}) and all their records. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={deleteStudent.isPending} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
