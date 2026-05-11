"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { studentsApi, academicApi, attendanceApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import {
  Users,
  School,
  CalendarCheck,
  BookOpen,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const quickActions = [
  {
    href: "/students/new",
    label: "Add student",
    desc: "Enrol a new student",
    icon: "👤",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    href: "/attendance",
    label: "Take attendance",
    desc: "Record today's sessions",
    icon: "✅",
    color: "from-blue-500 to-blue-600",
  },
  {
    href: "/grades",
    label: "Enter grades",
    desc: "Update assessment scores",
    icon: "📝",
    color: "from-violet-500 to-violet-600",
  },
  {
    href: "/academic",
    label: "Manage academic",
    desc: "Years, terms & classes",
    icon: "📅",
    color: "from-amber-500 to-amber-600",
  },
];

export default function DashboardPage() {
  const { user, school } = useAuthStore();
  // Prefix all query keys with the school slug so data from different tenants
  // can never collide in the React Query cache.
  const s = school?.slug ?? "";

  const { data: students = [] } = useQuery({
    queryKey: [s, "students", "count"],
    queryFn: () => studentsApi.list({ limit: 200, status: "active" }),
  });

  const { data: years = [] } = useQuery({
    queryKey: [s, "academic-years"],
    queryFn: () => academicApi.listYears(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: [s, "classes", "active"],
    queryFn: () => academicApi.listClasses({ is_active: true }),
  });

  const { data: todayAttendance } = useQuery({
    queryKey: [s, "attendance", "today"],
    queryFn: () =>
      attendanceApi
        .listSessions({ date: new Date().toISOString().split("T")[0] })
        .catch(() => null),
  });

  const currentYear = years.find((y: { is_current: boolean }) => y.is_current);

  const { data: terms = [] } = useQuery({
    queryKey: [s, "terms", currentYear?.id],
    queryFn: () => academicApi.listTerms(currentYear!.id),
    enabled: !!currentYear?.id,
  });

  const currentTerm = terms.find((t: { is_current: boolean }) => t.is_current);
  const sessionsToday = Array.isArray(todayAttendance) ? todayAttendance.length : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero greeting */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 60%, black))",
        }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium text-emerald-100">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {greeting()}{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-emerald-100">
            {school?.name ?? "Your school"} — here&rsquo;s today&rsquo;s snapshot.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -right-4 h-56 w-56 rounded-full bg-white/5" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active students"
          value={students.length}
          icon={<Users className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          label="Active classes"
          value={classes.length}
          icon={<School className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Attendance today"
          value={sessionsToday}
          icon={<CalendarCheck className="h-5 w-5" />}
          color="yellow"
        />
        <StatCard
          label="Academic years"
          value={years.length}
          icon={<BookOpen className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Info panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current academic period */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Current Period
          </h3>
          {currentYear ? (
            <div className="space-y-3">
              <Row
                label="Academic year"
                value={currentYear.name}
                badge={<Badge variant="green">Current</Badge>}
              />
              <div className="border-t border-gray-50 dark:border-gray-800" />
              <Row
                label="Term"
                value={currentTerm?.name ?? undefined}
                badge={currentTerm && <Badge variant="blue">Current</Badge>}
                empty="No term set"
              />
              <div className="border-t border-gray-50 dark:border-gray-800" />
              <Row
                label="Year ends"
                value={formatDate(currentYear.end_date)}
              />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>No current academic year set. Go to Academic to configure one.</span>
            </div>
          )}
        </div>

        {/* School info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            School Info
          </h3>
          <div className="space-y-3">
            <Row label="Name" value={school?.name ?? "—"} />
            <div className="border-t border-gray-50 dark:border-gray-800" />
            <Row label="Type" value={school?.school_type} />
            <div className="border-t border-gray-50 dark:border-gray-800" />
            <Row
              label="Subscription"
              badge={<Badge variant="green">Trial</Badge>}
            />
            <div className="border-t border-gray-50 dark:border-gray-800" />
            <Row
              label="Your role"
              value={user?.role?.replace(/_/g, " ") ?? "—"}
            />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Quick Actions
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map(({ href, label, desc, icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-gray-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-gray-700"
            >
              <div
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-xl shadow-sm`}
              >
                {icon}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {desc}
              </p>
              <ArrowRight className="absolute right-3 top-3 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-400 dark:text-gray-600" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
  empty = "—",
}: {
  label: string;
  value?: string | null;
  badge?: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {value && (
          <span className="text-right text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
            {value}
          </span>
        )}
        {!value && !badge && (
          <span className="text-sm text-gray-400 dark:text-gray-600">{empty}</span>
        )}
        {badge}
      </div>
    </div>
  );
}
