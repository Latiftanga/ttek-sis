"use client";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
}

export default function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else {
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const query = () =>
      el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    query()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const focusable = query();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(
        "fixed inset-0 z-50 flex transition-all",
        // mobile: sheet from bottom
        "items-end justify-center",
        // desktop: centered dialog
        "md:items-center",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative w-full bg-white shadow-2xl dark:bg-gray-900",
          "transition-all duration-300 ease-in-out",
          // mobile: full-width bottom sheet
          "rounded-t-2xl px-6 pb-8 pt-3",
          // desktop: compact centered card
          "md:max-w-sm md:rounded-2xl md:p-6",
          open
            ? "translate-y-0 md:scale-100 md:opacity-100"
            : "translate-y-full md:translate-y-0 md:scale-95 md:opacity-0"
        )}
      >
        {/* drag handle — mobile only */}
        <div className="mb-5 flex justify-center md:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>

        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </div>

        {/* buttons: stacked on mobile (cancel at bottom = thumb-safe), row on desktop */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
