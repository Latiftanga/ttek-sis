"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useLogout } from "@/lib/useLogout";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Building2,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/students",    label: "Students",    icon: Users },
  { href: "/staff",       label: "Staff",       icon: UserCog },
  { href: "/academic",    label: "Academic",    icon: BookOpen },
  { href: "/attendance",  label: "Attendance",  icon: CalendarCheck },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/school",      label: "School",      icon: Building2 },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose, showClose }: { onClose: () => void; showClose?: boolean }) {
  const pathname = usePathname();
  const { school, user } = useAuthStore();
  const logout = useLogout();

  return (
    <aside className="flex h-full w-64 flex-col bg-white dark:bg-gray-900">
      {/* Brand header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: school?.accent_color ?? "#059669" }}
          >
            {school?.name?.[0] ?? "T"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {school?.name ?? "TTEK-SIS"}
            </p>
            <p className="text-xs capitalize text-gray-400 dark:text-gray-500">
              {school?.school_type ?? "school"}
            </p>
          </div>
        </div>
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[var(--brand)] dark:bg-[color-mix(in_srgb,var(--brand)_15%,#030712)] dark:text-[color-mix(in_srgb,var(--brand)_70%,white)]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-[var(--brand)] dark:text-[color-mix(in_srgb,var(--brand)_70%,white)]"
                        : "text-gray-400 dark:text-gray-500"
                    )}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user + theme toggle + logout */}
      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "var(--brand)" }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
              {user?.email}
            </p>
            <p className="text-xs capitalize text-gray-400 dark:text-gray-500">
              {user?.role?.replace(/_/g, " ")}
            </p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close drawer on navigation
  useEffect(() => {
    onCloseRef.current();
  }, [pathname]);

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden h-screen border-r border-gray-200 dark:border-gray-800 lg:block">
        <SidebarContent onClose={onClose} showClose={false} />
      </div>

      {/* Mobile: overlay drawer */}
      <div
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          "transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        {/* Drawer */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 shadow-2xl",
            "transition-transform duration-200 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent onClose={onClose} showClose />
        </div>
      </div>
    </>
  );
}
