import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export default function Card({ children, className, title, action }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          {title && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

const colorMap: Record<
  string,
  { bg: string; text: string; icon: string; bar: string }
> = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
    bar: "bg-blue-500",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-600 dark:text-purple-400",
    icon: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
    bar: "bg-purple-500",
  },
};

export function StatCard({
  label,
  value,
  icon,
  color = "emerald",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "emerald" | "blue" | "yellow" | "purple";
}) {
  const c = colorMap[color] ?? colorMap.emerald;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className={cn("absolute inset-0 opacity-40 dark:opacity-20", c.bg)} />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
              {value}
            </p>
          </div>
          <div className={cn("rounded-xl p-2.5 shrink-0", c.icon)}>{icon}</div>
        </div>
      </div>
      {/* Accent bar */}
      <div className={cn("h-1 w-full", c.bar)} />
    </div>
  );
}
