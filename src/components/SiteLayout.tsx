import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { CLINIC } from "@/lib/clinic";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/reviews", label: "Reviews" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="leading-tight">
            <span className="block font-serif text-xl sm:text-2xl">Elite Dental Clinic</span>
            <span className="block text-[0.65rem] tracking-[0.3em] uppercase text-gold">
              Dr. Debayan Saha · Barasat
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-8 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="opacity-80 hover:opacity-100 [&.active]:text-gold [&.active]:opacity-100"
              >
                {n.label}
              </Link>
            ))}
            <Link to="/book" className="btn-gold">
              Book Now
            </Link>
          </nav>
          <button
            className="lg:hidden text-sm tracking-widest uppercase px-3 py-3 -mr-3"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav className="lg:hidden border-t border-primary-foreground/10 px-5 py-3 flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="py-3 border-b border-primary-foreground/10 [&.active]:text-gold"
                activeOptions={{ exact: true }}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/book"
              onClick={() => setOpen(false)}
              className="btn-gold mt-4 mb-2 text-center"
            >
              Book Now
            </Link>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
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
            {CLINIC.hours.map(([d, h]) => (
              <p key={d} className="opacity-80">
                <span className="text-gold">{d}</span> — {h}
              </p>
            ))}
          </div>
        </div>
        <p className="text-center text-xs opacity-50 pb-8">
          © {new Date().getFullYear()} {CLINIC.name}, {CLINIC.city}
        </p>
      </footer>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-14 sm:py-20 md:py-28">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-4xl sm:text-5xl md:text-7xl max-w-3xl">{title}</h1>
        {text && <p className="mt-6 max-w-2xl opacity-75 text-base sm:text-lg">{text}</p>}
      </div>
    </section>
  );
}
