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

// Maps known backend error substrings to plain-English messages with a next step.
const ERROR_HINTS: [RegExp, string][] = [
  [/already enrolled/i,          "This student is already enrolled in a class. Go to their profile to transfer or promote them instead."],
  [/overlap/i,                    "These dates overlap with an existing record. Please adjust the dates and try again."],
  [/duplicate|already exists/i,  "A record with this information already exists. Check for duplicates before adding again."],
  [/in use|being used|still.*used|is.*referenced/i, "This cannot be removed because it is still linked to other records."],
  [/not found/i,                  "This record no longer exists — it may have been deleted. Try refreshing the page."],
  [/invalid.*date|date.*invalid/i, "One of the dates entered is not valid. Please check and try again."],
  [/maximum.*exceeded|limit.*exceeded/i, "The maximum allowed number has been reached. Remove an existing entry first."],
];

// Turn an Axios/Fetch error into a sentence a non-technical user can read.
// Order of preference:
//   1. A known-pattern match on the string detail (most actionable)
//   2. A raw string `detail` from FastAPI's HTTPException
//   3. The first message from a 422 validation array
//   4. A status-code default (401, 403, 404, 409, 429, 5xx)
//   5. A network/timeout default
//   6. The caller-provided fallback
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

  if (typeof detail === "string" && detail.trim()) {
    for (const [pattern, friendly] of ERROR_HINTS) {
      if (pattern.test(detail)) return friendly;
    }
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (typeof first?.msg === "string" && first.msg) {
      const loc = Array.isArray(first.loc) ? first.loc : [];
      const field = loc.length > 1 ? String(loc[loc.length - 1]).replace(/_/g, " ") : null;
      return field ? `Please check the "${field}" field: ${first.msg.toLowerCase()}` : first.msg;
    }
    return "Some fields need attention. Please check the form and try again.";
  }

  const status = e?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that. Contact your school admin if this is a mistake.";
  if (status === 404) return "This record could not be found — it may have been deleted. Try refreshing the page.";
  if (status === 409) return "This information conflicts with an existing record. Check for duplicates and try again.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (typeof status === "number" && status >= 500) {
    return "The server encountered a problem. Please try again in a moment, or contact support if this keeps happening.";
  }

  if (e?.code === "ERR_NETWORK" || e?.message === "Network Error") {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (e?.code === "ECONNABORTED") {
    return "The request took too long. Check your connection and try again.";
  }

  return fallback;
}

export const SCHOOL_TYPES: Record<string, string> = {
  basic: "Basic School",
  shs:   "Senior High School",
};
