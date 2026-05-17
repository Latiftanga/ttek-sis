"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type {
  AssessmentBreakdown,
  CategoryBreakdown,
  SchoolProfile,
  StudentTermReport,
  SubjectBreakdown,
  TermReportCard,
} from "@/lib/api";

// ── Formatters ─────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return digits === 0 ? String(Math.round(num)) : num.toFixed(digits);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(1)}%`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function initialsOf(report: StudentTermReport): string {
  return `${report.first_name?.[0] ?? ""}${report.last_name?.[0] ?? ""}`.toUpperCase();
}

// Map a grade letter to a Tailwind tint. Independent of the school's brand
// colour — green/red are universal "good/bad" cues that parents read fast.
function gradeTint(grade: string | null | undefined): {
  bg: string;
  text: string;
} {
  if (!grade) return { bg: "bg-gray-100", text: "text-gray-500" };
  const head = grade.trim().toUpperCase()[0];
  if (head === "A" || grade === "1") {
    return { bg: "bg-emerald-100", text: "text-emerald-800" };
  }
  if (head === "B" || grade === "2" || grade === "3") {
    return { bg: "bg-teal-100", text: "text-teal-800" };
  }
  if (head === "C" || grade === "4" || grade === "5" || grade === "6") {
    return { bg: "bg-sky-100", text: "text-sky-800" };
  }
  if (head === "D" || head === "E" || grade === "7" || grade === "8") {
    return { bg: "bg-amber-100", text: "text-amber-800" };
  }
  if (head === "F" || grade === "9") {
    return { bg: "bg-rose-100", text: "text-rose-800" };
  }
  return { bg: "bg-gray-100", text: "text-gray-700" };
}

// Validate the school accent_color so we can safely interpolate it into
// style attributes. Falls back to the Ghana-green default if anything odd.
function safeColor(c: string | undefined | null): string {
  if (!c) return "#1a6b3c";
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#1a6b3c";
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * The printable card body. Same layout for single-student view, bulk print,
 * and public /verify pages. Pass `subjects` from the breakdown endpoint
 * when you want the collapsible per-subject detail.
 */
export default function ReportCardBody({
  report,
  school,
  subjects,
  showBreakdownToggle,
  verificationUrl,
}: {
  report: StudentTermReport;
  school:
    | (SchoolProfile | { accent_color?: string; logo_url?: string | null; name?: string; district?: string | null; region?: string | null; phone?: string | null; email?: string | null })
    | undefined;
  subjects: SubjectBreakdown[];
  /** When true each subject row gets an expand chevron (single-student view). */
  showBreakdownToggle: boolean;
  /** Full URL the QR code should encode. Caller composes from origin + token. */
  verificationUrl?: string | null;
}) {
  const accent = safeColor(school?.accent_color);
  const studentName = [report.first_name, report.middle_name, report.last_name]
    .filter(Boolean)
    .join(" ");

  // Hero aggregate — average of the per-subject totals so it's always 0-100.
  const validTotals = report.results
    .map((r) => (r.raw_score == null ? null : Number(r.raw_score)))
    .filter((n): n is number => n !== null);
  const aggregateAvg = validTotals.length
    ? validTotals.reduce((a, b) => a + b, 0) / validTotals.length
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-900 print:rounded-none print:bg-white print:text-black print:shadow-none"
      style={{
        // Diploma double-line frame: solid outer hairline + faint inner ring
        // with a generous bleed gap. Both use the school accent.
        boxShadow: `0 0 0 1px ${accent}, 0 0 0 4px white, 0 0 0 5px ${accent}66`,
      }}
    >
      {/* Top accent band */}
      <div
        className="h-2 w-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      {/* Corner ornaments — small SVG flourishes that anchor the diploma feel */}
      <CornerOrnament position="top-left" accent={accent} />
      <CornerOrnament position="top-right" accent={accent} />
      <CornerOrnament position="bottom-left" accent={accent} />
      <CornerOrnament position="bottom-right" accent={accent} />

      {/* Faint school-logo watermark behind everything */}
      {school?.logo_url && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={school.logo_url}
            alt=""
            className="h-[60%] w-auto opacity-[0.04]"
          />
        </div>
      )}

      <div className="relative p-6 print:p-5">
        {/* Header ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
          <div className="flex items-start gap-4">
            {school?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={school.logo_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover ring-2"
                style={{ boxShadow: `0 0 0 2px ${accent}` }}
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {school?.name?.[0] ?? "S"}
              </div>
            )}
            <div className="min-w-0">
              <p
                className="font-serif text-xl font-bold uppercase tracking-wide leading-tight text-gray-900 dark:text-white print:text-black"
                style={{ letterSpacing: "0.04em" }}
              >
                {school?.name ?? "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 print:text-gray-700">
                {[school?.district, school?.region]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              {(school?.phone || school?.email) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-700">
                  {[school?.phone, school?.email].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-2 text-right"
            style={{ backgroundColor: `${accent}10` }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: accent }}
            >
              Terminal Report
            </p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white print:text-black">
              {report.term_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-700">
              {report.academic_year}
            </p>
          </div>
        </div>

        {/* Accent divider */}
        <div
          className="-mx-6 h-px print:-mx-5"
          style={{ backgroundColor: `${accent}33` }}
        />

        {/* Student strip ────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-stretch gap-4">
          {/* Photo */}
          {report.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.photo_url}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl object-cover"
              style={{ boxShadow: `0 0 0 2px ${accent}` }}
            />
          ) : (
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: `${accent}cc` }}
            >
              {initialsOf(report)}
            </div>
          )}

          {/* Name + IDs */}
          <div className="min-w-0 flex-1">
            <p className="font-serif text-2xl font-bold leading-tight text-gray-900 dark:text-white print:text-black">
              {studentName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 print:text-gray-700">
              <span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">
                  ID
                </span>{" "}
                <span className="font-mono font-medium text-gray-700 dark:text-gray-200 print:text-black">
                  {report.student_number}
                </span>
              </span>
              <span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">
                  Class
                </span>{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200 print:text-black">
                  {report.class_name}
                </span>
              </span>
            </div>
          </div>

          {/* Stat trio: aggregate · position · attendance */}
          <div className="flex items-stretch gap-3">
            <AggregateBadge value={aggregateAvg} accent={accent} />
            <PositionBadge position={report.overall_position} accent={accent} />
            <AttendanceRing pct={report.attendance_pct} accent={accent} />
          </div>
        </div>

        {/* Subjects table ──────────────────────────────────────── */}
        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 print:border-gray-400">
          <table className="min-w-full text-sm">
            <thead
              className="text-[10px] uppercase tracking-wider text-white"
              style={{ backgroundColor: accent }}
            >
              <tr>
                {showBreakdownToggle && <th className="w-8 px-2 py-2"></th>}
                <th className="px-3 py-2 text-left font-semibold">Subject</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Class<br />Score
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Exam<br />Score
                </th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-center font-semibold">Grade</th>
                <th className="px-3 py-2 text-right font-semibold">Pos</th>
                <th className="px-3 py-2 text-left font-semibold">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-200 print:text-black">
              {subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={showBreakdownToggle ? 8 : 7}
                    className="px-3 py-6 text-center text-gray-400"
                  >
                    No computed results for this term yet.
                  </td>
                </tr>
              ) : (
                subjects.map((s) => (
                  <SubjectRow
                    key={s.subject_id}
                    subject={s}
                    showToggle={showBreakdownToggle}
                    accent={accent}
                    classAvg={
                      report.subject_averages?.[s.subject_id] != null
                        ? Number(report.subject_averages[s.subject_id])
                        : null
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer ─────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3 print:grid-cols-3">
          {/* Stats card */}
          <div
            className="rounded-xl border p-3 text-sm"
            style={{
              borderColor: `${accent}40`,
              backgroundColor: `${accent}08`,
            }}
          >
            <Row label="Total Score">{fmt(report.total_score, 0)}</Row>
            <Row label="Overall Position">
              {report.overall_position
                ? ordinal(report.overall_position)
                : "—"}
            </Row>
            <Row label="Attendance">{fmtPct(report.attendance_pct)}</Row>
          </div>

          {/* Remark blocks */}
          <div className="space-y-3 text-sm lg:col-span-2 print:col-span-2">
            <RemarkBlock
              label="Class Teacher's Remark"
              accent={accent}
              text={report.term_card?.class_teacher_remark ?? null}
            />
            <RemarkBlock
              label="Headteacher's Remark"
              accent={accent}
              text={report.term_card?.headteacher_remark ?? null}
            />
          </div>
        </div>

        {/* Skill ratings — fills the chosen rating circle when the card
            has saved values; otherwise renders empty for hand-ticking. */}
        <SkillRatings accent={accent} card={report.term_card ?? null} />

        {/* Signatures + QR ─────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="col-span-2 grid grid-cols-2 gap-6 text-xs text-gray-500 print:text-gray-700">
            <div>
              <div
                className="h-px w-full"
                style={{ backgroundColor: `${accent}66` }}
              />
              <p className="mt-1">Class Teacher&apos;s Signature</p>
            </div>
            <div>
              <div
                className="h-px w-full"
                style={{ backgroundColor: `${accent}66` }}
              />
              <p className="mt-1">Headteacher&apos;s Signature</p>
            </div>
          </div>
          <VerifyQR url={verificationUrl} accent={accent} />
        </div>
      </div>
    </div>
  );
}

// ── Position badge ─────────────────────────────────────────────────────────

function AggregateBadge({
  value,
  accent,
}: {
  value: number | null;
  accent: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-400 print:text-gray-600">
        Average
      </p>
      <div
        className="flex h-16 w-16 flex-col items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: value !== null ? accent : "#d1d5db" }}
      >
        <span className="font-serif text-2xl font-bold leading-none">
          {value !== null ? Math.round(value) : "—"}
        </span>
        {value !== null && (
          <span className="mt-0.5 text-[9px] uppercase tracking-wider opacity-80">
            of 100
          </span>
        )}
      </div>
    </div>
  );
}

function PositionBadge({
  position,
  accent,
}: {
  position: number | null;
  accent: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-400 print:text-gray-600">
        Position
      </p>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{
          backgroundColor: position ? accent : "#d1d5db",
        }}
      >
        {position ?? "—"}
      </div>
      {position && (
        <p className="mt-1 text-[10px] font-medium text-gray-500 print:text-gray-600">
          in class
        </p>
      )}
    </div>
  );
}

function CornerOrnament({
  position,
  accent,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  accent: string;
}) {
  // Two-stroke L-bracket with a small filled dot on the inside corner.
  // The wrapper is absolutely positioned in each corner; the SVG is
  // rotated so a single artwork covers all four corners.
  const rotation = {
    "top-left": "0",
    "top-right": "90",
    "bottom-right": "180",
    "bottom-left": "270",
  }[position];
  const placement = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
  }[position];
  return (
    <div
      className={`pointer-events-none absolute ${placement}`}
      aria-hidden
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M2 8V2H8"
          stroke={accent}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M2 12V5H5"
          stroke={accent}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="2.5" cy="2.5" r="1.25" fill={accent} />
      </svg>
    </div>
  );
}

// ── Attendance ring ────────────────────────────────────────────────────────

function AttendanceRing({
  pct,
  accent,
}: {
  pct: number | null;
  accent: string;
}) {
  const value = pct ?? null;
  const display = value !== null ? Math.round(value) : null;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset =
    value !== null
      ? circumference * (1 - Math.min(100, Math.max(0, value)) / 100)
      : circumference;

  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-400 print:text-gray-600">
        Attendance
      </p>
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            stroke="#e5e7eb"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            stroke={value !== null ? accent : "#d1d5db"}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-gray-100 print:text-black">
          {display !== null ? `${display}%` : "—"}
        </div>
      </div>
    </div>
  );
}

// ── Subject row + performance bar ─────────────────────────────────────────

function SubjectRow({
  subject,
  showToggle,
  accent,
  classAvg,
}: {
  subject: SubjectBreakdown;
  showToggle: boolean;
  accent: string;
  classAvg: number | null;
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = subject.categories.length > 0;
  const total = subject.raw_score != null ? Number(subject.raw_score) : null;
  const widthPct = total !== null ? Math.max(0, Math.min(100, total)) : 0;
  const avgPct =
    classAvg !== null ? Math.max(0, Math.min(100, classAvg)) : null;
  const tint = gradeTint(subject.grade);

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 print:hover:bg-transparent">
        {showToggle && (
          <td className="px-2 py-2 align-top">
            {hasBreakdown && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Hide breakdown" : "Show breakdown"}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 print:hidden"
              >
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </td>
        )}
        <td className="px-3 py-2 align-middle font-medium">
          <div>{subject.subject_name}</div>
          {total !== null && (
            <div className="relative mt-1 h-1.5 w-32 overflow-visible rounded-full bg-gray-100 dark:bg-gray-800 print:bg-gray-200">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: accent,
                }}
              />
              {avgPct !== null && (
                <div
                  className="absolute top-[-2px] h-[10px] w-px bg-gray-500 print:bg-gray-700"
                  style={{ left: `${avgPct}%` }}
                  title={`Class average ${avgPct.toFixed(1)}%`}
                  aria-label={`Class average ${avgPct.toFixed(1)}`}
                />
              )}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-right align-middle tabular-nums">
          {fmt(subject.ca_score, 0)}
        </td>
        <td className="px-3 py-2 text-right align-middle tabular-nums">
          {fmt(subject.exam_score, 0)}
        </td>
        <td className="px-3 py-2 text-right align-middle font-semibold tabular-nums">
          {fmt(subject.raw_score, 0)}
        </td>
        <td className="px-3 py-2 text-center align-middle">
          {subject.grade ? (
            <span
              className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${tint.bg} ${tint.text}`}
            >
              {subject.grade}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-right align-middle tabular-nums">
          {subject.position ? ordinal(subject.position) : "—"}
        </td>
        <td className="px-3 py-2 align-middle text-xs text-gray-500 dark:text-gray-400 print:text-gray-700">
          {subject.remark ?? "—"}
        </td>
      </tr>
      {open && hasBreakdown && showToggle && (
        <tr className="bg-gray-50/60 dark:bg-gray-800/30 print:hidden">
          <td></td>
          <td colSpan={7} className="px-3 py-3">
            <BreakdownDetail categories={subject.categories} accent={accent} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500 dark:text-gray-400 print:text-gray-700">
        {label}
      </span>
      <span className="font-semibold text-gray-900 dark:text-white print:text-black">
        {children}
      </span>
    </div>
  );
}

// Order matters: the array index + 1 == the stored rating value
// (1 = Excellent, 5 = Poor). Keep in sync with the upsert payload.
export const SKILL_ROWS = [
  { key: "punctuality", label: "Punctuality" },
  { key: "neatness", label: "Neatness" },
  { key: "conduct", label: "Conduct" },
  { key: "cooperation", label: "Cooperation" },
  { key: "participation", label: "Class Participation" },
] as const;
export const RATING_LEVELS = [
  "Excellent",
  "V. Good",
  "Good",
  "Fair",
  "Poor",
] as const;

function SkillRatings({
  accent,
  card,
}: {
  accent: string;
  card: TermReportCard | null;
}) {
  return (
    <div
      className="mt-5 rounded-xl border p-3"
      style={{ borderColor: `${accent}40` }}
    >
      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: accent }}
      >
        Skills & Conduct
      </p>
      <table className="w-full text-xs">
        <thead className="text-[9px] uppercase tracking-wider text-gray-400 print:text-gray-600">
          <tr>
            <th className="w-1/3 px-2 py-1 text-left font-medium"></th>
            {RATING_LEVELS.map((lvl) => (
              <th key={lvl} className="px-2 py-1 text-center font-medium">
                {lvl}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SKILL_ROWS.map(({ key, label }) => {
            const value =
              (card?.[key as keyof TermReportCard] as number | null | undefined) ??
              null;
            return (
              <tr
                key={key}
                className="border-t border-gray-100 dark:border-gray-800 print:border-gray-300"
              >
                <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200 print:text-black">
                  {label}
                </td>
                {RATING_LEVELS.map((lvl, idx) => {
                  const isSelected = value === idx + 1;
                  return (
                    <td key={lvl} className="px-2 py-1.5 text-center">
                      <span
                        className="mx-auto block h-3.5 w-3.5 rounded-full border"
                        style={{
                          borderColor: `${accent}99`,
                          backgroundColor: isSelected ? accent : "transparent",
                        }}
                        aria-label={`${label} ${lvl}${isSelected ? " (selected)" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RemarkBlock({
  label,
  accent,
  text,
}: {
  label: string;
  accent: string;
  text: string | null;
}) {
  return (
    <div
      className="rounded-lg border border-dashed p-3"
      style={{ borderColor: `${accent}55` }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p className="mt-1 min-h-[2.5rem] whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 print:text-black">
        {text || ""}
      </p>
    </div>
  );
}

function VerifyQR({
  url,
  accent,
}: {
  url: string | null | undefined;
  accent: string;
}) {
  if (!url) {
    // Reserve the space so the layout stays stable when no token yet.
    return <div className="h-20 w-20" aria-hidden />;
  }
  return (
    <div className="flex flex-col items-center justify-end gap-1">
      <div
        className="rounded-md bg-white p-1.5 print:bg-white"
        style={{ boxShadow: `0 0 0 1px ${accent}55` }}
      >
        <QRCodeSVG
          value={url}
          size={72}
          level="M"
          fgColor={accent}
          bgColor="#ffffff"
          marginSize={0}
        />
      </div>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-gray-500 print:text-gray-700">
        <ShieldCheck className="h-3 w-3" />
        Scan to verify
      </div>
    </div>
  );
}

// ── Breakdown (interactive only) ──────────────────────────────────────────

function BreakdownDetail({
  categories,
  accent,
}: {
  categories: CategoryBreakdown[];
  accent: string;
}) {
  return (
    <div className="space-y-3">
      {categories.map((c) => (
        <div
          key={c.category_id}
          className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {c.name}{" "}
              <span
                className="ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${accent}1a`,
                  color: accent,
                }}
              >
                {c.is_ca ? "CA" : "Exam"} · {fmt(c.weight, 0)}%
              </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Avg{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {fmtPct(c.category_pct)}
              </span>{" "}
              → contribution{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {fmt(c.contribution, 1)}
              </span>
            </p>
          </div>
          {c.assessments.length === 0 ? (
            <p className="text-xs italic text-gray-400">
              No assessments in this category.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
              {c.assessments.map((a) => (
                <AssessmentLine key={a.assessment_id} a={a} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function AssessmentLine({ a }: { a: AssessmentBreakdown }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-gray-700 dark:text-gray-200">
          {a.description ?? "—"}
        </p>
        <p className="text-[10px] text-gray-400">
          {a.date_administered ? formatDate(a.date_administered) : "No date"}
        </p>
      </div>
      <div className="text-right tabular-nums">
        {a.is_absent ? (
          <span className="text-amber-600 dark:text-amber-400">Absent</span>
        ) : a.score === null ? (
          <span className="text-gray-400">Not entered</span>
        ) : (
          <>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {fmt(a.score, 0)}
            </span>
            <span className="text-gray-400"> / {fmt(a.max_score, 0)}</span>
            {a.pct !== null && (
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                ({fmtPct(a.pct)})
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}
