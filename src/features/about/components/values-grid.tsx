import { CLINIC_VALUES } from "../data/values";

export function ValuesGrid() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {CLINIC_VALUES.map((value) => (
        <div key={value.title}>
          <h3 className="text-2xl">{value.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{value.text}</p>
        </div>
      ))}
    </div>
  );
}
