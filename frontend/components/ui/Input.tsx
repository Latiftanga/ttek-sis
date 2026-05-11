import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
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
        <input
          id={id}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={cn(
            "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
            "focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500",
            "dark:focus:border-[var(--brand)] dark:focus:ring-[var(--brand)]/20",
            "dark:disabled:bg-gray-900 dark:disabled:text-gray-600",
            error &&
              "border-red-400 focus:border-red-400 focus:ring-red-400/20 dark:border-red-500",
            className
          )}
          {...props}
        />
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
Input.displayName = "Input";
export default Input;
