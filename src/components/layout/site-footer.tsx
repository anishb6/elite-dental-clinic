import { CLINIC, OPENING_HOURS } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-12 sm:py-16 grid gap-8 sm:gap-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-3xl">{CLINIC.name}</p>
          <p className="mt-3 text-sm opacity-70">
            Gentle, modern dental care by {CLINIC.doctor} in {CLINIC.city}.
          </p>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow mb-3">Visit</p>
          <p className="opacity-80">{CLINIC.address}</p>
          <p className="opacity-80">{CLINIC.phone}</p>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow mb-3">Hours</p>
          {OPENING_HOURS.map(({ days, time }) => (
            <p key={days} className="opacity-80">
              <span className="text-gold">{days}</span> — {time}
            </p>
          ))}
        </div>
      </div>
      <p className="text-center text-xs opacity-50 pb-8">
        © {new Date().getFullYear()} {CLINIC.name}, {CLINIC.city}
      </p>
    </footer>
  );
}
