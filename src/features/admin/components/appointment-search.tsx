type AppointmentSearchProps = { value: string; onChange: (next: string) => void };

export function AppointmentSearch({ value, onChange }: AppointmentSearchProps) {
  return (
    <div>
      <label htmlFor="admin-search" className="sr-only">
        Search by patient name or phone
      </label>
      <input
        id="admin-search"
        type="search"
        placeholder="Search patient or phone…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-64 rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
