import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
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

export function getApiError(err: unknown): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data
      ?.detail ?? "Something went wrong"
  );
}

export const SCHOOL_TYPES: Record<string, string> = {
  basic: "Basic School",
  shs: "SHS",
  combined: "Combined School",
};
