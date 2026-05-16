"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}

export default function ActionMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((p) => !p);
  }

  const base = "flex w-full items-center gap-2 px-3 py-2 text-sm";
  const colors = {
    default: "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700",
    danger:  "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
  };

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed z-20 min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={`${base} ${colors[item.variant ?? "default"]}`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon} {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  className={`${base} ${colors[item.variant ?? "default"]}`}
                  onClick={() => { setOpen(false); item.onClick?.(); }}
                >
                  {item.icon} {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
