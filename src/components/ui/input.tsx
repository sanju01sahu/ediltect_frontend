import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, onClick, onFocus, type, ...props }, ref) => {
    const openDatePicker = (element: HTMLInputElement) => {
      if (type !== "date") return;
      if (element.disabled || element.readOnly) return;
      if (typeof element.showPicker === "function") {
        try {
          element.showPicker();
        } catch {
          // Browsers can reject showPicker without transient activation.
        }
      }
    };

    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:h-10",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          openDatePicker(event.currentTarget);
        }}
        onFocus={(event) => {
          onFocus?.(event);
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
