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
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full text-left text-sm md:min-w-[640px]">
          <thead className="hidden bg-slate-50 dark:bg-slate-900/60 md:table-header-group">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block p-3 md:table-row-group md:divide-y md:divide-slate-200 md:p-0 md:dark:divide-slate-800">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="mb-3 block rounded-xl border border-slate-200 bg-slate-50/60 p-3 last:mb-0 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-900 md:mb-0 md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:hover:bg-slate-50/70 md:dark:hover:bg-slate-800/40">
      {children}
    </tr>
  );
}

export function DataCell({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <td
      data-label={label ?? ""}
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-200 py-2 text-right text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200 before:pr-2 before:text-left before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-slate-500 before:content-[attr(data-label)] dark:before:text-slate-400 md:table-cell md:border-b-0 md:px-4 md:py-3 md:text-left md:before:hidden",
        className,
      )}
    >
      {children}
    </td>
  );
}
