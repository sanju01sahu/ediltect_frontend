import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

const PAGE_SIZES = [5, 10, 25, 50];

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: PaginationControlsProps) {
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {from}-{to} of {totalItems} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="w-22">
          <Select
            className="h-11 sm:h-9"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}/page
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1 || totalPages === 0}
        >
          Previous
        </Button>
        <span className="min-w-16 text-center text-sm text-slate-600 dark:text-slate-300">
          Page {safePage} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages || totalPages === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
