import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium text-slate-700 dark:text-slate-300", className)}>
      {children}
    </label>
  );
}

