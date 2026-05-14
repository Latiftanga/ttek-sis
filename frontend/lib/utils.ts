import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  // Date-only strings (YYYY-MM-DD) are UTC midnight per spec — parse as local to avoid off-by-one day in negative-offset timezones
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, day] = date.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(date);
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getInitials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ROLES: Record<string, string> = {
  superadmin: "Super Admin",
  school_admin: "School Admin",
  headteacher: "Head Teacher",
  teacher: "Teacher",
  accountant: "Accountant",
};

export function getApiError(err: unknown, fallback = "Something went wrong"): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data
      ?.detail ?? fallback
  );
}

export const SCHOOL_TYPES: Record<string, string> = {
  basic: "Basic School",
  shs:   "Senior High School",
};
