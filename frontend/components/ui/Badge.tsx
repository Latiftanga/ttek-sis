import { cn } from "@/lib/utils";

type BadgeVariant = "green" | "red" | "yellow" | "blue" | "gray";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  green:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/30",
  red: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-400 dark:ring-red-500/30",
  yellow:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-500/30",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-500/30",
  gray: "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-500/30",
};

export default function Badge({
  children,
  variant = "gray",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: "green",
    graduated: "blue",
    transferred: "yellow",
    withdrawn: "red",
    inactive: "gray",
  };
  return map[status] ?? "gray";
}
