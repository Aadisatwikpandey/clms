import { Button } from "@/components/ui/button";

/** Standardized Prev/Next pagination footer — reused across every paginated list page. */
export function Pagination({
  page,
  onPageChange,
  hasNext,
  total,
  label,
}: {
  page: number;
  onPageChange: (page: number) => void;
  hasNext: boolean;
  total?: number;
  label?: string;
}) {
  return (
    <div className="flex gap-2 items-center pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-slate-500">
        {label ?? `Page ${page}`}{total != null ? ` · ${total} total` : ""}
      </span>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  );
}
