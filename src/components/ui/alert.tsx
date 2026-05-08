import { cn } from "@/lib/utils";

type AlertType = "error" | "success" | "info";

const alertMap: Record<AlertType, string> = {
  error:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  info:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
};

export function Alert({
  type = "info",
  children,
  className,
}: {
  type?: AlertType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", alertMap[type], className)}>
      {children}
    </div>
  );
}

