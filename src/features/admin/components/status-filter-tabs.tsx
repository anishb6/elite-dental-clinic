import { STATUS_FILTERS, type StatusFilter } from "../types";

type StatusFilterTabsProps = { value: StatusFilter; onChange: (next: StatusFilter) => void };

export function StatusFilterTabs({ value, onChange }: StatusFilterTabsProps) {
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            value === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
