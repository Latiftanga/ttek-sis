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

// Turn an Axios/Fetch error into a sentence a non-technical user can read.
// Order of preference:
//   1. A string `detail` from FastAPI's HTTPException (most specific)
//   2. The first message from a 422 validation array, prefixed with the field
//   3. A status-code default (401, 403, 404, 409, 429, 5xx)
//   4. A network/timeout default (no response received)
//   5. The caller-provided fallback
export function getApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const e = err as {
    response?: { status?: number; data?: { detail?: unknown } };
    code?: string;
    message?: string;
  };

  const detail = e?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (typeof first?.msg === "string" && first.msg) {
      const loc = Array.isArray(first.loc) ? first.loc : [];
      const field = loc.length > 1 ? String(loc[loc.length - 1]) : null;
      return field ? `${field}: ${first.msg}` : first.msg;
    }
    return "Some fields need attention. Please check the form.";
  }

  const status = e?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 409) return "That conflicts with existing data.";
  if (status === 429) return "Too many requests. Please wait a moment.";
  if (typeof status === "number" && status >= 500) {
    return "Server error. Please try again in a moment.";
  }

  if (e?.code === "ERR_NETWORK" || e?.message === "Network Error") {
    return "Could not reach the server. Check your internet and try again.";
  }
  if (e?.code === "ECONNABORTED") {
    return "The request took too long. Please try again.";
  }

  return fallback;
}

export const SCHOOL_TYPES: Record<string, string> = {
  basic: "Basic School",
  shs:   "Senior High School",
};
