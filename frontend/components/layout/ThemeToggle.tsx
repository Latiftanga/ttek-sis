"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "@/lib/theme";

const themes: Theme[] = ["system", "light", "dark"];

const icons: Record<Theme, React.ElementType> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const actionLabels: Record<Theme, string> = {
  system: "Switch to system theme",
  light: "Switch to light mode",
  dark: "Switch to dark mode",
};

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeStore();
  const Icon = icons[theme] ?? Monitor;

  const cycle = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
  };

  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];

  return (
    <button
      onClick={cycle}
      aria-label={actionLabels[nextTheme]}
      className={cn(
        "rounded-lg p-1.5 transition-colors",
        "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
