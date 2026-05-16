import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const describedBy = [
      hint && !error && id ? `${id}-hint` : null,
      error && id ? `${id}-error` : null,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          rows={3}
          className={cn(
            "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
            "focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500",
            "dark:focus:border-[var(--brand)] dark:focus:ring-[var(--brand)]/20",
            error &&
              "border-red-400 focus:border-red-400 focus:ring-red-400/20 dark:border-red-500",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={id ? `${id}-hint` : undefined} className="text-xs text-gray-400 dark:text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={id ? `${id}-error` : undefined}
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
export default Textarea;
