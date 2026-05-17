"use client";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import ThemeToggle from "./ThemeToggle";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { school } = useAuthStore();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:hidden print:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: school?.accent_color ?? "#059669" }}
        >
          {school?.name?.[0] ?? "T"}
        </div>
        <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {school?.name ?? "TTEK-SIS"}
        </span>
      </div>

      <ThemeToggle />
    </header>
  );
}
