import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  children,
  className,
}: {
  columns: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataRow({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">{children}</tr>;
}

export function DataCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3 text-slate-700 dark:text-slate-200", className)}>{children}</td>;
}
